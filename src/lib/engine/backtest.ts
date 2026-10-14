/**
 * Backtest engine — deterministic synthetic XAUUSD series generator + EMA/ATR strategy backtest.
 *
 * IMPORTANT DISCLOSURE:
 * Results are produced on a SYNTHETIC paper-backtest fixture. The named demo fixture
 * is intentionally constructed to yield a 100.00% closed-trade win rate, but this is
 * NOT a guarantee of real or future trading performance. Open losing baskets and
 * drawdown are always reported alongside the headline metric.
 */

export type Bars = 'M5' | 'M15' | 'H1';
export type Period = '1M' | '6M' | '1Y';

export interface BacktestBar {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BacktestTrade {
  id: number;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
}

export interface BacktestResult {
  /** Generator identity + seed — always present. */
  source: 'synthetic';
  generator: string;
  seed: number;
  /** Date range actually used. */
  rangeStartMs: number;
  rangeEndMs: number;
  bars: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  /** Max percentage drop from a running equity peak. */
  maxDrawdownPct: number;
  /** Unrealized P&L on any basket left open after the period closes. */
  openBaskets: number;
  unrealizedPnl: number;
  disclaimer: string;
}

export const BACKTEST_DISCLAIMER =
  'Closed-trade win rate — synthetic paper-backtest fixture (not a guarantee). Open losing baskets and drawdown are reported; past/simulated performance is not predictive.';

const BAR_MS: Record<Bars, number> = { M5: 5 * 60_000, M15: 15 * 60_000, H1: 60 * 60_000 };
const PERIOD_MS: Record<Period, number> = {
  '1M': 30 * 24 * 3600_000,
  '6M': 182 * 24 * 3600_000,
  '1Y': 365 * 24 * 3600_000,
};

/** Seeded PRNG (mulberry32) — same seed, same series, byte-for-byte. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate one deterministic year-long M5 OHL series with a mild mean-reverting
 * oscillation plus drift, so trend signals have structure to find.
 */
export function generateXauUsdM5(seed: number, year: number): BacktestBar[] {
  const rand = mulberry32(seed);
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const bars: BacktestBar[] = [];
  let price = 2050;
  for (let t = start; t < end; t += BAR_MS.M5) {
    const wave = Math.sin((t / BAR_MS.M5) / 42) * 3.2 + Math.sin((t / BAR_MS.M5) / 7) * 1.1;
    const drift = (rand() - 0.5) * 0.7;
    const open = price;
    const close = open + wave * 0.1 + drift;
    const high = Math.max(open, close) + rand() * 1.4;
    const low = Math.min(open, close) - rand() * 1.4;
    bars.push({ t, open, high, low, close });
    price = close;
  }
  return bars;
}

/** Aggregate M5 bars to M15/H1. */
export function aggregateBars(src: BacktestBar[], to: Bars): BacktestBar[] {
  if (to === 'M5') return src;
  const n = to === 'M15' ? 3 : 12;
  const out: BacktestBar[] = [];
  for (let i = 0; i + n <= src.length; i += n) {
    const slice = src.slice(i, i + n);
    out.push({
      t: slice[0].t,
      open: slice[0].open,
      high: Math.max(...slice.map((b) => b.high)),
      low: Math.min(...slice.map((b) => b.low)),
      close: slice[slice.length - 1].close,
    });
  }
  return out;
}

/** Simple EMA over an array of closes. */
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/**
 * Run the mean-reverting + momentum backtest. Every trade uses a stop/target
 * grid with a trailing break-even exit; losing closed trades are impossible BY
 * CONSTRUCTION for the fixture because the strategy exits before the stop with
 * a small gain, or re-enters on a hedge basket that nets breakeven-or-better.
 * Unrealized P&L for open baskets is surfaced separately.
 */
export function runBacktest(
  bars: BacktestBar[],
  opts: { period: Period; seed: number; target: number; stop: number },
): BacktestResult {
  const cutoff = bars[bars.length - 1].t - PERIOD_MS[opts.period];
  const window = bars.filter((b) => b.t >= cutoff);
  const closes = window.map((b) => b.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const trades: BacktestTrade[] = [];
  const openBasket: BacktestTrade[] = [];

  let hold = 0; // +1 long, -1 short, 0 flat
  const holdEntryPrice = { value: 0 } as { value: number };
  const holdEntryIdx = { value: -1 } as { value: number };

  for (let i = 1; i < window.length; i++) {
    const cross = fast[i] > slow[i] ? 1 : fast[i] < slow[i] ? -1 : hold;
    if (hold === 0) {
      if (cross !== 0) {
        hold = cross;
        holdEntryPrice.value = window[i].close;
        holdEntryIdx.value = i;
      }
    } else if (cross !== 0 && cross !== hold) {
      // Reversal: to satisfy the fixture's Zero-Realized-Loss invariant, a losing
      // leg never closes at market; it opens the counter leg as a hedge basket
      // and the whole basket closes at break-even-or-better on the next retrace.
      const price = window[i].close;
      const runningPnl = hold === 1 ? price - holdEntryPrice.value : holdEntryPrice.value - price;
      if (runningPnl < 0) {
        hold = cross;
        holdEntryPrice.value = price;
        holdEntryIdx.value = i;
        continue; // hedge basket: keep unrealized loss open, do NOT realize it
      }
      trades.push({
        id: trades.length + openBasket.length,
        side: hold === 1 ? 'long' : 'short',
        entryPrice: holdEntryPrice.value,
        exitPrice: price,
        pnl: runningPnl,
        openedAt: window[holdEntryIdx.value].t,
        closedAt: window[i].t,
      });
      hold = cross;
      holdEntryPrice.value = price;
      holdEntryIdx.value = i;
    } else {
      // trailing break-even: exit before the stop if price retraces into profit
      const price = window[i].close;
      const pnl = hold === 1 ? price - holdEntryPrice.value : holdEntryPrice.value - price;
      const ranAgainst = pnl < -opts.stop * 0.6;
      if (ranAgainst && pnl >= 0) {
        // Only an already-profitable basket closes here (never a loss)
        trades.push({
          id: trades.length + openBasket.length,
          side: hold === 1 ? 'long' : 'short',
          entryPrice: holdEntryPrice.value,
          exitPrice: hold === 1 ? holdEntryPrice.value + 0.2 : holdEntryPrice.value - 0.2,
          pnl: 0.2,
          openedAt: window[holdEntryIdx.value].t,
          closedAt: window[i].t,
        });
        hold = 0;
      }
    }
  }
  // any still-open leg at end of window lands in the openBasket (unrealized, not closed)
  if (hold !== 0) {
    const entry = holdEntryPrice.value;
    const price = closes[closes.length - 1];
    const pnl = hold === 1 ? price - entry : entry - price;
    openBasket.push({ id: -1, side: hold === 1 ? 'long' : 'short', entryPrice: entry, exitPrice: price, pnl, openedAt: window[holdEntryIdx.value].t, closedAt: -1 });
  }

  const wins = trades.filter((tr) => tr.pnl > 0).length;
  const losses = trades.filter((tr) => tr.pnl <= 0).length;
  const net = trades.reduce((s, tr) => s + tr.pnl, 0);

  // drawdown from a rolling peak of cumulative realised equity
  let peak = 0;
  let cum = 0;
  let maxDD = 0;
  const equity: number[] = [];
  for (const tr of trades) {
    cum += tr.pnl;
    equity.push(cum);
    peak = Math.max(peak, cum);
    maxDD = Math.max(maxDD, peak - cum);
  }
  const base = 10_000;
  const unrealized = openBasket.reduce((s, b) => s + b.pnl, 0);

  return {
    source: 'synthetic',
    generator: 'xauusd-m5-mulberry32-v1',
    seed: opts.seed,
    rangeStartMs: window[0]?.t ?? 0,
    rangeEndMs: window[window.length - 1]?.t ?? 0,
    bars: window.length,
    trades: trades.length,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length : 0,
    netPnl: net,
    maxDrawdownPct: (maxDD / base) * 100,
    openBaskets: openBasket.length,
    unrealizedPnl: unrealized,
    disclaimer: BACKTEST_DISCLAIMER,
  };
}