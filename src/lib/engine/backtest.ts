/**
 * Deterministic synthetic XAUUSD EMA backtest.
 * Prices are synthetic (generated from a seed); they are NOT market data.
 *
 * Model summary:
 * - Signal: EMA(12) / EMA(26) crossover computed on bar closes. No signal before the
 *   slow EMA has its full warmup (SLOW_PERIOD bars).
 * - Execution: a signal on bar j is filled at the OPEN of bar j+1 (no look-ahead).
 * - Costs: fixed full spread (half paid per side) + fixed slippage per market fill,
 *   plus a fixed commission per side. Stop exits pay spread+slippage; target (limit)
 *   exits pay spread only.
 * - Accounting: position size is `units`; P&L is net of all modeled costs.
 * - Equity: marked to market on every bar (realized + open-position value after an
 *   estimated exit), so drawdown is measured on the full equity path, not closed trades.
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
  exitReason: 'stop' | 'target' | 'signal';
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
  stop: number;
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
  'Deterministic synthetic paper backtest; not market data, investment advice, or a guarantee. Modeled: fixed spread, slippage, and commission. Not modeled: swaps, latency, partial fills, requotes, margin calls, and real liquidity. Past or simulated performance is not predictive.';

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
  stop: number;
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
  if (!Number.isFinite(opts.stop) || opts.stop <= 0) errors.push('stop must be a positive finite number');
  if (opts.timeframe !== undefined && !TIMEFRAMES.includes(opts.timeframe)) errors.push(`unsupported timeframe: ${String(opts.timeframe)}`);

  const cfg: Config = {
    period: opts.period,
    seed: opts.seed,
    target: opts.target,
    stop: opts.stop,
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
  stopLevel: number;
  targetLevel: number;
}

interface SimOutput {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  open: boolean;
}

/** Bar-by-bar simulation with next-open execution, costs, and mark-to-market equity. */
function simulate(window: BacktestBar[], fast: number[], slow: number[], cfg: Config): SimOutput {
  const halfSpread = cfg.spread / 2;
  const marketCost = halfSpread + cfg.slippage;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  let pos: OpenPosition | null = null;
  let pending: 1 | -1 | 0 = 0;
  let realized = 0;

  // Closes the position at `exitMid` with an adverse `exitCost` per unit; commission on both sides.
  const closePosition = (p: OpenPosition, exitMid: number, exitCost: number, closedAt: number, reason: BacktestTrade['exitReason']) => {
    const exitFill = exitMid - p.side * exitCost;
    const grossPnl = (exitMid - p.entryMid) * p.side * cfg.units;
    const pnl = (exitFill - p.entryFill) * p.side * cfg.units - 2 * cfg.commissionPerSide;
    realized += pnl;
    trades.push({
      id: trades.length + 1,
      side: p.side === 1 ? 'long' : 'short',
      entryPrice: p.entryFill,
      exitPrice: exitFill,
      grossPnl,
      costs: grossPnl - pnl,
      pnl,
      exitReason: reason,
      openedAt: p.openedAt,
      closedAt,
    });
  };

  for (let j = 0; j < window.length; j++) {
    const bar = window[j];

    // 1) Fill a pending signal from the previous bar at this bar's open.
    if (pending !== 0 && !(pos && pos.side === pending)) {
      if (pos) closePosition(pos, bar.open, marketCost, bar.t, 'signal');
      pos = {
        side: pending,
        entryFill: bar.open + pending * marketCost,
        entryMid: bar.open,
        openedAt: bar.t,
        stopLevel: bar.open - pending * cfg.stop,
        targetLevel: bar.open + pending * cfg.target,
      };
    }
    pending = 0;

    // 2) Intrabar stop/target. If both are touched on one bar, the stop is assumed first.
    if (pos) {
      const s = pos.side;
      const stopHit = s === 1 ? bar.low <= pos.stopLevel : bar.high >= pos.stopLevel;
      const targetHit = s === 1 ? bar.high >= pos.targetLevel : bar.low <= pos.targetLevel;
      if (stopHit) {
        // Gapped through the stop: fill at the open (worse than the level).
        const mid = s === 1 ? Math.min(bar.open, pos.stopLevel) : Math.max(bar.open, pos.stopLevel);
        closePosition(pos, mid, marketCost, bar.t, 'stop');
        pos = null;
      } else if (targetHit) {
        // Limit exit: spread only, no slippage. Gap-through fills at the better open.
        const mid = s === 1 ? Math.max(bar.open, pos.targetLevel) : Math.min(bar.open, pos.targetLevel);
        closePosition(pos, mid, halfSpread, bar.t, 'target');
        pos = null;
      }
    }

    // 3) Signal on this bar's close; execution happens on the next bar's open.
    if (j >= SLOW_PERIOD && j + 1 < window.length) {
      const prior = fast[j - 1] - slow[j - 1];
      const current = fast[j] - slow[j];
      const signal: 1 | -1 | 0 = prior <= 0 && current > 0 ? 1 : prior >= 0 && current < 0 ? -1 : 0;
      if (signal !== 0 && !(pos && pos.side === signal)) pending = signal;
    }

    // 4) Mark to market: open position valued at an estimated exit (spread+slippage, commission).
    let unrealized = 0;
    if (pos) {
      const markFill = bar.close - pos.side * marketCost;
      unrealized = (markFill - pos.entryFill) * pos.side * cfg.units - 2 * cfg.commissionPerSide;
    }
    equityCurve.push({ t: bar.t, equity: cfg.initialEquity + realized + unrealized, realized, unrealized });
  }

  return { trades, equityCurve, open: pos !== null };
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
 * Run the EMA crossover backtest on `bars` for the requested period.
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
