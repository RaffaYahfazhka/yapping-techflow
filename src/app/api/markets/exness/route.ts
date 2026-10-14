import { NextResponse } from 'next/server';
import type { Candle, Quote } from '@/lib/engine/paperTrading';
import type {
  ExnessAccount,
  ExnessFeedData,
  ExnessPosition,
  ExnessRiskPolicy,
  MarketFeedEnvelope,
} from '@/lib/data/markets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/markets/exness
 *
 * Feed read-only untuk bot XAUUSD EA. Exness tidak menyediakan REST publik untuk
 * akun trading, jadi route ini HANYA meneruskan data dari gateway/bridge MT5 milik
 * user sendiri (`EXNESS_GATEWAY_URL`). Tanpa gateway, respons berstatus
 * `unconfigured` dan tidak berisi satu angka pun.
 *
 * Anti-fabrikasi:
 *   - Candle yang tidak lengkap (open/high/low/close/volume/time non-finite)
 *     dibuang, bukan diisi default. Jumlah yang dibuang dilaporkan di `warnings`.
 *   - Quote hanya dianggap valid bila bid > 0, ask >= bid, dan timestamp finite.
 *   - Sinyal EMA/ATR TIDAK dihitung di route ini; UI menghitungnya dari candle
 *     nyata memakai `evaluateEmaAtrSignal` supaya umur quote & gate risiko ikut
 *     dievaluasi di klien.
 *   - Tidak ada order nyata: seluruh eksekusi tetap paper (`openPaperTrade`).
 *
 * Query: `?symbol=XAUUSD&timeframe=M5&bars=300`
 * Env  : `EXNESS_GATEWAY_URL`, `EXNESS_GATEWAY_TOKEN`, `EXNESS_SYMBOL`,
 *        `EXNESS_TIMEFRAME`, `EXNESS_RISK_PERCENT`, `EXNESS_RISK_CAP_PERCENT`,
 *        `EXNESS_MAX_SPREAD`, `EXNESS_MIN_TICK_VOLUME`,
 *        `EXNESS_DAILY_LOSS_LIMIT_PERCENT`, `EXNESS_VALUE_PER_UNIT`
 */

const REQUIRED_ENV = ['EXNESS_GATEWAY_URL', 'EXNESS_GATEWAY_TOKEN'];
const TIMEFRAME_MS: Record<string, number> = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  M30: 1_800_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
};

type Raw = Record<string, unknown>;

function readNumber(raw: Raw, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric === 'number' && Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function readString(raw: Raw, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readOptionalPercent(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function mapAccount(raw: Raw | null): ExnessAccount | null {
  if (!raw) return null;
  const account: ExnessAccount = {
    login: readString(raw, ['login', 'account', 'accountNumber']) ?? null,
    server: readString(raw, ['server', 'serverName']) ?? null,
    currency: readString(raw, ['currency', 'currencyName', 'accountCurrency']) ?? null,
    balance: readNumber(raw, ['balance', 'Balance']) ?? null,
    equity: readNumber(raw, ['equity', 'Equity']) ?? null,
    margin: readNumber(raw, ['margin', 'Margin']) ?? null,
    freeMargin: readNumber(raw, ['freeMargin', 'margin_free', 'free_margin']) ?? null,
    leverage: readNumber(raw, ['leverage', 'Leverage']) ?? null,
  };
  const hasValue = Object.values(account).some((value) => value !== null);
  return hasValue ? account : null;
}

function mapPosition(raw: Raw): ExnessPosition | null {
  const ticket = readString(raw, ['ticket', 'id', 'positionId']);
  if (!ticket) return null;
  const rawSide = (readString(raw, ['side', 'type', 'orderType']) ?? '').toLowerCase();
  const side: ExnessPosition['side'] = rawSide.startsWith('b') ? 'BUY' : rawSide.startsWith('s') ? 'SELL' : null;
  return {
    ticket,
    symbol: readString(raw, ['symbol', 'instrument']) ?? null,
    side,
    volume: readNumber(raw, ['volume', 'lots', 'size']) ?? null,
    openPrice: readNumber(raw, ['openPrice', 'open_price', 'priceOpen']) ?? null,
    currentPrice: readNumber(raw, ['currentPrice', 'current_price', 'priceCurrent']) ?? null,
    profit: readNumber(raw, ['profit', 'pnl']) ?? null,
    openTime: readString(raw, ['openTime', 'open_time', 'time']) ?? null,
  };
}

/** Quote hanya valid bila kedua sisi ada dan masuk akal; selain itu `null`. */
function mapQuote(raw: Raw | null): Quote | null {
  if (!raw) return null;
  const bid = readNumber(raw, ['bid']);
  const ask = readNumber(raw, ['ask']);
  const timestampRaw = readNumber(raw, ['timestamp', 'time', 'ts']);
  const timestamp = timestampRaw !== undefined && timestampRaw < 1e12 ? timestampRaw * 1000 : timestampRaw;
  if (bid === undefined || ask === undefined || timestamp === undefined) return null;
  if (!(bid > 0) || !(ask >= bid)) return null;
  return { bid, ask, timestamp };
}

/** Candle wajib lengkap; entri cacat dibuang dan dilaporkan sebagai warning. */
function mapCandle(raw: Raw, timeframeMs: number): Candle | null {
  const openTime = readNumber(raw, ['openTime', 'open_time', 'time', 't']);
  const open = readNumber(raw, ['open', 'o']);
  const high = readNumber(raw, ['high', 'h']);
  const low = readNumber(raw, ['low', 'l']);
  const close = readNumber(raw, ['close', 'c']);
  const volume = readNumber(raw, ['volume', 'tickVolume', 'tick_volume', 'v']);
  if (openTime === undefined || open === undefined || high === undefined) return null;
  if (low === undefined || close === undefined || volume === undefined) return null;
  return {
    openTime,
    closeTime: openTime + timeframeMs,
    open,
    high,
    low,
    close,
    volume,
  };
}

function envelope(
  status: MarketFeedEnvelope<ExnessFeedData>['status'],
  partial: Partial<MarketFeedEnvelope<ExnessFeedData>>,
  data: ExnessFeedData
): NextResponse {
  const payload: MarketFeedEnvelope<ExnessFeedData> = {
    ok: status === 'live',
    venue: 'exness',
    status,
    readOnly: true,
    fetchedAt: status === 'live' ? new Date().toISOString() : null,
    source: null,
    reason: null,
    requires: [],
    warnings: [],
    data,
    ...partial,
  };
  return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

function emptyData(symbol: string, timeframe: string, gateway: string | null): ExnessFeedData {
  return {
    symbol,
    timeframe,
    timeframeMs: TIMEFRAME_MS[timeframe] ?? 300_000,
    gateway,
    account: null,
    positions: [],
    quote: null,
    candles: [],
    riskPolicy: riskPolicyFromEnv(),
  };
}

function riskPolicyFromEnv(): ExnessRiskPolicy {
  return {
    dailyLossLimitPercent: readOptionalPercent(process.env.EXNESS_DAILY_LOSS_LIMIT_PERCENT) ?? 2,
    riskPercent: readOptionalPercent(process.env.EXNESS_RISK_PERCENT),
    riskCapPercent: readOptionalPercent(process.env.EXNESS_RISK_CAP_PERCENT),
    maxSpread: readOptionalPercent(process.env.EXNESS_MAX_SPREAD),
    minTickVolume: readOptionalPercent(process.env.EXNESS_MIN_TICK_VOLUME),
    valuePerUnit: readOptionalPercent(process.env.EXNESS_VALUE_PER_UNIT) ?? 1,
    note: 'Parameter risiko hanya diisi dari env/UI yang dikonfirmasi user; gate EA memblokir entry selama masih "—".',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gateway = process.env.EXNESS_GATEWAY_URL || null;
  const gatewayToken = process.env.EXNESS_GATEWAY_TOKEN;
  const symbol = (searchParams.get('symbol') || process.env.EXNESS_SYMBOL || 'XAUUSD').toUpperCase();
  const timeframe = (searchParams.get('timeframe') || process.env.EXNESS_TIMEFRAME || 'M5').toUpperCase();
  const timeframeMs = TIMEFRAME_MS[timeframe] ?? 300_000;
  const barsParam = Number(searchParams.get('bars'));
  const bars = Number.isFinite(barsParam) && barsParam > 0 ? Math.min(Math.floor(barsParam), 1000) : 300;

  if (!gateway) {
    return envelope('unconfigured', {
      reason:
        'Exness tidak menyediakan REST publik untuk akun trading. Isi EXNESS_GATEWAY_URL (bridge MT5/Exness milik Anda) agar feed akun, quote, dan candle XAUUSD bisa dibaca.',
      requires: REQUIRED_ENV,
    }, emptyData(symbol, timeframe, null));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (gatewayToken) headers.Authorization = `Bearer ${gatewayToken}`;
  const base = gateway.replace(/\/$/, '');
  const fetchApi = (path: string) =>
    fetch(`${base}${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });

  const [accountRes, positionsRes, quoteRes, candlesRes] = await Promise.allSettled([
    fetchApi('/account'),
    fetchApi('/positions'),
    fetchApi(`/quote?symbol=${encodeURIComponent(symbol)}`),
    fetchApi(`/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${bars}`),
  ]);

  const warnings: string[] = [];
  const jsonOf = async (settled: PromiseSettledResult<Response>, label: string): Promise<unknown> => {
    if (settled.status !== 'fulfilled') {
      warnings.push(`${label}: ${settled.reason instanceof Error ? settled.reason.message : 'gagal dihubungi'}`);
      return null;
    }
    if (!settled.value.ok) {
      warnings.push(`${label}: HTTP ${settled.value.status}`);
      return null;
    }
    try {
      return await settled.value.json();
    } catch {
      warnings.push(`${label}: respons bukan JSON valid`);
      return null;
    }
  };

  const [accountRaw, positionsRaw, quoteRaw, candlesRaw] = await Promise.all([
    jsonOf(accountRes, 'Akun'),
    jsonOf(positionsRes, 'Posisi'),
    jsonOf(quoteRes, 'Quote'),
    jsonOf(candlesRes, 'Candle'),
  ]);

  if (accountRaw === null && candlesRaw === null) {
    return envelope('unavailable', {
      reason: `Gateway Exness di ${base} tidak memberi data akun maupun candle. Tidak ada angka yang ditampilkan.`,
      source: base,
      requires: REQUIRED_ENV,
      warnings,
    }, emptyData(symbol, timeframe, base));
  }

  const account = mapAccount((accountRaw && typeof accountRaw === 'object' ? (accountRaw as Raw) : null));
  const positionsList = Array.isArray(positionsRaw)
    ? positionsRaw
    : Array.isArray((positionsRaw as Raw | null)?.positions)
      ? ((positionsRaw as Raw).positions as unknown[])
      : [];
  const positions = positionsList
    .filter((entry): entry is Raw => !!entry && typeof entry === 'object')
    .map(mapPosition)
    .filter((entry): entry is ExnessPosition => entry !== null);

  const quote = mapQuote(quoteRaw && typeof quoteRaw === 'object' ? (quoteRaw as Raw) : null);
  if (!quote) warnings.push('Quote tidak tersedia/valid — entry EA tetap diblokir.');

  const candleList = Array.isArray(candlesRaw)
    ? candlesRaw
    : Array.isArray((candlesRaw as Raw | null)?.candles)
      ? ((candlesRaw as Raw).candles as unknown[])
      : [];
  const mappedCandles = candleList
    .filter((entry): entry is Raw => !!entry && typeof entry === 'object')
    .map((entry) => mapCandle(entry, timeframeMs))
    .filter((entry): entry is Candle => entry !== null);
  const droppedCandles = candleList.length - mappedCandles.length;
  if (droppedCandles > 0) {
    warnings.push(`${droppedCandles} candle cacat dibuang (bukan diisi nilai default).`);
  }
  const candles = [...mappedCandles].sort((a, b) => a.openTime - b.openTime);

  return envelope('live', {
    source: base,
    warnings,
    requires: REQUIRED_ENV,
  }, {
    symbol,
    timeframe,
    timeframeMs,
    gateway: base,
    account,
    positions,
    quote,
    candles,
    riskPolicy: riskPolicyFromEnv(),
  });
}
