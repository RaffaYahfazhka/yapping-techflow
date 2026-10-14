/**
 * Kantor Raffa — Paper Trading Ledger & Bots Engine
 * Local storage key: kantor-raffa.paper-bots.v1
 *
 * Virtual Starting Balances:
 * - meteora-lp: $30.00 (Read-only pool ranking, unallocated)
 * - prediction-market: $10.00 (Manual paper entries on 300s Polymarket crypto markets)
 * - xauusd-ea: $10.00 (Experimental M5 EMA(9)/EMA(21) + ATR(14) signal baseline)
 */

export const STORAGE_KEY = 'kantor-raffa.paper-bots.v1';
export const PAPER_STORAGE_KEY = STORAGE_KEY;

export const PAPER_ACCOUNTS = ['meteora-lp', 'prediction-market', 'xauusd-ea'] as const;
export type PaperAccount = (typeof PAPER_ACCOUNTS)[number];

export const PAPER_SEED_BALANCES: Record<PaperAccount, number> = {
  'meteora-lp': 30,
  'prediction-market': 10,
  'xauusd-ea': 10,
};

export const INITIAL_BALANCES = PAPER_SEED_BALANCES;

export const PREDICTION_MARKET_DURATION_SECONDS = 300;

export const EA_SIGNAL_DEFAULTS = {
  fastPeriod: 9,
  slowPeriod: 21,
  atrPeriod: 14,
  minClosedCandles: 50,
};

export const EA_QUOTE_MAX_AGE_MS = 15_000;

export interface PaperBalance {
  initial: number;
  available: number;
  reserved: number;
}

export type PaperTradeStatus = 'OPEN' | 'SETTLED' | 'CANCELLED';

export interface PaperTrade {
  id: string;
  account?: PaperAccount;
  botId?: 'meteora-lp' | 'prediction-market' | 'xauusd-ea';
  market?: string;
  marketId?: string;
  side: 'BUY' | 'SELL' | 'long' | 'short' | 'up' | 'down';
  quantity?: number;
  stake?: number;
  entryPrice: number;
  exitPrice?: number;
  status?: PaperTradeStatus;
  openedAt: string | number;
  closedAt?: number;
  settledAt?: string;
  outcome?: 'win' | 'loss' | 'push' | 'pending';
  pnl?: number;
  grossPnl?: number;
  netPnl?: number;
  notes?: string;
}

export interface PaperLedger {
  version: 1;
  balances: Record<PaperAccount, PaperBalance>;
  trades: PaperTrade[];
}

export interface KeyValueStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export function createPaperLedger(): PaperLedger {
  return {
    version: 1,
    balances: {
      'meteora-lp': { initial: 30, available: 30, reserved: 0 },
      'prediction-market': { initial: 10, available: 10, reserved: 0 },
      'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
    },
    trades: [],
  };
}

export function parsePaperLedger(raw: unknown): { ok: boolean; ledger?: PaperLedger; error?: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Raw ledger is not string' };
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || obj.version !== 1) {
      return { ok: false, error: 'Invalid version or not object' };
    }
    const b = obj.balances;
    if (!b || typeof b !== 'object') return { ok: false, error: 'Missing balances' };
    for (const acc of PAPER_ACCOUNTS) {
      const entry = b[acc];
      if (
        !entry ||
        typeof entry.initial !== 'number' ||
        typeof entry.available !== 'number' ||
        typeof entry.reserved !== 'number' ||
        !Number.isFinite(entry.initial) ||
        !Number.isFinite(entry.available) ||
        !Number.isFinite(entry.reserved)
      ) {
        return { ok: false, error: `Invalid balance entry for ${acc}` };
      }
    }
    if (!Array.isArray(obj.trades)) return { ok: false, error: 'trades is not array' };
    return { ok: true, ledger: obj as PaperLedger };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function loadPaperLedger(store?: KeyValueStore): {
  status: 'ready' | 'corrupt';
  created: boolean;
  persisted: boolean;
  ledger: PaperLedger;
} {
  const targetStore = store || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStore) {
    return {
      status: 'ready',
      created: false,
      persisted: false,
      ledger: createPaperLedger(),
    };
  }
  const raw = targetStore.getItem(PAPER_STORAGE_KEY);
  if (!raw) {
    const fresh = createPaperLedger();
    try {
      targetStore.setItem(PAPER_STORAGE_KEY, JSON.stringify(fresh));
      return { status: 'ready', created: true, persisted: true, ledger: fresh };
    } catch {
      return { status: 'ready', created: true, persisted: false, ledger: fresh };
    }
  }
  const parsed = parsePaperLedger(raw);
  if (!parsed.ok || !parsed.ledger) {
    return {
      status: 'corrupt',
      created: false,
      persisted: true,
      ledger: createPaperLedger(),
    };
  }
  return { status: 'ready', created: false, persisted: true, ledger: parsed.ledger };
}

export function persistPaperLedger(ledger: PaperLedger, store?: KeyValueStore): boolean {
  const targetStore = store || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStore) return false;
  try {
    targetStore.setItem(PAPER_STORAGE_KEY, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

export interface PaperResetResult {
  ledger: PaperLedger;
  /** false when the reset could not be written; the old durable portfolio may return after reload. */
  persisted: boolean;
}

export function resetPaperLedgerWithResult(store?: KeyValueStore): PaperResetResult {
  const fresh = createPaperLedger();
  const targetStore = store || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStore) return { ledger: fresh, persisted: false };
  try {
    targetStore.setItem(PAPER_STORAGE_KEY, JSON.stringify(fresh));
    return { ledger: fresh, persisted: true };
  } catch {
    return { ledger: fresh, persisted: false };
  }
}

export function resetPaperLedger(store?: KeyValueStore): PaperLedger {
  return resetPaperLedgerWithResult(store).ledger;
}

export function openPaperTrade(
  ledger: PaperLedger,
  trade: {
    id: string;
    account: string;
    marketId: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    openedAt?: string;
  }
): PaperLedger {
  const acc = trade.account as PaperAccount;
  if (!PAPER_ACCOUNTS.includes(acc)) {
    throw new Error(`Unknown paper account: ${trade.account}`);
  }
  if (!Number.isFinite(trade.quantity) || trade.quantity <= 0) {
    throw new Error('Invalid quantity');
  }
  if (!Number.isFinite(trade.entryPrice) || trade.entryPrice <= 0) {
    throw new Error('Invalid entry price');
  }
  if (ledger.trades.some((t) => t.id === trade.id)) {
    throw new Error('Duplicate paper trade id');
  }

  const notional = trade.quantity * trade.entryPrice;
  const current = ledger.balances[acc];
  if (current.available < notional) {
    throw new Error('Insufficient paper balance');
  }

  const newBalances = {
    ...ledger.balances,
    [acc]: {
      ...current,
      available: current.available - notional,
      reserved: current.reserved + notional,
    },
  };

  const newTrade: PaperTrade = {
    id: trade.id,
    account: acc,
    marketId: trade.marketId,
    side: trade.side,
    quantity: trade.quantity,
    entryPrice: trade.entryPrice,
    status: 'OPEN',
    openedAt: trade.openedAt || new Date().toISOString(),
  };

  return {
    ...ledger,
    balances: newBalances,
    trades: [newTrade, ...ledger.trades],
  };
}

export function settlePaperTrade(
  ledger: PaperLedger,
  tradeId: string,
  exitPrice: number,
  settledAt?: string
): PaperLedger {
  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    throw new Error('Invalid settlement price');
  }
  const idx = ledger.trades.findIndex((t) => t.id === tradeId && t.status === 'OPEN');
  if (idx === -1) {
    throw new Error('Open paper trade not found');
  }
  const t = ledger.trades[idx];
  const acc = (t.account || t.botId) as PaperAccount;
  const current = ledger.balances[acc];
  const quantity = t.quantity || (t.stake ? t.stake / t.entryPrice : 1);
  const notional = quantity * t.entryPrice;

  const isBuy = t.side === 'BUY' || t.side === 'long' || t.side === 'up';
  const priceDiff = isBuy ? exitPrice - t.entryPrice : t.entryPrice - exitPrice;
  const pnl = priceDiff * quantity;

  const newBalances = {
    ...ledger.balances,
    [acc]: {
      ...current,
      available: current.available + notional + pnl,
      reserved: Math.max(0, current.reserved - notional),
    },
  };

  const updatedTrade: PaperTrade = {
    ...t,
    status: 'SETTLED',
    exitPrice,
    pnl,
    grossPnl: pnl,
    netPnl: pnl,
    settledAt: settledAt || new Date().toISOString(),
  };

  const newTrades = [...ledger.trades];
  newTrades[idx] = updatedTrade;

  return {
    ...ledger,
    balances: newBalances,
    trades: newTrades,
  };
}

// -------------------------------------------------------------
// Pure Indicator & Signal Math
// -------------------------------------------------------------

export interface Candle {
  openTime?: number;
  closeTime?: number;
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Quote {
  bid: number;
  ask: number;
  timestamp: number;
}

export interface EaSignalResult {
  signal: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  closedCount: number;
  atr: number | null;
  fastEma?: number;
  slowEma?: number;
}

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues: number[] = new Array(values.length);

  if (values.length < period) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      emaValues[i] = sum / (i + 1);
    }
    return emaValues;
  }

  let seedSum = 0;
  for (let i = 0; i < period; i++) {
    seedSum += values[i];
    emaValues[i] = seedSum / (i + 1);
  }
  emaValues[period - 1] = seedSum / period;

  for (let i = period; i < values.length; i++) {
    emaValues[i] = values[i] * k + emaValues[i - 1] * (1 - k);
  }

  return emaValues;
}

export function calculateATR(candles: Candle[], period = 14): number[] {
  if (candles.length === 0) return [];
  const trs: number[] = new Array(candles.length);
  trs[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trs[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }

  const atrs: number[] = new Array(candles.length);
  if (candles.length < period) {
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      sum += trs[i];
      atrs[i] = sum / (i + 1);
    }
    return atrs;
  }

  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += trs[i];
    atrs[i] = initialSum / (i + 1);
  }
  atrs[period - 1] = initialSum / period;

  for (let i = period; i < candles.length; i++) {
    atrs[i] = (atrs[i - 1] * (period - 1) + trs[i]) / period;
  }

  return atrs;
}

export function closedCandles(candles: Candle[], nowMs: number): Candle[] {
  if (!Array.isArray(candles)) return [];
  return candles
    .filter((c) => {
      const closeT = c.closeTime ?? (c.time ? c.time + 300_000 : 0);
      return closeT <= nowMs;
    })
    .sort((a, b) => {
      const aT = a.openTime ?? a.time ?? 0;
      const bT = b.openTime ?? b.time ?? 0;
      return aT - bT;
    });
}

export function latestAtr(candles: Candle[], period = 14): number | null {
  if (!candles || candles.length <= period || period <= 0) return null;
  const series = calculateATR(candles, period);
  return series.length > 0 ? series[series.length - 1] : null;
}

export function evaluateEmaAtrSignal(
  candles: Candle[],
  nowMs: number,
  options?: {
    fastPeriod?: number;
    slowPeriod?: number;
    atrPeriod?: number;
    minClosedCandles?: number;
  }
): EaSignalResult {
  const fast = options?.fastPeriod ?? EA_SIGNAL_DEFAULTS.fastPeriod;
  const slow = options?.slowPeriod ?? EA_SIGNAL_DEFAULTS.slowPeriod;
  const atrPeriod = options?.atrPeriod ?? EA_SIGNAL_DEFAULTS.atrPeriod;
  const minCandles = options?.minClosedCandles ?? EA_SIGNAL_DEFAULTS.minClosedCandles;

  if (fast >= slow) {
    return { signal: 'HOLD', reason: 'invalid-periods', closedCount: 0, atr: null };
  }

  const closed = closedCandles(candles, nowMs);
  if (closed.length < minCandles) {
    return { signal: 'HOLD', reason: 'insufficient-seed', closedCount: closed.length, atr: null };
  }

  const closes = closed.map((c) => c.close);
  const fastEmas = calculateEMA(closes, fast);
  const slowEmas = calculateEMA(closes, slow);
  const atrs = calculateATR(closed, atrPeriod);

  const n = closed.length - 1;
  const prev = n - 1;
  const currentFast = fastEmas[n];
  const currentSlow = slowEmas[n];
  const prevFast = fastEmas[prev];
  const prevSlow = slowEmas[prev];
  const atr = atrs[n];

  const crossUp = prevFast <= prevSlow && currentFast > currentSlow;
  const crossDown = prevFast >= prevSlow && currentFast < currentSlow;

  if (crossUp) {
    return {
      signal: 'BUY',
      reason: 'ema-cross-up',
      closedCount: closed.length,
      atr,
      fastEma: currentFast,
      slowEma: currentSlow,
    };
  }
  if (crossDown) {
    return {
      signal: 'SELL',
      reason: 'ema-cross-down',
      closedCount: closed.length,
      atr,
      fastEma: currentFast,
    };
  }

  return {
    signal: 'HOLD',
    reason: 'no-cross',
    closedCount: closed.length,
    atr,
    fastEma: currentFast,
    slowEma: currentSlow,
  };
}

export function calculateEaPositionSize(
  equity: number,
  riskPercent: number,
  stopDistance: number,
  unitValue = 1,
  dailyLossSoFar = 0,
  dailyLossCap = 2
): number {
  if (
    !Number.isFinite(equity) ||
    equity <= 0 ||
    !Number.isFinite(riskPercent) ||
    riskPercent <= 0 ||
    !Number.isFinite(stopDistance) ||
    stopDistance <= 0 ||
    dailyLossSoFar >= dailyLossCap
  ) {
    return 0;
  }
  const riskAmount = (equity * riskPercent) / 100;
  const size = riskAmount / (stopDistance * unitValue);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export function isDailyLossLimitReached(
  dayStartEquity: number,
  currentEquity: number,
  maxDailyLossPercent = 2
): boolean {
  if (dayStartEquity <= 0) return true;
  const loss = dayStartEquity - currentEquity;
  const maxLoss = (dayStartEquity * maxDailyLossPercent) / 100;
  return loss >= maxLoss;
}

export function calculateEaPnl(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'BUY' | 'SELL' = 'BUY'
): number {
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(exitPrice) ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return 0;
  }
  const isBuy = side === 'BUY';
  return isBuy ? (exitPrice - entryPrice) * quantity : (entryPrice - exitPrice) * quantity;
}

export function fillPrice(side: 'BUY' | 'SELL', quote: Quote, action: 'open' | 'close'): number {
  if (action === 'open') {
    return side === 'BUY' ? quote.ask : quote.bid;
  }
  return side === 'BUY' ? quote.bid : quote.ask;
}

export function evaluateEaEntry(params: {
  ledger: PaperLedger;
  candles: Candle[];
  quote: Quote;
  nowMs: number;
  dayStartEquity: number;
  config: {
    riskPercent?: number;
    riskCapPercent?: number;
    maxSpread?: number;
    minTickVolume?: number;
  };
}): { allowed: boolean; reasons: string[]; signalResult?: EaSignalResult } {
  const reasons: string[] = [];
  const { ledger, candles, quote, nowMs, dayStartEquity, config } = params;

  // Check quote freshness (15s)
  if (nowMs - quote.timestamp > EA_QUOTE_MAX_AGE_MS) {
    reasons.push('quote-stale');
  }

  // Check spread
  const spread = quote.ask - quote.bid;
  if (config.maxSpread !== undefined && spread > config.maxSpread) {
    reasons.push('spread-too-wide');
  }

  // Check 1 open position for xauusd-ea
  const openTrades = ledger.trades.filter((t) => (t.account === 'xauusd-ea' || t.botId === 'xauusd-ea') && t.status === 'OPEN');
  if (openTrades.length > 0) {
    reasons.push('one-open-position');
  }

  // Check daily loss stop
  const xauBal = ledger.balances['xauusd-ea'].available + ledger.balances['xauusd-ea'].reserved;
  if (isDailyLossLimitReached(dayStartEquity, xauBal, config.riskCapPercent ?? 2)) {
    reasons.push('daily-loss-limit');
  }

  // Check signal
  const signalResult = evaluateEmaAtrSignal(candles, nowMs);
  if (signalResult.signal === 'HOLD') {
    reasons.push(`no-signal:${signalResult.reason}`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    signalResult,
  };
}

// -------------------------------------------------------------
// Meteora Pool Ranking
// -------------------------------------------------------------

export interface MeteoraPool {
  address: string;
  name: string;
  tvl?: number;
  fee24h?: number;
  fees24h?: number;
  volume24h?: number;
  fee_tvl_ratio_24h?: number;
  trade_volume_24h?: number;
  current_price?: number;
  liquidity?: string;
  is_blacklisted?: boolean;
  feeTvlRatio?: number | null;
}

export function rankMeteoraPools(
  pools: MeteoraPool[],
  options?: { limit?: number; minTvl?: number }
): (MeteoraPool & { feeTvlRatio: number })[] {
  if (!Array.isArray(pools)) return [];
  const minTvl = options?.minTvl ?? 0;
  const limit = options?.limit ?? pools.length;

  return pools
    .filter((p) => {
      if (p.is_blacklisted) return false;
      const tvl = p.tvl ?? (p.liquidity ? parseFloat(p.liquidity) : 0);
      const fee = p.fee24h ?? p.fees24h ?? (p.fee_tvl_ratio_24h ? p.fee_tvl_ratio_24h * tvl : 0);
      return Number.isFinite(tvl) && tvl > 0 && tvl >= minTvl && Number.isFinite(fee) && fee >= 0;
    })
    .map((p) => {
      const tvl = p.tvl ?? (p.liquidity ? parseFloat(p.liquidity) : 0);
      const fee = p.fee24h ?? p.fees24h ?? (p.fee_tvl_ratio_24h ? p.fee_tvl_ratio_24h * tvl : 0);
      const feeTvlRatio = p.fee_tvl_ratio_24h ?? (tvl > 0 ? fee / tvl : 0);
      return {
        ...p,
        feeTvlRatio,
      };
    })
    .sort((a, b) => b.feeTvlRatio - a.feeTvlRatio)
    .slice(0, limit);
}

export function filterAndRankMeteoraPools(pools: MeteoraPool[]): MeteoraPool[] {
  if (!Array.isArray(pools)) return [];

  return pools
    .filter((p) => p && !p.is_blacklisted)
    .sort((a, b) => {
      const ratioA = Number(a.fee_tvl_ratio_24h || 0);
      const ratioB = Number(b.fee_tvl_ratio_24h || 0);
      return ratioB - ratioA;
    });
}

// -------------------------------------------------------------
// Polymarket Filter
// -------------------------------------------------------------

export interface PolymarketMarket {
  id: string;
  question?: string;
  description?: string;
  category?: string;
  active?: boolean;
  closed?: boolean;
  tokens?: { token_id: string; outcome: string; price: number }[];
  outcomes?: { outcome: string; price: number | null }[];
  startDate?: string;
  endDate?: string;
  duration?: number;
  durationSeconds?: number;
  secondsDelay?: number;
  volume24h?: number;
  volume?: number;
  slug?: string;
}

export function filterFiveMinuteMarkets(
  markets: PolymarketMarket[],
  narrowing?: string
): PolymarketMarket[] {
  if (!Array.isArray(markets)) return [];

  return markets.filter((m) => {
    if (m.active === false || m.closed === true) return false;

    const duration = m.durationSeconds ?? m.duration ?? m.secondsDelay ?? (
      m.startDate && m.endDate
        ? Math.round((new Date(m.endDate).getTime() - new Date(m.startDate).getTime()) / 1000)
        : null
    );
    if (duration !== PREDICTION_MARKET_DURATION_SECONDS) return false;

    const text = `${m.question || ''} ${m.description || ''} ${m.slug || ''} ${m.category || ''}`.toLowerCase();
    const isUpDown = text.includes('up or down') || text.includes('up/down') || (text.includes('up') && text.includes('down'));
    if (!isUpDown) return false;

    if (narrowing) {
      const target = narrowing.toLowerCase();
      const questionMatch = (m.question || '').toLowerCase().includes(target);
      const slugMatch = (m.slug || '').toLowerCase().includes(target);
      const categoryMatch = (m.category || '').toLowerCase().includes(target);
      if (!questionMatch && !slugMatch && !categoryMatch) {
        return false;
      }
    }

    return true;
  });
}

export function filterPolymarket5mCrypto(markets: PolymarketMarket[]): PolymarketMarket[] {
  return filterFiveMinuteMarkets(markets, 'crypto');
}

// -------------------------------------------------------------
// UI Paper State backward-compatible helpers
// -------------------------------------------------------------

export interface PaperState {
  version: 1;
  balances: {
    'meteora-lp': number;
    'prediction-market': number;
    'xauusd-ea': number;
  };
  openPositions: {
    'xauusd-ea': any | null;
  };
  trades: PaperTrade[];
  dailyTracking: {
    'xauusd-ea': {
      utcDate: string;
      startingBalance: number;
      realizedLossToday: number;
      halted: boolean;
    };
  };
}

export function createInitialState(): PaperState {
  return {
    version: 1,
    balances: {
      'meteora-lp': 30,
      'prediction-market': 10,
      'xauusd-ea': 10,
    },
    openPositions: {
      'xauusd-ea': null,
    },
    trades: [],
    dailyTracking: {
      'xauusd-ea': {
        utcDate: new Date().toISOString().slice(0, 10),
        startingBalance: 10,
        realizedLossToday: 0,
        halted: false,
      },
    },
  };
}

export function loadPaperState(): { state: PaperState; isCorrupt: boolean } {
  const res = loadPaperLedger();
  if (res.status === 'corrupt') {
    return { state: createInitialState(), isCorrupt: true };
  }
  const l = res.ledger;
  return {
    isCorrupt: false,
    state: {
      version: 1,
      balances: {
        'meteora-lp': l.balances['meteora-lp'].available,
        'prediction-market': l.balances['prediction-market'].available,
        'xauusd-ea': l.balances['xauusd-ea'].available,
      },
      openPositions: { 'xauusd-ea': null },
      trades: l.trades,
      dailyTracking: {
        'xauusd-ea': {
          utcDate: new Date().toISOString().slice(0, 10),
          startingBalance: l.balances['xauusd-ea'].initial,
          realizedLossToday: 0,
          halted: false,
        },
      },
    },
  };
}

export function savePaperState(state: PaperState): void {
  const ledger: PaperLedger = {
    version: 1,
    balances: {
      'meteora-lp': { initial: 30, available: state.balances['meteora-lp'], reserved: 0 },
      'prediction-market': { initial: 10, available: state.balances['prediction-market'], reserved: 0 },
      'xauusd-ea': { initial: 10, available: state.balances['xauusd-ea'], reserved: 0 },
    },
    trades: state.trades,
  };
  persistPaperLedger(ledger);
}

export function resetPaperState(): { state: PaperState; persisted: boolean } {
  const { persisted } = resetPaperLedgerWithResult();
  return { state: createInitialState(), persisted };
}

export function submitPolymarketTrade(
  state: PaperState,
  params: {
    marketId: string;
    question: string;
    side: 'up' | 'down';
    stake: number;
    price: number;
  }
): { success: boolean; newState: PaperState; error?: string } {
  if (params.stake <= 0) return { success: false, newState: state, error: 'Stake must be positive' };
  if (params.stake > state.balances['prediction-market']) {
    return { success: false, newState: state, error: 'Stake exceeds available balance' };
  }
  const trade: PaperTrade = {
    id: `poly-${Date.now()}`,
    botId: 'prediction-market',
    market: params.question,
    side: params.side,
    stake: params.stake,
    entryPrice: params.price,
    openedAt: Date.now(),
    outcome: 'pending',
  };
  const newState: PaperState = {
    ...state,
    balances: {
      ...state.balances,
      'prediction-market': state.balances['prediction-market'] - params.stake,
    },
    trades: [trade, ...state.trades],
  };
  return { success: true, newState };
}

export function settlePolymarketTrade(
  state: PaperState,
  params: {
    tradeId: string;
    winningSide: 'up' | 'down';
  }
): { success: boolean; newState: PaperState; error?: string } {
  const idx = state.trades.findIndex((t) => t.id === params.tradeId);
  if (idx === -1) return { success: false, newState: state, error: 'Trade not found' };
  const trade = state.trades[idx];
  const isWin = trade.side === params.winningSide;
  const tokens = (trade.stake || 1) / trade.entryPrice;
  const payout = isWin ? tokens : 0;
  const grossPnl = isWin ? payout - (trade.stake || 0) : -(trade.stake || 0);

  const updated: PaperTrade = {
    ...trade,
    closedAt: Date.now(),
    outcome: isWin ? 'win' : 'loss',
    grossPnl,
    notes: 'Settled gross from market outcome',
  };
  const newTrades = [...state.trades];
  newTrades[idx] = updated;

  const newState: PaperState = {
    ...state,
    balances: {
      ...state.balances,
      'prediction-market': state.balances['prediction-market'] + payout,
    },
    trades: newTrades,
  };
  return { success: true, newState };
}

export function evaluateXauSignal(params: {
  candles: Candle[];
  currentBid: number;
  currentAsk: number;
  state: PaperState;
  conditions?: {
    contractSize: number;
    minVolume: number;
    volumeStep: number;
  };
}): {
  action: 'buy' | 'sell' | 'hold' | 'skip';
  reason: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  volume?: number;
} {
  const { candles, currentBid, currentAsk, state, conditions } = params;
  const nowMs = candles[candles.length - 1]?.time ? (candles[candles.length - 1].time as number) + 300_000 : Date.now();

  if (state.dailyTracking['xauusd-ea'].halted || state.dailyTracking['xauusd-ea'].realizedLossToday >= 0.20) {
    return { action: 'hold', reason: 'daily utc loss limit reached' };
  }

  const sig = evaluateEmaAtrSignal(candles, nowMs);
  if (sig.signal === 'HOLD') {
    return { action: 'hold', reason: sig.reason };
  }

  const isBuy = sig.signal === 'BUY';
  const entryPrice = isBuy ? currentAsk : currentBid;
  const stopDist = (sig.atr || 1) * 1.5;
  const stopLoss = isBuy ? entryPrice - stopDist : entryPrice + stopDist;
  const takeProfit = isBuy ? entryPrice + stopDist * 2 : entryPrice - stopDist * 2;

  const equity = state.balances['xauusd-ea'];
  const maxRisk = equity * 0.005; // 0.5%
  const riskPerLot = stopDist * (conditions?.contractSize || 100);
  const rawLots = maxRisk / riskPerLot;
  const step = conditions?.volumeStep || 0.01;
  const lots = Math.floor(rawLots / step) * step;

  if (conditions && lots < conditions.minVolume) {
    return { action: 'skip', reason: 'Minimum volume exceeds 0.5% risk cap' };
  }

  return {
    action: isBuy ? 'buy' : 'sell',
    reason: sig.reason,
    entryPrice,
    stopLoss,
    takeProfit,
    volume: lots > 0 ? lots : conditions?.minVolume || 0.01,
  };
}

export function openXauPosition(
  state: PaperState,
  signal: {
    action: 'buy' | 'sell';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    volume: number;
    stakeRisk: number;
  }
): { success: boolean; newState: PaperState } {
  return {
    success: true,
    newState: {
      ...state,
      openPositions: {
        'xauusd-ea': {
          side: signal.action === 'buy' ? 'long' : 'short',
          entryPrice: signal.entryPrice,
          volume: signal.volume,
          openedAt: Date.now(),
        },
      },
    },
  };
}

export function closeXauPosition(
  state: PaperState,
  params: {
    closePrice: number;
    reason: string;
    conditions?: { contractSize: number };
  }
): { success: boolean; newState: PaperState; trade: PaperTrade } {
  const pos = state.openPositions['xauusd-ea'];
  const isLong = pos.side === 'long';
  const contractSize = params.conditions?.contractSize || 100;
  const diff = isLong ? params.closePrice - pos.entryPrice : pos.entryPrice - params.closePrice;
  const grossPnl = diff * contractSize * pos.volume;

  const trade: PaperTrade = {
    id: `xau-${Date.now()}`,
    botId: 'xauusd-ea',
    market: 'XAUUSD',
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice: params.closePrice,
    grossPnl,
    openedAt: pos.openedAt,
    outcome: grossPnl > 0 ? 'win' : 'loss',
  };

  const newState: PaperState = {
    ...state,
    balances: {
      ...state.balances,
      'xauusd-ea': state.balances['xauusd-ea'] + grossPnl,
    },
    openPositions: { 'xauusd-ea': null },
    trades: [trade, ...state.trades],
  };

  return { success: true, newState, trade };
}
