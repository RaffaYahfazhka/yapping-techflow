import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

const { createSeedLedgerV2, validateLedgerV2 } = await import('../src/lib/engine/paperLedgerV2');
const {
  calculateKellyStake,
  isQuoteUsable,
  evaluateBtcScalper,
  evaluateArbitrage,
  evaluateMomentum,
  executeBotOrder,
  settleBotPosition,
} = await import('../src/lib/engine/predictionBot');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

// 1. Kelly Sizing Tests
test('calculateKellyStake: positive edge yields fractionally sized stake', () => {
  const res = calculateKellyStake(5000, 0.60, 0.50);
  assert.equal(res.stakeUsdc, 50);
  assert.ok(res.fStar > 0);
});

test('calculateKellyStake: zero or negative edge yields zero stake', () => {
  const res = calculateKellyStake(5000, 0.40, 0.50);
  assert.equal(res.stakeUsdc, 0);
  assert.ok(res.fStar <= 0);
});

test('calculateKellyStake: below minimum stake yields zero stake', () => {
  const res = calculateKellyStake(10, 0.55, 0.50);
  assert.equal(res.stakeUsdc, 0);
});

// 2. Quote Validation Tests
test('isQuoteUsable: rejects closed, inactive, or invalid prices', () => {
  assert.equal(isQuoteUsable({ id: '1', closed: true, bestAsk: 0.5 }, 1000).usable, false);
  assert.equal(isQuoteUsable({ id: '2', active: false, bestAsk: 0.5 }, 1000).usable, false);
  assert.equal(isQuoteUsable({ id: '3', bestAsk: -0.1 }, 1000).usable, false);
  assert.equal(isQuoteUsable({ id: '4', bestAsk: 1.05 }, 1000).usable, false);
  assert.equal(isQuoteUsable({ id: '5', bestAsk: 0.5, endDate: '1970-01-01T00:00:01Z' }, 2000).usable, false);
  assert.equal(isQuoteUsable({ id: '6', bestAsk: 0.55 }, 1000).usable, true);
});

// 3. Strategy Tests
test('evaluateBtcScalper: generates Up signal when BTC spot momentum exceeds edge threshold', () => {
  const market = {
    id: 'poly-btc-5m-1',
    question: 'Will Bitcoin be Up in next 5m?',
    bestAsk: 0.48,
    active: true,
    closed: false,
    outcomes: [{ outcome: 'Up', price: 0.48 }, { outcome: 'Down', price: 0.52 }],
  };
  const signal = evaluateBtcScalper(market, 96000, 3.5, 5000, 1000);
  assert.ok(signal);
  assert.equal(signal.strategy, 'btc_scalper');
  assert.equal(signal.side, 'up');
  assert.equal(signal.price, 0.48);
  assert.ok(signal.stakeUsdc >= 1);
});

test('evaluateArbitrage: detects mispriced basket where outcome prices sum < 0.96', () => {
  const market = {
    id: 'poly-arb-1',
    question: 'ETH Price Above $3000?',
    bestAsk: 0.45,
    active: true,
    closed: false,
    outcomes: [{ outcome: 'Yes', price: 0.44 }, { outcome: 'No', price: 0.50 }],
  };
  const signal = evaluateArbitrage(market, 5000, 1000);
  assert.ok(signal);
  assert.equal(signal.strategy, 'arbitrage');
  assert.ok(signal.stakeUsdc >= 1);
});

test('evaluateMomentum: detects tight spread with high volume', () => {
  const market = {
    id: 'poly-mom-1',
    question: 'Solana volume surge',
    bestAsk: 0.58,
    bestBid: 0.56,
    spread: 0.02,
    volume24h: 15000,
    active: true,
    closed: false,
  };
  const signal = evaluateMomentum(market, 5000, 1000);
  assert.ok(signal);
  assert.equal(signal.strategy, 'momentum');
  assert.equal(signal.side, 'up');
});

// 4. Order Execution & Ledger Integration
test('executeBotOrder: places order on Ledger v2 and reserves stake', () => {
  const ledger = createSeedLedgerV2();
  const initialAvailable = ledger.accounts['kenzo-usdc'].available;

  const signal = {
    id: 'sig-test-1',
    marketId: 'poly-1',
    strategy: 'btc_scalper',
    side: 'up',
    price: 0.50,
    confidence: 0.60,
    stakeUsdc: 20,
    reason: 'test signal',
    timestamp: 1000,
  };

  const res = executeBotOrder(ledger, signal, 'order-bot-1', 1000);
  assert.equal(res.ok, true);
  if (!res.ok) throw new Error('Order execution failed');

  assert.equal(res.ledger.accounts['kenzo-usdc'].reserved, 20_000_000); // 20 USDC in micro-units
  assert.equal(res.ledger.accounts['kenzo-usdc'].available, initialAvailable - 20_000_000);
  assert.equal(res.position.id, 'order-bot-1');
  assert.deepEqual(validateLedgerV2(res.ledger), []);
});

// 5. Official Settlement & Guardrail Tests
test('settleBotPosition: rejects settlement if market is not closed', () => {
  const ledger = createSeedLedgerV2();
  const orderRes = executeBotOrder(ledger, {
    id: 's', marketId: 'm', strategy: 'btc_scalper', side: 'up', price: 0.5, confidence: 0.6, stakeUsdc: 10, reason: '', timestamp: 1
  }, 'pos-unclosed', 1);
  if (!orderRes.ok) throw new Error('Order failed');

  const res = settleBotPosition(orderRes.ledger, orderRes.position, false, 'up', 2);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'market-not-closed');
});

test('settleBotPosition: rejects settlement if outcome is unresolved or ambiguous', () => {
  const ledger = createSeedLedgerV2();
  const orderRes = executeBotOrder(ledger, {
    id: 's', marketId: 'm', strategy: 'btc_scalper', side: 'up', price: 0.5, confidence: 0.6, stakeUsdc: 10, reason: '', timestamp: 1
  }, 'pos-ambig', 1);
  if (!orderRes.ok) throw new Error('Order failed');

  // Null outcome
  const resNull = settleBotPosition(orderRes.ledger, orderRes.position, true, null, 2);
  assert.equal(resNull.ok, false);
  assert.equal(resNull.reason, 'unresolved-outcome');

  // Ambiguous outcome string (neither up/yes nor down/no)
  const resWeird = settleBotPosition(orderRes.ledger, orderRes.position, true, 'INVALID_UNKNOWN_OUTCOME', 2);
  assert.equal(resWeird.ok, false);
  assert.equal(resWeird.reason, 'ambiguous-outcome-label');
});

test('settleBotPosition: winning outcome releases reservation and adds profit to available', () => {
  const ledger = createSeedLedgerV2();
  const orderRes = executeBotOrder(ledger, {
    id: 's', marketId: 'm', strategy: 'btc_scalper', side: 'up', price: 0.5, confidence: 0.6, stakeUsdc: 10, reason: '', timestamp: 1
  }, 'pos-win', 1);
  if (!orderRes.ok) throw new Error('Order failed');

  const settleRes = settleBotPosition(orderRes.ledger, orderRes.position, true, 'up', 2);
  assert.equal(settleRes.ok, true);
  if (!settleRes.ok) throw new Error('Settle failed');

  // At price 0.50, $10 stake pays $20 -> profit $10
  assert.equal(settleRes.position.pnlMinor, 10_000_000);
  assert.equal(settleRes.ledger.accounts['kenzo-usdc'].reserved, 0);
  assert.equal(settleRes.ledger.accounts['kenzo-usdc'].available, 5_010_000_000);
  assert.deepEqual(validateLedgerV2(settleRes.ledger), []);
});

test('settleBotPosition: losing outcome releases reservation and deducts stake from available', () => {
  const ledger = createSeedLedgerV2();
  const orderRes = executeBotOrder(ledger, {
    id: 's', marketId: 'm', strategy: 'btc_scalper', side: 'up', price: 0.5, confidence: 0.6, stakeUsdc: 10, reason: '', timestamp: 1
  }, 'pos-loss', 1);
  if (!orderRes.ok) throw new Error('Order failed');

  const settleRes = settleBotPosition(orderRes.ledger, orderRes.position, true, 'down', 2);
  assert.equal(settleRes.ok, true);
  if (!settleRes.ok) throw new Error('Settle failed');

  assert.equal(settleRes.position.pnlMinor, -10_000_000);
  assert.equal(settleRes.ledger.accounts['kenzo-usdc'].reserved, 0);
  assert.equal(settleRes.ledger.accounts['kenzo-usdc'].available, 4_990_000_000);
  assert.deepEqual(validateLedgerV2(settleRes.ledger), []);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
