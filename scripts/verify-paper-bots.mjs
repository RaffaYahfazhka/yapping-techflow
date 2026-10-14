/**
 * Verification Script for Paper Trading Bots & Ledger
 * Run via: yarn test:paper-bots
 *
 * Scenarios tested:
 * 1. Initial balances: meteora-lp ($30), prediction-market ($10), xauusd-ea ($10)
 * 2. Stake validation: reject non-positive stake (<= 0) & oversized stake (> balance) with balance unchanged
 * 3. Polymarket filter: 300-second crypto Up/Down matching vs 15-minute / non-crypto rejection
 * 4. Polymarket settlement: gross outcome payout & ledger update without live order
 * 5. Meteora ranking: filter out blacklisted pools and sort by 24h fee/tvl ratio descending
 * 6. XAUUSD EA EMA/ATR crossover: signal triggered only on closed candle cross
 * 7. Spread-aware P&L: long enters at Ask, closes at Bid; gross calculation
 * 8. Sizing & risk cap: skip trade when minimum volume (0.01 lot) exceeds 0.5% risk cap
 * 9. Daily stop: EA stops emitting signals after 2% UTC loss limit reached
 */

import assert from 'node:assert/strict';
import {
  INITIAL_BALANCES,
  createInitialState,
  submitPolymarketTrade,
  settlePolymarketTrade,
  filterPolymarket5mCrypto,
  filterAndRankMeteoraPools,
  evaluateXauSignal,
  openXauPosition,
  closeXauPosition,
  calculateEMA,
  calculateATR,
} from '../src/lib/engine/paperTrading.ts';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log('--- Kantor Raffa Paper Trading Bots Verification ---\n');

// 1. Initial Balances
runTest('Initial virtual balances are $30 (Meteora), $10 (Polymarket), $10 (XAUUSD)', () => {
  assert.equal(INITIAL_BALANCES['meteora-lp'], 30.0);
  assert.equal(INITIAL_BALANCES['prediction-market'], 10.0);
  assert.equal(INITIAL_BALANCES['xauusd-ea'], 10.0);

  const state = createInitialState();
  assert.equal(state.balances['meteora-lp'], 30.0);
  assert.equal(state.balances['prediction-market'], 10.0);
  assert.equal(state.balances['xauusd-ea'], 10.0);
  assert.equal(state.trades.length, 0);
  assert.equal(state.openPositions['xauusd-ea'], null);
});

// 2. Reject non-positive and oversized stakes without changing balance
runTest('Reject non-positive stake and stake > balance with balance intact', () => {
  const state = createInitialState();
  const initPolyBal = state.balances['prediction-market'];

  const resNegative = submitPolymarketTrade(state, {
    marketId: 'poly-1',
    question: 'BTC 5m Up or Down?',
    side: 'up',
    stake: -5,
    price: 0.5,
  });
  assert.equal(resNegative.success, false);
  assert.equal(resNegative.newState.balances['prediction-market'], initPolyBal);

  const resZero = submitPolymarketTrade(state, {
    marketId: 'poly-1',
    question: 'BTC 5m Up or Down?',
    side: 'up',
    stake: 0,
    price: 0.5,
  });
  assert.equal(resZero.success, false);
  assert.equal(resZero.newState.balances['prediction-market'], initPolyBal);

  const resOversized = submitPolymarketTrade(state, {
    marketId: 'poly-1',
    question: 'BTC 5m Up or Down?',
    side: 'up',
    stake: 10.01,
    price: 0.5,
  });
  assert.equal(resOversized.success, false);
  assert.equal(resOversized.newState.balances['prediction-market'], initPolyBal);
  assert.match(resOversized.error, /exceeds available balance/i);
});

// 3. Polymarket 300-second crypto-only filter
runTest('Polymarket filter accepts 300s crypto Up/Down and rejects 15m or non-crypto', () => {
  const fixture = [
    {
      id: 'm1-valid-5m-btc',
      question: 'Bitcoin Up or Down 5m',
      category: 'Crypto',
      active: true,
      closed: false,
      startDate: '2026-10-14T10:00:00Z',
      endDate: '2026-10-14T10:05:00Z',
    },
    {
      id: 'm2-15m-btc',
      question: 'Bitcoin Up or Down 15m',
      category: 'Crypto',
      active: true,
      closed: false,
      startDate: '2026-10-14T10:00:00Z',
      endDate: '2026-10-14T10:15:00Z',
    },
    {
      id: 'm3-5m-politics',
      question: 'Election Poll Up or Down',
      category: 'Politics',
      active: true,
      closed: false,
      startDate: '2026-10-14T10:00:00Z',
      endDate: '2026-10-14T10:05:00Z',
    },
    {
      id: 'm4-closed-5m-eth',
      question: 'Ethereum Up or Down 5m',
      category: 'Crypto',
      active: false,
      closed: true,
      startDate: '2026-10-14T10:00:00Z',
      endDate: '2026-10-14T10:05:00Z',
    },
  ];

  const filtered = filterPolymarket5mCrypto(fixture);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'm1-valid-5m-btc');
});

// 4. Polymarket gross outcome settlement
runTest('Polymarket manual paper entry settles gross from fixture outcome', () => {
  const state = createInitialState();
  const entryRes = submitPolymarketTrade(state, {
    marketId: 'btc-5m',
    question: 'BTC 5m Up or Down',
    side: 'up',
    stake: 4.0,
    price: 0.5,
  });
  assert.equal(entryRes.success, true);
  assert.equal(entryRes.newState.balances['prediction-market'], 6.0);
  const tradeId = entryRes.newState.trades[0].id;

  const settleWin = settlePolymarketTrade(entryRes.newState, {
    tradeId,
    winningSide: 'up',
  });
  assert.equal(settleWin.success, true);
  assert.equal(settleWin.newState.balances['prediction-market'], 14.0);
  const settledTrade = settleWin.newState.trades[0];
  assert.equal(settledTrade.outcome, 'win');
  assert.equal(settledTrade.grossPnl, 4.0);
  assert.match(settledTrade.notes, /gross/i);
});

// 5. Meteora blacklist filtering and ranking
runTest('Meteora excludes blacklisted pools and ranks eligible pools by 24h fee/tvl ratio', () => {
  const pools = [
    {
      address: 'pool-blacklisted',
      name: 'SOL-USDC Scam',
      is_blacklisted: true,
      fee_tvl_ratio_24h: 0.85,
    },
    {
      address: 'pool-low-fee',
      name: 'SOL-USDC Low Fee',
      is_blacklisted: false,
      fee_tvl_ratio_24h: 0.05,
    },
    {
      address: 'pool-high-fee',
      name: 'SOL-USDC High Fee',
      is_blacklisted: false,
      fee_tvl_ratio_24h: 0.42,
    },
  ];

  const ranked = filterAndRankMeteoraPools(pools);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].address, 'pool-high-fee');
  assert.equal(ranked[1].address, 'pool-low-fee');
  assert(!ranked.some((p) => p.address === 'pool-blacklisted'));
});

// 6. XAUUSD EMA(9)/EMA(21) crossover & ATR(14) signal on closed candle
runTest('XAUUSD EA emits signal only after closed candle crossover with ATR stop/target', () => {
  const basePrice = 2650;
  const candles = [];
  for (let i = 0; i < 58; i++) {
    const close = basePrice - i * 0.05;
    candles.push({
      time: i * 300,
      open: close + 0.02,
      high: close + 0.1,
      low: close - 0.1,
      close,
    });
  }
  candles.push({
    time: 58 * 300,
    open: basePrice - 57 * 0.05,
    high: basePrice - 57 * 0.05 + 0.15,
    low: basePrice - 57 * 0.05 - 0.1,
    close: basePrice - 57 * 0.05 + 0.05,
  });
  const close59 = basePrice + 1.5;
  candles.push({
    time: 59 * 300,
    open: basePrice - 57 * 0.05,
    high: close59 + 0.2,
    low: basePrice - 57 * 0.05,
    close: close59,
  });

  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const atrs = calculateATR(candles, 14);

  const last = candles.length - 1;
  const prev = last - 1;
  assert(ema9[prev] <= ema21[prev], `Prior candle EMA9 (${ema9[prev].toFixed(2)}) must be <= EMA21 (${ema21[prev].toFixed(2)})`);
  assert(ema9[last] > ema21[last], `Latest candle EMA9 (${ema9[last].toFixed(2)}) must cross above EMA21 (${ema21[last].toFixed(2)})`);
  assert(atrs[last] > 0, 'ATR must be positive');

  const state = createInitialState();
  const conditions = {
    symbol: 'XAUUSD',
    contractSize: 100,
    minVolume: 0.0001,
    maxVolume: 100,
    volumeStep: 0.0001,
    tickSize: 0.01,
    digits: 2,
  };

  const signal = evaluateXauSignal({
    candles,
    currentBid: 2655.0,
    currentAsk: 2655.3,
    state,
    conditions,
  });

  assert.equal(signal.action, 'buy');
  assert.equal(signal.entryPrice, 2655.3);
  const stopDist = atrs[last] * 1.5;
  assert(Math.abs((signal.entryPrice - signal.stopLoss) - stopDist) < 1e-4);
  assert(Math.abs((signal.takeProfit - signal.entryPrice) - (stopDist * 2)) < 1e-4);
});

// 7. Spread-aware P&L calculation
runTest('Spread-aware P&L enters long at Ask, closes at Bid', () => {
  let state = createInitialState();
  const conditions = {
    symbol: 'XAUUSD',
    contractSize: 100,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    tickSize: 0.01,
    digits: 2,
  };

  const openRes = openXauPosition(state, {
    action: 'buy',
    reason: 'EMA Cross',
    entryPrice: 2650.3,
    stopLoss: 2645.0,
    takeProfit: 2660.0,
    volume: 0.01,
    stakeRisk: 0.05,
  });
  assert.equal(openRes.success, true);
  state = openRes.newState;

  const closeRes = closeXauPosition(state, {
    closePrice: 2655.3,
    reason: 'tp',
    conditions,
  });
  assert.equal(closeRes.success, true);
  assert.equal(closeRes.trade.grossPnl, 5.0);
  assert.equal(closeRes.newState.balances['xauusd-ea'], 15.0);
});

// 8. Minimum volume & 0.5% risk cap skip
runTest('EA skips trade if minimum contract volume exceeds 0.5% risk cap', () => {
  const basePrice = 2650;
  const candles = [];
  for (let i = 0; i < 59; i++) {
    const close = basePrice - i * 0.3;
    candles.push({ time: i * 300, open: close + 0.1, high: close + 0.5, low: close - 0.5, close });
  }
  candles.push({ time: 59 * 300, open: basePrice - 58 * 0.3, high: basePrice + 36, low: basePrice - 58 * 0.3, close: basePrice + 35 });

  const state = createInitialState();
  const standardConditions = {
    symbol: 'XAUUSD',
    contractSize: 100,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    tickSize: 0.01,
    digits: 2,
  };

  const evalSkip = evaluateXauSignal({
    candles,
    currentBid: 2655.0,
    currentAsk: 2655.3,
    state,
    conditions: standardConditions,
  });

  assert.equal(evalSkip.action, 'skip');
  assert.match(evalSkip.reason, /exceeds 0.5% risk cap/i);
});

// 9. UTC Daily Loss Limit 2% stop
runTest('EA halts and emits no new signals after 2% UTC daily loss limit', () => {
  const candles = [];
  for (let i = 0; i < 60; i++) {
    const close = 2650 + (i > 55 ? (i - 55) * 4 : -i * 0.1);
    candles.push({ time: i * 300, open: close - 0.5, high: close + 1.0, low: close - 1.0, close });
  }

  let state = createInitialState();
  state.dailyTracking['xauusd-ea'].realizedLossToday = 0.21;
  state.dailyTracking['xauusd-ea'].halted = true;

  const conditions = {
    symbol: 'XAUUSD',
    contractSize: 100,
    minVolume: 0.001,
    maxVolume: 100,
    volumeStep: 0.001,
    tickSize: 0.01,
    digits: 2,
  };

  const evalHalted = evaluateXauSignal({
    candles,
    currentBid: 2650.0,
    currentAsk: 2650.3,
    state,
    conditions,
  });

  assert.equal(evalHalted.action, 'hold');
  assert.match(evalHalted.reason, /daily utc loss limit reached/i);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log('All paper bots verification scenarios passed successfully! ✔');
