/**
 * Deterministic synthetic XAUUSD ATR-grid basket backtest.
 * Prices are generated, not market history. EMA crossover entries and ATR grid
 * additions execute at the next bar open, without looking ahead. A basket only
 * closes when its aggregate profit covers spread, slippage, and commissions.
 * Losing open baskets remain marked to market: a high closed-basket win rate
 * does NOT imply positive equity or bounded risk. At most six equal-sized legs
 * may be open; there is no martingale sizing or hidden forced loss deletion.
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
  /** Fill price including spread and slippage. */
  entryPrice: number;
  /** Fill price including spread and slippage (or limit level for target exits). */
  exitPrice: number;
  /** P&L at mid prices before costs. */
  grossPnl: number;
  /** Total modeled cost (grossPnl - pnl). */
  costs: number;
  /** Net realized P&L after all modeled costs. */
  pnl: number;
  exitReason: 'basket-target';
  openedAt: number;
  closedAt: number;
}

export interface BacktestCostModel {
  spread: number;
  slippage: number;
  commissionPerSide: number;
  units: number;
  initialEquity: number;
}

export interface EquityPoint {
  t: number;
  /** initialEquity + realized + unrealized. */
  equity: number;
  realized: number;
  unrealized: number;
}

export interface BacktestOptions {
  period: Period;
  seed: number;
  target: number;
  /** Grid spacing as a multiple of the preceding completed bar's ATR(14). */
  gridAtrMultiplier: number;
  /** Expected bar timeframe. If provided it must match the bars' spacing. */
  timeframe?: Bars;
  /** Price units (USD per oz for XAUUSD). Default 0.30. */
  spread?: number;
  /** Price units per market fill. Default 0.05. */
  slippage?: number;
  /** Currency units per side per `units`. Default 0. */
  commissionPerSide?: number;
  /** Position size in ounces. Default 1. */
  units?: number;
  /** Starting equity in currency units. Default 10000. */
  initialEquity?: number;
}

export interface BacktestResult {
  source: 'synthetic';
  generator: string;
  seed: number;
  period: Period | null;
  timeframe: Bars | null;
  /** Date range actually used (ms since epoch). */
  rangeStartMs: number;
  rangeEndMs: number;
  /** Bars inside the period window (EMA input). */
  bars: number;
  /** Equity samples (one per window bar). Equals `bars`. */
  sampleCount: number;
  /** Bars before the slow EMA is fully warmed up (no signals allowed). */
  warmupBars: number;
  trades: number;
  wins: number;
  losses: number;
  /** Closed-trade win rate in [0,1]. 0 when there are no trades. */
  winRate: number;
  grossPnl: number;
  costs: number;
  /** Realized net P&L of closed trades (same as netPnl). */
  realizedPnl: number;
  netPnl: number;
  /** Unrealized net P&L of the open position at period end (0 if flat). */
  unrealizedPnl: number;
  openBaskets: number;
  finalEquity: number;
  /** Max peak-to-trough drop of the mark-to-market equity curve, in percent. */
  maxDrawdownPct: number;
  equityCurve: EquityPoint[];
  tradeLog: BacktestTrade[];
  costModel: BacktestCostModel;
  /** Hard errors. Result is empty/invalid when non-empty. */
  errors: string[];
  /** Non-fatal notices about the input or window. */
  warnings: string[];
  disclaimer: string;
}

export const BACKTEST_DISCLAIMER =
  'Synthetic ATR Grid / Never-Close-Loss basket simulation, not historical market data or a profit guarantee. Closed-basket win rate excludes open losses; equity and drawdown include them. Up to six equal-sized grid legs; fixed spread, slippage and commissions. No stop loss: sustained trends can exhaust the account. Swaps, margin liquidation and real liquidity are not modeled.';

const GENERATOR = 'xauusd-m5-mulberry32-v3';
const FAST_PERIOD = 12;
const SLOW_PERIOD = 26;
const DAY_MS = 86_400_000;
const BAR_MS: Record<Bars, number> = { M5: 300_000, M15: 900_000, H1: 3_600_000 };
const PERIOD_MS: Record<Period, number> = { '1M': 30 * DAY_MS, '6M': 182 * DAY_MS, '1Y': 365 * DAY_MS };
const TIMEFRAMES: readonly Bars[] = ['M5', 'M15', 'H1'];
const PERIODS: readonly Period[] = ['1M', '6M', '1Y'];
const DEFAULTS = { spread: 0.3, slippage: 0.05, commissionPerSide: 0, units: 1, initialEquity: 10_000 } as const;

/** Seeded PRNG (mulberry32) - same seed, same series, byte-for-byte. */
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

/** Deterministic year of M5 synthetic bars (mean-reverting wave + drift). */
export function generateXauUsdM5(seed: number, year: number): BacktestBar[] {
  if (!Number.isFinite(seed) || !Number.isInteger(year) || year < 1 || year > 9998) return [];
  const rand = mulberry32(seed);
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const bars: BacktestBar[] = [];
  let price = 2050;
  for (let t = start, i = 0; t < end; t += BAR_MS.M5, i++) {
    const wave = Math.sin(i / 42) * 3.2 + Math.sin(i / 7) * 1.1;
    const open = price;
    const close = open + wave * 0.1 + (rand() - 0.5) * 0.7;
    bars.push({ t, open, high: Math.max(open, close) + rand() * 1.4, low: Math.min(open, close) - rand() * 1.4, close });
    price = close;
  }
  return bars;
}

/** Aggregate M5 bars to M15/H1. Bars that are invalid or incomplete are skipped. */
export function aggregateBars(src: BacktestBar[], to: Bars): BacktestBar[] {
  if (!Array.isArray(src) || !TIMEFRAMES.includes(to)) return [];
  if (to === 'M5') return src.slice();
  const n = to === 'M15' ? 3 : 12;
  const out: BacktestBar[] = [];
  for (let i = 0; i + n <= src.length; i += n) {
    const slice = src.slice(i, i + n);
    if (!slice.every(validBar)) continue;
    out.push({
      t: slice[0].t,
      open: slice[0].open,
      high: Math.max(...slice.map((b) => b.high)),
      low: Math.min(...slice.map((b) => b.low)),
      close: slice[n - 1].close,
    });
  }
  return out;
}

function validBar(b: BacktestBar): boolean {
  return (
    !!b &&
    Number.isFinite(b.t) &&
    Number.isFinite(b.open) &&
    Number.isFinite(b.high) &&
    Number.isFinite(b.low) &&
    Number.isFinite(b.close) &&
    b.high >= Math.max(b.open, b.close, b.low) &&
    b.low <= Math.min(b.open, b.close, b.high)
  );
}

/** Simple EMA over an array of values. Returns [] for invalid input. */
export function ema(values: number[], period: number): number[] {
  if (!Number.isInteger(period) || period < 1 || !Array.isArray(values) || values.some((v) => !Number.isFinite(v))) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

interface Config {
  period: Period;
  seed: number;
  target: number;
  gridAtrMultiplier: number;
  spread: number;
  slippage: number;
  commissionPerSide: number;
  units: number;
  initialEquity: number;
}

function costModelOf(cfg: Config | null): BacktestCostModel {
  return {
    spread: cfg?.spread ?? DEFAULTS.spread,
    slippage: cfg?.slippage ?? DEFAULTS.slippage,
    commissionPerSide: cfg?.commissionPerSide ?? DEFAULTS.commissionPerSide,
    units: cfg?.units ?? DEFAULTS.units,
    initialEquity: cfg?.initialEquity ?? DEFAULTS.initialEquity,
  };
}

function resolveConfig(opts: BacktestOptions | undefined, errors: string[]): Config | null {
  if (!opts) {
    errors.push('options object is required');
    return null;
  }
  const before = errors.length;
  if (!PERIODS.includes(opts.period)) errors.push(`unsupported period: ${String(opts.period)}`);
  if (!Number.isFinite(opts.seed)) errors.push('seed must be a finite number');
  if (!Number.isFinite(opts.target) || opts.target <= 0) errors.push('target must be a positive finite number');
  if (!Number.isFinite(opts.gridAtrMultiplier) || opts.gridAtrMultiplier <= 0) errors.push('gridAtrMultiplier must be a positive finite number');
  if (opts.timeframe !== undefined && !TIMEFRAMES.includes(opts.timeframe)) errors.push(`unsupported timeframe: ${String(opts.timeframe)}`);

  const cfg: Config = {
    period: opts.period,
    seed: opts.seed,
    target: opts.target,
    gridAtrMultiplier: opts.gridAtrMultiplier,
    spread: opts.spread ?? DEFAULTS.spread,
    slippage: opts.slippage ?? DEFAULTS.slippage,
    commissionPerSide: opts.commissionPerSide ?? DEFAULTS.commissionPerSide,
    units: opts.units ?? DEFAULTS.units,
    initialEquity: opts.initialEquity ?? DEFAULTS.initialEquity,
  };
  if (!Number.isFinite(cfg.spread) || cfg.spread < 0) errors.push('spread must be a finite number >= 0');
  if (!Number.isFinite(cfg.slippage) || cfg.slippage < 0) errors.push('slippage must be a finite number >= 0');
  if (!Number.isFinite(cfg.commissionPerSide) || cfg.commissionPerSide < 0) errors.push('commissionPerSide must be a finite number >= 0');
  if (!Number.isFinite(cfg.units) || cfg.units <= 0) errors.push('units must be a positive finite number');
  if (!Number.isFinite(cfg.initialEquity) || cfg.initialEquity <= 0) errors.push('initialEquity must be a positive finite number');
  return errors.length > before ? null : cfg;
}

/** Validates and sorts bars; drops invalid bars (warning); rejects duplicate timestamps (error). */
function normalizeBars(input: BacktestBar[], errors: string[], warnings: string[]): BacktestBar[] {
  if (!Array.isArray(input)) {
    errors.push('bars must be an array');
    return [];
  }
  const valid = input.filter(validBar);
  const dropped = input.length - valid.length;
  if (dropped > 0) warnings.push(`dropped ${dropped} invalid bar(s) (non-finite or inconsistent OHLC)`);
  const sorted = valid.slice().sort((a, b) => a.t - b.t);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t === sorted[i - 1].t) {
      errors.push(`duplicate bar timestamp: ${sorted[i].t}`);
      break;
    }
  }
  if (sorted.length === 0) errors.push('no valid bars');
  return sorted;
}

/** Infers timeframe from uniform bar spacing and checks it against the requested timeframe. */
function inferTimeframe(bars: BacktestBar[], requested: Bars | undefined, errors: string[], warnings: string[]): Bars | null {
  let inferred: Bars | null = null;
  if (bars.length >= 2) {
    const step = bars[1].t - bars[0].t;
    for (let i = 2; i < bars.length; i++) {
      if (bars[i].t - bars[i - 1].t !== step) {
        errors.push(`non-uniform bar spacing at index ${i}`);
        break;
      }
    }
    inferred = TIMEFRAMES.find((tf) => BAR_MS[tf] === step) ?? null;
    if (!inferred && errors.length === 0) errors.push(`bar spacing ${step} ms matches no supported timeframe`);
  } else if (bars.length === 1) {
    warnings.push('single bar: timeframe taken from request');
  }
  if (requested !== undefined && inferred !== null && requested !== inferred) {
    errors.push(`requested timeframe ${requested} does not match input spacing (${inferred})`);
  }
  const resolved = requested ?? inferred;
  if (!resolved) errors.push('timeframe could not be determined');
  return resolved;
}

interface OpenPosition {
  side: 1 | -1;
  entryFill: number;
  entryMid: number;
  openedAt: number;
}

interface SimOutput {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  open: boolean;
}

/** ATR uses only completed bars; every order decided at close fills next open. */
function simulate(window: BacktestBar[], fast: number[], slow: number[], cfg: Config): SimOutput {
  const marketCost = cfg.spread / 2 + cfg.slippage;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  const legs: OpenPosition[] = [];
  let pending: 1 | -1 | 0 = 0;
  let closePending = false;
  let realized = 0;
  let atr = 0;

  const basketPnl = (mid: number): number => {
    let pnl = 0;
    for (const leg of legs) {
      const exitFill = mid - leg.side * marketCost;
      pnl += (exitFill - leg.entryFill) * leg.side * cfg.units - 2 * cfg.commissionPerSide;
    }
    return pnl;
  };

  for (let j = 0; j < window.length; j++) {
    const bar = window[j];
    // Re-check after opening gaps. Never manufacture a profitable fill when the
    // actual next open cannot cover all entry and exit costs.
    if (closePending && legs.length && basketPnl(bar.open) >= cfg.target) {
      const first = legs[0];
      let entryMid = 0;
      let entryFill = 0;
      for (const leg of legs) {
        entryMid += leg.entryMid;
        entryFill += leg.entryFill;
      }
      entryMid /= legs.length;
      entryFill /= legs.length;
      const grossPnl = (bar.open - entryMid) * first.side * cfg.units * legs.length;
      const pnl = basketPnl(bar.open);
      realized += pnl;
      trades.push({
        id: trades.length + 1,
        side: first.side === 1 ? 'long' : 'short',
        entryPrice: entryFill,
        exitPrice: bar.open - first.side * marketCost,
        grossPnl,
        costs: grossPnl - pnl,
        pnl,
        exitReason: 'basket-target',
        openedAt: first.openedAt,
        closedAt: bar.t,
      });
      legs.length = 0;
      pending = 0;
    }
    closePending = false;
    if (pending && legs.length < 6) {
      legs.push({ side: pending, entryMid: bar.open, entryFill: bar.open + pending * marketCost, openedAt: bar.t });
    }
    pending = 0;

    const previousClose = j ? window[j - 1].close : bar.open;
    const trueRange = Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
    atr = j < 14 ? (atr * j + trueRange) / (j + 1) : (atr * 13 + trueRange) / 14;
    const unrealized = basketPnl(bar.close);
    equityCurve.push({ t: bar.t, equity: cfg.initialEquity + realized + unrealized, realized, unrealized });

    if (j < SLOW_PERIOD || j + 1 >= window.length) continue;
    if (legs.length) {
      closePending = unrealized >= cfg.target;
      const last = legs[legs.length - 1];
      if (!closePending && legs.length < 6 && atr > 0 &&
          (last.entryMid - bar.close) * last.side >= atr * cfg.gridAtrMultiplier) {
        pending = last.side;
      }
    } else {
      const prior = fast[j - 1] - slow[j - 1];
      const current = fast[j] - slow[j];
      pending = prior <= 0 && current > 0 ? 1 : prior >= 0 && current < 0 ? -1 : 0;
    }
  }
  return { trades, equityCurve, open: legs.length > 0 };
}

function emptyResult(
  seed: number,
  period: Period | null,
  timeframe: Bars | null,
  cfg: Config | null,
  errors: string[],
  warnings: string[],
): BacktestResult {
  return {
    source: 'synthetic',
    generator: GENERATOR,
    seed,
    period,
    timeframe,
    rangeStartMs: 0,
    rangeEndMs: 0,
    bars: 0,
    sampleCount: 0,
    warmupBars: 0,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    grossPnl: 0,
    costs: 0,
    realizedPnl: 0,
    netPnl: 0,
    unrealizedPnl: 0,
    openBaskets: 0,
    finalEquity: costModelOf(cfg).initialEquity,
    maxDrawdownPct: 0,
    equityCurve: [],
    tradeLog: [],
    costModel: costModelOf(cfg),
    errors,
    warnings,
    disclaimer: BACKTEST_DISCLAIMER,
  };
}

/**
 * Run the ATR-grid basket backtest on `bars` for the requested period.
 * Never throws for bad input: problems are reported in `errors` (result is then empty)
 * and non-fatal notices in `warnings`.
 */
export function runBacktest(bars: BacktestBar[], opts: BacktestOptions): BacktestResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cfg = resolveConfig(opts, errors);
  const seed = Number.isFinite(opts?.seed) ? opts.seed : 0;
  const requestedPeriod = PERIODS.includes(opts?.period) ? opts.period : null;

  const series = normalizeBars(bars, errors, warnings);
  const timeframe = inferTimeframe(series, opts?.timeframe, errors, warnings);
  if (!cfg || !timeframe || errors.length > 0) {
    return emptyResult(seed, requestedPeriod, timeframe, cfg, errors, warnings);
  }

  const last = series[series.length - 1];
  const cutoff = last.t - PERIOD_MS[cfg.period];
  const window = series.filter((b) => b.t >= cutoff);
  const available = last.t + BAR_MS[timeframe] - series[0].t;
  if (available < PERIOD_MS[cfg.period]) {
    warnings.push(`requested period ${cfg.period} exceeds available data (${Math.floor(available / DAY_MS)} days); using all bars`);
  }
  if (window.length <= SLOW_PERIOD) {
    warnings.push(`only ${window.length} bar(s) in window; no signals before the ${SLOW_PERIOD}-bar warmup completes`);
  }

  const closes = window.map((b) => b.close);
  const fast = ema(closes, FAST_PERIOD);
  const slow = ema(closes, SLOW_PERIOD);
  const sim = simulate(window, fast, slow, cfg);
  const trades = sim.trades;
  const curve = sim.equityCurve;

  // Max drawdown on the full mark-to-market equity path.
  let peak = cfg.initialEquity;
  let maxDd = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    maxDd = Math.max(maxDd, ((peak - point.equity) / peak) * 100);
  }

  const wins = trades.filter((t) => t.pnl > 0).length;
  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const costs = trades.reduce((s, t) => s + t.costs, 0);
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const endPoint = curve[curve.length - 1];
  const unrealizedPnl = sim.open && endPoint ? endPoint.unrealized : 0;

  return {
    source: 'synthetic',
    generator: GENERATOR,
    seed: cfg.seed,
    period: cfg.period,
    timeframe,
    rangeStartMs: window[0].t,
    rangeEndMs: window[window.length - 1].t,
    bars: window.length,
    sampleCount: curve.length,
    warmupBars: Math.min(SLOW_PERIOD, window.length),
    trades: trades.length,
    wins,
    losses: trades.length - wins,
    winRate: trades.length ? wins / trades.length : 0,
    grossPnl,
    costs,
    realizedPnl: netPnl,
    netPnl,
    unrealizedPnl,
    openBaskets: sim.open ? 1 : 0,
    finalEquity: endPoint ? endPoint.equity : cfg.initialEquity,
    maxDrawdownPct: maxDd,
    equityCurve: curve,
    tradeLog: trades,
    costModel: costModelOf(cfg),
    errors: [],
    warnings,
    disclaimer: BACKTEST_DISCLAIMER,
  };
}
