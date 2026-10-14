import { NextResponse } from 'next/server';
import { PREDICTION_MARKET_DURATION_SECONDS, filterFiveMinuteMarkets } from '@/lib/engine/paperTrading';
import type {
  MarketFeedEnvelope,
  PolymarketFeedData,
  PolymarketMarket,
  PolymarketOutcomePrice,
} from '@/lib/data/markets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/markets/polymarket
 *
 * Feed read-only untuk bot Prediction Market: menarik market dari Polymarket
 * Gamma API lalu menyaring crypto Up/Down berdurasi tepat 300 detik memakai
 * `filterFiveMinuteMarkets` dari ledger engine (satu sumber aturan filter).
 *
 * Anti-fabrikasi:
 *   - `outcomePrices`/`bestBid`/`bestAsk`/volume hanya diteruskan bila ada di feed.
 *   - Bila feed tidak menyertakan harga outcome, barisnya tetap tampil tapi
 *     harganya "—" (tidak ada probabilitas yang dikarang).
 *   - Tidak ada order maupun transaksi; bot hanya menampilkan peluang nyata.
 *
 * Query: `?token=btc&limit=200`
 * Env  : `POLYMARKET_GAMMA_BASE` (opsional)
 */

const DEFAULT_GAMMA_BASE = 'https://gamma-api.polymarket.com';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

type RawMarket = Record<string, unknown>;

const MATCH_RULE_BASE = [
  `durationSeconds === ${PREDICTION_MARKET_DURATION_SECONDS}`,
  'question|slug|category mengandung "up" atau "down"',
  'active !== false',
  'closed !== true',
];

function readString(raw: RawMarket, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function readNumber(raw: RawMarket, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric === 'number' && Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

/** Gamma mengirim array sebagai JSON-string; parse tanpa pernah mengarang isi. */
function readStringArray(raw: RawMarket, key: string): string[] {
  const value = raw[key];
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

function readNumberArray(raw: RawMarket, key: string): number[] {
  const values = readStringArray(raw, key);
  return values
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function readBoolean(raw: RawMarket, key: string): boolean | undefined {
  const value = raw[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function mapMarket(raw: RawMarket): PolymarketMarket | null {
  const id = readString(raw, ['id', 'conditionId']);
  if (!id) return null;

  const startDate = readString(raw, ['startDate', 'start_date']) ?? null;
  const endDate = readString(raw, ['endDate', 'end_date', 'endDateIso']) ?? null;
  const startMs = startDate ? Date.parse(startDate) : Number.NaN;
  const endMs = endDate ? Date.parse(endDate) : Number.NaN;
  const durationSeconds =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? (endMs - startMs) / 1000
      : readNumber(raw, ['duration', 'durationSeconds']);

  const outcomeLabels = readStringArray(raw, 'outcomes');
  const outcomePrices = readNumberArray(raw, 'outcomePrices');
  const outcomes: PolymarketOutcomePrice[] = outcomeLabels.map((outcome, index) => ({
    outcome,
    price: index < outcomePrices.length ? outcomePrices[index] : null,
  }));

  const slug = readString(raw, ['slug']);

  return {
    id,
    question: readString(raw, ['question', 'title']),
    slug,
    category: readString(raw, ['category']),
    startDate,
    endDate,
    durationSeconds,
    outcomes,
    volume24h: readNumber(raw, ['volume24hr', 'volume24h']),
    volume: readNumber(raw, ['volume']),
    liquidity: readNumber(raw, ['liquidity', 'liquidityNum']),
    bestBid: readNumber(raw, ['bestBid']) ?? null,
    bestAsk: readNumber(raw, ['bestAsk']) ?? null,
    spread: readNumber(raw, ['spread']) ?? null,
    url: slug ? `https://polymarket.com/event/${slug}` : null,
  };
}

function unavailable(message: string): NextResponse {
  const payload: MarketFeedEnvelope<PolymarketFeedData> = {
    ok: false,
    venue: 'polymarket',
    status: 'unavailable',
    readOnly: true,
    fetchedAt: null,
    source: null,
    reason: message,
    requires: [],
    warnings: [],
    data: { markets: [], matchRule: MATCH_RULE_BASE.join(' && '), scannedCount: 0, token: null },
  };
  return NextResponse.json(payload, { status: 200 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gammaBase = process.env.POLYMARKET_GAMMA_BASE || DEFAULT_GAMMA_BASE;
  const token = (searchParams.get('token') || '').trim().toLowerCase() || null;
  const limitParam = Number(searchParams.get('limit'));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const matchRule = [...MATCH_RULE_BASE, ...(token ? [`text.includes("${token}")`] : [])].join(' && ');

  try {
    const query = new URLSearchParams({
      closed: 'false',
      active: 'true',
      limit: String(limit),
      order: 'volume24hr',
      ascending: 'false',
    });
    const res = await fetch(`${gammaBase}/markets?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return unavailable(`Polymarket Gamma merespons HTTP ${res.status} — pasar tidak dapat ditampilkan.`);
    }

    const raw = await res.json();
    const rawMarkets: RawMarket[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const mapped = rawMarkets.map(mapMarket).filter((market): market is PolymarketMarket => market !== null);
    const filtered = filterFiveMinuteMarkets(mapped, token ?? undefined) as PolymarketMarket[];
    const markets = [...filtered].sort((a, b) => (b.volume24h ?? b.volume ?? 0) - (a.volume24h ?? a.volume ?? 0));

    const warnings: string[] = [];
    const withoutPrices = markets.filter((market) => market.outcomes.every((outcome) => outcome.price === null));
    if (withoutPrices.length > 0) {
      warnings.push(
        `${withoutPrices.length} pasar aktif tidak menyertakan harga outcome di feed — kolom harga dibiarkan "—".`,
      );
    }

    const payload: MarketFeedEnvelope<PolymarketFeedData> = {
      ok: true,
      venue: 'polymarket',
      status: 'live',
      readOnly: true,
      fetchedAt: new Date().toISOString(),
      source: `${gammaBase}/markets`,
      reason: null,
      requires: [],
      warnings,
      data: { markets, matchRule, scannedCount: mapped.length, token },
    };
    return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'kesalahan tidak diketahui';
    return unavailable(
      `Tidak dapat menghubungi Polymarket Gamma (${message}). Pasar tidak ditampilkan, probabilitas tidak dikira-kira.`,
    );
  }
}
