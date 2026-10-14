import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { generateXauUsdM5, aggregateBars, runBacktest } = await import('../src/lib/engine/backtest');

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const SEED = 20261014;
const YEAR = 2026;
const M5_MS = 300_000;
const T0 = Date.UTC(2026, 0, 1);
const M5 = generateXauUsdM5(SEED, YEAR);
const TIMEFRAMES = ['M5', 'M15', 'H1'];
const PERIODS = ['1M', '6M', '1Y'];

/**
 * Engineered loss-bearing input: a 2000 / 2000.2 zigzag on M5 bars.
 * The EMA difference flips sign on every bar, so the engine opens and reverses
 * a position each bar. Each closed leg moves at most 0.2 against a 0.4 round-trip
 * cost (spread 0.3 + slippage 0.05 per side), so every closed trade must lose.
 */
function zigzagM5(count) {
  const bars = [];
  for (let i = 0; i < count; i++) {
    const price = i % 2 === 0 ? 2000 : 2000.2;
    bars.push({ t: T0 + i * M5_MS, open: price, high: price + 0.05, low: price - 0.05, close: price });
  }
  return bars;
}

const LOSS_OPTS = { period: '1M', seed: SEED, target: 3, stop: 5 };

check('(a) engineered zigzag input reports losses>0 and a negative-pnl trade', () => {
  const r = runBacktest(zigzagM5(300), { ...LOSS_OPTS, timeframe: 'M5' });
  assert.deepEqual(r.errors, []);
  assert.ok(r.trades > 0, 'engineered input must close trades');
  assert.ok(r.losses > 0, `expected losses>0, got ${r.losses}`);
  assert.ok(r.tradeLog.some((t) => t.pnl < 0), 'expected at least one trade with negative pnl');
  assert.ok(r.netPnl < 0, `expected net realized loss, got ${r.netPnl}`);
});

for (const tf of TIMEFRAMES) {
  for (const p of PERIODS) {
    check(`(b) ${tf}/${p}: finalEquity = initialEquity + realized + unrealized; curve ends at finalEquity`, () => {
      const bars = aggregateBars(M5, tf);
      const r = runBacktest(bars, { period: p, seed: SEED, target: 3, stop: 5, timeframe: tf });
      assert.deepEqual(r.errors, []);
      const initialEquity = r.costModel.initialEquity;
      assert.equal(r.finalEquity, initialEquity + r.realizedPnl + r.unrealizedPnl);
      assert.ok(r.equityCurve.length > 0, 'equity curve must be non-empty');
      assert.equal(r.equityCurve[r.equityCurve.length - 1].equity, r.finalEquity);
      assert.equal(r.sampleCount, r.equityCurve.length);
      assert.equal(r.bars, r.equityCurve.length);
    });
  }
}

check('(c) timeframe mismatch (H1 requested on M5 data) yields errors without throwing', () => {
  let r;
  assert.doesNotThrow(() => {
    r = runBacktest(zigzagM5(300), { ...LOSS_OPTS, timeframe: 'H1' });
  });
  assert.ok(r.errors.length > 0, 'mismatched timeframe must produce errors');
  assert.ok(r.errors.some((e) => /does not match/.test(e)), `unexpected errors: ${r.errors.join('; ')}`);
  assert.equal(r.trades, 0);
  assert.deepEqual(r.equityCurve, []);
});

check('(d) empty and malformed input returns errors and does not throw', () => {
  const cases = [
    ['empty array', [], LOSS_OPTS],
    ['null bars', null, LOSS_OPTS],
    ['non-array bars', { length: 3 }, LOSS_OPTS],
    ['bars with missing fields', [{}, { t: 1 }], LOSS_OPTS],
    ['NaN OHLC', [{ t: T0, open: NaN, high: NaN, low: NaN, close: NaN }], LOSS_OPTS],
    ['undefined options', zigzagM5(300), undefined],
    ['unsupported period', zigzagM5(300), { ...LOSS_OPTS, period: '5Y' }],
    ['non-positive stop', zigzagM5(300), { ...LOSS_OPTS, stop: 0 }],
  ];
  for (const [label, bars, opts] of cases) {
    let r;
    assert.doesNotThrow(() => {
      r = runBacktest(bars, opts);
    }, label);
    assert.ok(r.errors.length > 0, `${label}: expected errors`);
    assert.equal(r.trades, 0, `${label}: expected no trades`);
  }
});

check('(e) same seed yields identical series and identical engine results', () => {
  const a = generateXauUsdM5(SEED, YEAR);
  const b = generateXauUsdM5(SEED, YEAR);
  assert.deepStrictEqual(a, b);
  const opts = { period: '6M', seed: SEED, target: 3, stop: 5, timeframe: 'M15' };
  const ra = runBacktest(aggregateBars(a, 'M15'), opts);
  const rb = runBacktest(aggregateBars(b, 'M15'), opts);
  assert.deepStrictEqual(ra, rb);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
