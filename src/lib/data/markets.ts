/**
 * Kantor Raffa — Market Feed Contracts (Trading Bot Division)
 *
 * Kontrak respons untuk feed read-only yang dikonsumsi TradingBotsModal dan tab
 * bawahan bot trading:
 *   - GET /api/markets/meteora
 *   - GET /api/markets/polymarket
 *   - GET /api/markets/exness
 *
 * Tipe analitik (pool Meteora, candle, quote) diambil dari ledger engine
 * `src/lib/engine/paperTrading.ts` supaya UI bisa langsung memakai fungsi murni
 * di sana (rankMeteoraPools, evaluateEmaAtrSignal, evaluateEaEntry, dst) tanpa
 * mentransformasi ulang angka.
 *
 * ATURAN ANTI-FABRIKASI:
 *   1. Field harga/nilai boleh `null`/`undefined` = "tidak diketahui". UI WAJIB
 *      menampilkan "—"; dilarang menulis 0, estimasi, atau angka contoh.
 *   2. Tidak ada harga yang digenerate di komponen. Angka hanya boleh berasal
 *      dari respons feed, atau dari input manual user yang selalu dilabeli
 *      "harga manual user".
 *   3. Feed bersifat read-only: tanpa eksekusi order, tanpa transaksi on-chain.
 */

import type { Candle, EaSignalResult, MeteoraPool as MeteoraPoolAnalytics, Quote } from '../engine/paperTrading';

export type MarketVenue = 'meteora' | 'polymarket' | 'exness';

/**
 * `live`         → data pasar nyata berhasil diambil dari feed/gateway.
 * `unconfigured` → butuh env/kredensial yang belum diisi (belum ada data sama sekali).
 * `unavailable`  → feed tidak bisa dihubungi pada saat request.
 * `error`        → respons tidak valid / gagal diparse.
 */
export type MarketFeedStatus = 'unconfigured' | 'unavailable' | 'error' | 'live';

export interface MarketFeedEnvelope<T> {
  ok: boolean;
  venue: MarketVenue;
  status: MarketFeedStatus;
  readOnly: true;
  /** ISO time saat data benar-benar diambil dari sumber. `null` bila tidak ada fetch nyata. */
  fetchedAt: string | null;
  /** Nama sumber/gateway yang dipakai. */
  source: string | null;
  /** Penjelasan manusiawi saat status bukan `live`. */
  reason: string | null;
  /** Env var yang harus diisi agar feed aktif. */
  requires: string[];
  /** Catatan non-fatal (mis. sebagian sub-request gagal). */
  warnings: string[];
  data: T;
}

export const MARKET_FEED_ENDPOINTS: Record<MarketVenue, string> = {
  meteora: '/api/markets/meteora',
  polymarket: '/api/markets/polymarket',
  exness: '/api/markets/exness',
};

export const VENUE_LABEL: Record<MarketVenue, string> = {
  meteora: 'Meteora DLMM',
  polymarket: 'Polymarket Gamma',
  exness: 'Exness Gateway',
};

/** Id bot di `AGENTS` → venue feed terkait. Bot lain tidak punya feed pasar. */
export const BOT_VENUE_MAP: Record<string, MarketVenue> = {
  'altair-raditya': 'meteora',
  'kenzo-danendra': 'polymarket',
  'damian-prasetya': 'exness',
};

export function venueForBot(botId?: string | null): MarketVenue | null {
  if (!botId) return null;
  return BOT_VENUE_MAP[botId] ?? null;
}

export const MARKET_STATUS_META: Record<
  MarketFeedStatus,
  { label: string; color: string; bg: string; border: string; hint: string }
> = {
  live: {
    label: 'Feed Live',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.4)',
    hint: 'Data nyata dari feed read-only.',
  },
  unconfigured: {
    label: 'Belum Dikonfigurasi',
    color: '#fcd34d',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.4)',
    hint: 'Env/gateway belum diisi — belum ada data yang bisa ditampilkan.',
  },
  unavailable: {
    label: 'Tidak Tersedia',
    color: '#fb7185',
    bg: 'rgba(244, 63, 94, 0.14)',
    border: 'rgba(244, 63, 94, 0.4)',
    hint: 'Feed tidak dapat dihubungi. Nilai ditampilkan "—" dan tidak dikira-kira.',
  },
  error: {
    label: 'Gagal Memuat',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.14)',
    border: 'rgba(248, 113, 113, 0.4)',
    hint: 'Respons feed tidak valid sehingga diabaikan.',
  },
};

export const MARKET_DISCLAIMER =
  'Read-only · tanpa eksekusi order · tanpa transaksi on-chain · nilai yang tidak diketahui selalu ditampilkan "—".';

// ---------------------------------------------------------------------------
// Meteora (Solana DLMM) — analitik memakai rankMeteoraPools() dari ledger engine
// ---------------------------------------------------------------------------

/**
 * Baris pool untuk UI. `tvl`/`fee24h`/`fees24h`/`volume24h` sengaja opsional
 * (undefined = tidak diketahui) agar dapat langsung diberikan ke
 * `rankMeteoraPools`. `feeTvlRatio` hanya terisi untuk pool yang lolos ranking.
 */
export interface MeteoraPool extends MeteoraPoolAnalytics {
  address: string;
  name: string;
  binStep?: number | null;
  baseFeePct?: number | null;
  aprPct?: number | null;
  priceUsd?: number | null;
  feeTvlRatio?: number | null;
}

export interface MeteoraFeedData {
  pools: MeteoraPool[];
  /** Jumlah pool yang dipindai dari feed sebelum difilter/dipotong. */
  poolCount: number;
  /** Jumlah pool yang punya TVL & fee valid sehingga masuk ranking. */
  rankedCount: number;
  /** Plafon TVL minimum yang dipakai route saat memanggil rankMeteoraPools. */
  minTvl: number;
}

// ---------------------------------------------------------------------------
// Polymarket (prediction market 5 menit) — filter memakai filterFiveMinuteMarkets()
// ---------------------------------------------------------------------------

export interface PolymarketOutcomePrice {
  /** Label outcome apa adanya dari feed ("Up", "Down", angka, dst). */
  outcome: string;
  /** Harga kontrak 0..1 dari feed. `null` bila feed tidak menyertakan. */
  price: number | null;
}

export interface PolymarketMarket {
  id: string;
  question?: string;
  slug?: string;
  category?: string;
  startDate?: string | null;
  endDate?: string | null;
  durationSeconds?: number;
  active?: boolean;
  closed?: boolean;
  outcomes: PolymarketOutcomePrice[];
  volume24h?: number;
  volume?: number;
  liquidity?: number;
  bestBid?: number | null;
  bestAsk?: number | null;
  spread?: number | null;
  url?: string | null;
}

export interface PolymarketFeedData {
  markets: PolymarketMarket[];
  /** Filter yang benar-benar dipakai server — ditampilkan apa adanya di UI. */
  matchRule: string;
  /** Jumlah market mentah yang dipindai sebelum filter. */
  scannedCount: number;
  /** Token filter aktif (mis. "btc"), `null` bila tidak ada. */
  token: string | null;
}

// ---------------------------------------------------------------------------
// Exness (XAUUSD demo via gateway/bridge) — sinyal & gate dihitung di UI
// ---------------------------------------------------------------------------

export interface ExnessAccount {
  login: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  freeMargin: number | null;
  leverage: number | null;
}

export interface ExnessPosition {
  ticket: string | null;
  symbol: string | null;
  side: 'BUY' | 'SELL' | null;
  volume: number | null;
  openPrice: number | null;
  currentPrice: number | null;
  profit: number | null;
  openTime: string | null;
}

/**
 * Kebijakan risiko EA. Semua field numerik `null` berarti belum dikonfirmasi —
 * `evaluateEaEntry` akan memblokir entry dan menyebut alasannya apa adanya.
 */
export interface ExnessRiskPolicy {
  dailyLossLimitPercent: number;
  riskPercent: number | null;
  riskCapPercent: number | null;
  maxSpread: number | null;
  minTickVolume: number | null;
  valuePerUnit: number;
  note: string;
}

export interface ExnessFeedData {
  symbol: string;
  timeframe: string;
  timeframeMs: number;
  gateway: string | null;
  account: ExnessAccount | null;
  positions: ExnessPosition[];
  /** Quote terbaru dari gateway. `null` bila belum ada. */
  quote: Quote | null;
  /** Candle dari gateway; sudah dibersihkan dari entri non-finite. */
  candles: Candle[];
  riskPolicy: ExnessRiskPolicy;
}

/** Hasil evaluasi sinyal EA yang ditampilkan UI (dihitung dari candle nyata). */
export interface ExnessSignalView {
  result: EaSignalResult;
  /** null bila candle belum cukup — UI menampilkan alasan `result.reason`. */
  asOf: string | null;
  lastClose: number | null;
  quoteAgeMs: number | null;
  quoteStale: boolean;
}

// ---------------------------------------------------------------------------
// Formatter murni (tidak pernah membuat angka)
// ---------------------------------------------------------------------------

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Nilai/harga pasar dianggap valid hanya bila angka finite dan > 0. */
export function isUsablePrice(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

export function formatPrice(value: number | null | undefined, maxDigits = 8): string {
  if (!isFiniteNumber(value)) return '—';
  const abs = Math.abs(value);
  let digits = maxDigits;
  if (abs >= 1000) digits = 2;
  else if (abs >= 1) digits = Math.min(maxDigits, 4);
  else if (abs >= 0.01) digits = Math.min(maxDigits, 6);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatUsd(
  value: number | null | undefined,
  opts: { compact?: boolean; digits?: number } = {}
): string {
  if (!isFiniteNumber(value)) return '—';
  if (opts.compact) {
    return `$${new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value)}`;
  }
  const digits = opts.digits ?? 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** `value` sudah dalam satuan persen. */
export function formatPct(value: number | null | undefined, digits = 2): string {
  if (!isFiniteNumber(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** Rasio desimal → persen (0.0012 → 0.120%). */
export function formatRatioPct(value: number | null | undefined, digits = 3): string {
  if (!isFiniteNumber(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (!isFiniteNumber(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} detik`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit`;
  return `${(seconds / 3600).toFixed(1)} jam`;
}

/** Untuk harga kontrak prediksi (0..1) ditampilkan sekaligus sebagai persen. */
export function formatProbability(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatAge(ms: number | null | undefined): string {
  if (!isFiniteNumber(ms)) return '—';
  if (ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} menit`;
}

/** Label arah posisi paper: long/yes = naik, short/no = turun. */
export function sideLabel(side: 'BUY' | 'SELL'): string {
  return side === 'BUY' ? 'BUY / naik' : 'SELL / turun';
}
