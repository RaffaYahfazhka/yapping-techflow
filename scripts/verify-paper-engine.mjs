/**
 * Contract assertions for the local-only paper trading engine
 * (Trading Bot Division: Meteora LP, Prediction Market, XAUUSD EA).
 *
 * The tests import the REAL engine source — no duplicated fixture, no copied
 * constants — and assert the durable plan's contract:
 *
 *   - seed balances are exactly $30 / $10 / $10  (meteora-lp / prediction-market / xauusd-ea)
 *   - the storage key is exactly "kantor-raffa.paper-bots.v1"
 *   - corrupt persisted data is never silently replaced: loading reports `corrupt`
 *     and ONLY the explicit `resetPaperLedger()` action writes fresh seeds
 *   - the pure accounting, signal, sizing, gating and filtering helpers behave
 *     per their documented guarantees (no exchange / wallet / network code paths)
 *
 * Node cannot import TypeScript directly, so `scripts/ts-import-loader.mjs` is
 * registered first to strip types and resolve this repo's extensionless imports.
 *
 * Run: npm run test:engine
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Registering the loader before the dynamic imports below makes every `../src/**/*.ts`
// module resolve and type-strip through the real Node module pipeline.
register('./ts-import-loader.mjs', import.meta.url);

const engine = await import('../src/lib/engine/paperTrading.ts');
const { AGENTS } = await import('../src/lib/data/agents.ts');

// ---------------------------------------------------------------------------
// Tiny assertion runner (same reporting style as scripts/verify-movement.mjs)
// ---------------------------------------------------------------------------

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } catch (error) {
    failures.push(name);
    const detail = String(error?.message ?? error).split('\n')[0];
    console.error(`  \u2717 ${name}\n      ${detail}`);
  }
}

function section(title, body) {
  console.log(`\n${title}`);
  body();
}

const closeTo = (actual, expected, epsilon = 1e-9) =>
  Math.abs(actual - expected) <= epsilon;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEED_LEDGER = {
  version: 1,
  balances: {
    'meteora-lp': { initial: 30, available: 30, reserved: 0 },
    'prediction-market': { initial: 10, available: 10, reserved: 0 },
    'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
  },
  trades: [],
};

/** In-memory KeyValueStore matching the engine's `KeyValueStore` contract. */
function memoryStore(entries = []) {
  const map = new Map(entries);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    raw: (key) => (map.has(key) ? map.get(key) : null),
  };
}

/** Storage whose writes fail, like a full quota. */
function failingStore() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

const CANDLE_STEP_MS = 300_000;
const CANDLE_BASE_MS = 1_700_000_000_000;

/** A fully-closed M5 candle; `closeTime` is always `openTime + step`. */
const candle = (index, close, volume = 500) => ({
  openTime: CANDLE_BASE_MS + index * CANDLE_STEP_MS,
  closeTime: CANDLE_BASE_MS + (index + 1) * CANDLE_STEP_MS,
  open: close,
  high: close + 0.2,
  low: close - 0.2,
  close,
  volume,
});

const FLAT_CANDLES = Array.from({ length: 60 }, (_, i) => candle(i, 10));
// Flat, then a sharp rise on the last closed bar -> fast EMA crosses above slow.
const CROSS_UP_CANDLES = [...FLAT_CANDLES, candle(60, 8), candle(61, 8), candle(62, 8), candle(63, 14)];
// Flat, then a sharp fall -> fast EMA crosses below slow.
const CROSS_DOWN_CANDLES = [...FLAT_CANDLES, candle(60, 12), candle(61, 12), candle(62, 12), candle(63, 6)];
const NOW_MS = CANDLE_BASE_MS + 64 * CANDLE_STEP_MS;
const FRESH_QUOTE = { bid: 1999, ask: 2000, timestamp: NOW_MS - 1_000 };
const RISK_CONFIG = { riskPercent: 1, riskCapPercent: 2, maxSpread: 5, minTickVolume: 100 };

// ---------------------------------------------------------------------------
// 1. Durable plan constants
// ---------------------------------------------------------------------------

section('1. Durable plan constants', () => {
  check('PAPER_ACCOUNTS is exactly the three trading bots, in plan order', () => {
    assert.deepEqual([...engine.PAPER_ACCOUNTS], ['meteora-lp', 'prediction-market', 'xauusd-ea']);
  });

  check('ledger account keys match the trading bots in AGENTS (single source of truth)', () => {
    const tradingBotIds = AGENTS.filter((agent) => agent.workspace === 'trading').map((agent) => agent.id);
    assert.deepEqual([...engine.PAPER_ACCOUNTS], tradingBotIds);
  });

  check('seed balances are exactly $30 / $10 / $10', () => {
    assert.deepEqual(engine.PAPER_SEED_BALANCES, {
      'meteora-lp': 30,
      'prediction-market': 10,
      'xauusd-ea': 10,
    });
  });

  check('total paper capital is $50 and every seed is positive', () => {
    const seeds = Object.values(engine.PAPER_SEED_BALANCES);
    assert.equal(seeds.reduce((sum, value) => sum + value, 0), 50);
    assert.ok(seeds.every((value) => Number.isFinite(value) && value > 0));
  });

  check('storage key is exactly "kantor-raffa.paper-bots.v1"', () => {
    assert.equal(engine.PAPER_STORAGE_KEY, 'kantor-raffa.paper-bots.v1');
  });

  check('prediction-market window is 300 seconds', () => {
    assert.equal(engine.PREDICTION_MARKET_DURATION_SECONDS, 300);
  });

  check('EA defaults: EMA(9)/EMA(21)/ATR(14), 50-bar seed, 15s quote freshness', () => {
    assert.deepEqual(engine.EA_SIGNAL_DEFAULTS, {
      fastPeriod: 9,
      slowPeriod: 21,
      atrPeriod: 14,
      minClosedCandles: 50,
    });
    assert.equal(engine.EA_QUOTE_MAX_AGE_MS, 15_000);
  });
});

// ---------------------------------------------------------------------------
// 2. Ledger creation and validation
// ---------------------------------------------------------------------------

section('2. Ledger creation and validation', () => {
  check('createPaperLedger() returns a fresh v1 ledger at seed balances', () => {
    assert.deepEqual(engine.createPaperLedger(), SEED_LEDGER);
  });

  check('each account gets initial === available and reserved === 0', () => {
    const ledger = engine.createPaperLedger();
    for (const account of engine.PAPER_ACCOUNTS) {
      assert.deepEqual(ledger.balances[account], {
        initial: engine.PAPER_SEED_BALANCES[account],
        available: engine.PAPER_SEED_BALANCES[account],
        reserved: 0,
      });
    }
    assert.deepEqual(ledger.trades, []);
  });

  check('successive ledgers are independent objects (no shared mutable state)', () => {
    const first = engine.createPaperLedger();
    const second = engine.createPaperLedger();
    assert.notEqual(first.balances, second.balances);
    first.balances['meteora-lp'].available = 0;
    assert.equal(second.balances['meteora-lp'].available, 30);
    assert.equal(engine.PAPER_SEED_BALANCES['meteora-lp'], 30);
  });

  check('validatePaperLedger() accepts a fresh seed ledger', () => {
    const result = engine.validatePaperLedger(engine.createPaperLedger());
    assert.equal(result.ok, true);
    assert.deepEqual(result.ledger, SEED_LEDGER);
  });

  check('validatePaperLedger() accepts a ledger holding one open trade', () => {
    const opened = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'v-1',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 20,
    });
    assert.equal(engine.validatePaperLedger(opened).ok, true);
  });

  check('validatePaperLedger() rejects an unsupported version', () => {
    const result = engine.validatePaperLedger({ ...SEED_LEDGER, version: 2 });
    assert.equal(result.ok, false);
    assert.match(result.error, /version/i);
  });

  check('validatePaperLedger() rejects missing balances or trades', () => {
    assert.equal(engine.validatePaperLedger({ version: 1, trades: [] }).ok, false);
    assert.equal(engine.validatePaperLedger({ version: 1, balances: SEED_LEDGER.balances }).ok, false);
  });

  check('validatePaperLedger() rejects a reserved balance that ignores open trades', () => {
    const broken = {
      ...SEED_LEDGER,
      balances: { ...SEED_LEDGER.balances, 'meteora-lp': { initial: 30, available: 25, reserved: 5 } },
    };
    const result = engine.validatePaperLedger(broken);
    assert.equal(result.ok, false);
    assert.match(result.error, /reserved/i);
  });

  check('validatePaperLedger() rejects duplicate trade ids', () => {
    const trade = {
      id: 'dup',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 1,
      entryPrice: 5,
      status: 'OPEN',
      openedAt: '2026-01-01T00:00:00.000Z',
    };
    const result = engine.validatePaperLedger({
      version: 1,
      balances: { ...SEED_LEDGER.balances, 'meteora-lp': { initial: 30, available: 25, reserved: 5 } },
      trades: [trade, { ...trade }],
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /duplicate/i);
  });
});

// ---------------------------------------------------------------------------
// 3. Storage: corrupt data is reported, and only reset repairs it
// ---------------------------------------------------------------------------

section('3. Storage and explicit reset on corrupt data', () => {
  check('loadPaperLedger() seeds an empty store and persists it', () => {
    const store = memoryStore();
    const result = engine.loadPaperLedger(store);
    assert.equal(result.status, 'ready');
    assert.equal(result.created, true);
    assert.equal(result.persisted, true);
    assert.deepEqual(result.ledger, SEED_LEDGER);
    const written = store.raw(engine.PAPER_STORAGE_KEY);
    assert.equal(typeof written, 'string');
    assert.equal(engine.parsePaperLedger(written).ok, true);
  });

  check('loadPaperLedger() reports corrupt JSON with the raw payload and writes nothing', () => {
    const store = memoryStore([[engine.PAPER_STORAGE_KEY, '{not json']]);
    const result = engine.loadPaperLedger(store);
    assert.equal(result.status, 'corrupt');
    assert.equal(result.raw, '{not json');
    assert.match(result.error, /JSON/i);
    assert.equal(store.raw(engine.PAPER_STORAGE_KEY), '{not json');
  });

  check('loadPaperLedger() reports well-formed JSON with an invalid shape as corrupt', () => {
    const bad = JSON.stringify({ version: 2, balances: {}, trades: [] });
    const store = memoryStore([[engine.PAPER_STORAGE_KEY, bad]]);
    const result = engine.loadPaperLedger(store);
    assert.equal(result.status, 'corrupt');
    assert.equal(store.raw(engine.PAPER_STORAGE_KEY), bad);
  });

  check('parsePaperLedger() never falls back to defaults on bad input', () => {
    for (const raw of ['{not json', '', JSON.stringify({ version: 9 })]) {
      const result = engine.parsePaperLedger(raw);
      assert.equal(result.ok, false);
      assert.equal('ledger' in result, false);
      assert.equal(typeof result.error, 'string');
    }
  });

  check('loadPaperLedger() without a store (SSR) returns in-memory seeds, not persisted', () => {
    const result = engine.loadPaperLedger();
    assert.equal(result.status, 'ready');
    assert.equal(result.created, false);
    assert.equal(result.persisted, false);
    assert.deepEqual(result.ledger, SEED_LEDGER);
  });

  check('persistPaperLedger() returns false with no store and on write failure', () => {
    assert.equal(engine.persistPaperLedger(engine.createPaperLedger()), false);
    assert.equal(engine.persistPaperLedger(engine.createPaperLedger(), failingStore()), false);
  });

  check('resetPaperLedger() is the only path that replaces corrupt data with seeds', () => {
    const store = memoryStore([[engine.PAPER_STORAGE_KEY, '{"version":1,"balances":{}}']]);

    // Loading alone must not repair the corrupt payload.
    assert.equal(engine.loadPaperLedger(store).status, 'corrupt');
    assert.equal(store.raw(engine.PAPER_STORAGE_KEY), '{"version":1,"balances":{}}');

    const reset = engine.resetPaperLedger(store);
    assert.deepEqual(reset, SEED_LEDGER);
    assert.equal(engine.parsePaperLedger(store.raw(engine.PAPER_STORAGE_KEY)).ok, true);

    const reloaded = engine.loadPaperLedger(store);
    assert.equal(reloaded.status, 'ready');
    assert.equal(reloaded.created, false);
    assert.equal(reloaded.persisted, true);
    assert.deepEqual(reloaded.ledger, SEED_LEDGER);
  });

  check('resetPaperLedger() without a store still returns fresh seeds', () => {
    assert.deepEqual(engine.resetPaperLedger(), SEED_LEDGER);
  });
});

// ---------------------------------------------------------------------------
// 4. Paper accounting: fills, P&L, open and settle
// ---------------------------------------------------------------------------

section('4. Paper accounting (open / settle / P&L / fills)', () => {
  check('openPaperTrade() reserves notional and leaves the input ledger untouched', () => {
    const seed = engine.createPaperLedger();
    const opened = engine.openPaperTrade(seed, {
      id: 't-1',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 20,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.deepEqual(opened.balances['meteora-lp'], { initial: 30, available: 20, reserved: 10 });
    assert.equal(opened.trades.length, 1);
    assert.equal(opened.trades[0].status, 'OPEN');
    assert.equal(opened.trades[0].openedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(seed.balances['meteora-lp'].available, 30);
    assert.equal(seed.trades.length, 0);
  });

  check('openPaperTrade() rejects unknown accounts, bad numbers, overspend and duplicates', () => {
    const seed = engine.createPaperLedger();
    const base = { account: 'meteora-lp', marketId: 'SOL-USDC', side: 'BUY', entryPrice: 20 };

    assert.throws(() => engine.openPaperTrade(seed, { ...base, id: 'a', quantity: 0.5, account: 'nope' }), /Unknown paper account/);
    assert.throws(() => engine.openPaperTrade(seed, { ...base, id: 'b', quantity: 0 }), /Invalid quantity/);
    assert.throws(() => engine.openPaperTrade(seed, { ...base, id: 'c', quantity: -1 }), /Invalid quantity/);
    assert.throws(() => engine.openPaperTrade(seed, { ...base, id: 'd', quantity: 1, entryPrice: 0 }), /Invalid entry price/);
    assert.throws(() => engine.openPaperTrade(seed, { ...base, id: 'e', quantity: 40 }), /Insufficient paper balance/);

    const opened = engine.openPaperTrade(seed, { ...base, id: 'f', quantity: 0.5 });
    assert.throws(() => engine.openPaperTrade(opened, { ...base, id: 'f', quantity: 0.5 }), /Duplicate paper trade id/);
  });

  check('settlePaperTrade() pays out a profitable BUY: reserved notional plus P&L', () => {
    const opened = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'buy-win',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 20,
    });
    const settled = engine.settlePaperTrade(opened, 'buy-win', 24, '2026-01-02T00:00:00.000Z');
    assert.deepEqual(settled.balances['meteora-lp'], { initial: 30, available: 32, reserved: 0 });
    assert.equal(settled.trades[0].status, 'SETTLED');
    assert.equal(settled.trades[0].exitPrice, 24);
    assert.equal(settled.trades[0].pnl, 2);
    assert.equal(settled.trades[0].settledAt, '2026-01-02T00:00:00.000Z');
  });

  check('settlePaperTrade() profits a SELL when the price falls', () => {
    const opened = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'sell-win',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'SELL',
      quantity: 1,
      entryPrice: 10,
    });
    const settled = engine.settlePaperTrade(opened, 'sell-win', 8);
    assert.deepEqual(settled.balances['meteora-lp'], { initial: 30, available: 32, reserved: 0 });
    assert.equal(settled.trades[0].pnl, 2);
  });

  check('settlePaperTrade() returns a losing BUY slightly below the seed equity', () => {
    const opened = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'buy-loss',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 20,
    });
    const settled = engine.settlePaperTrade(opened, 'buy-loss', 18);
    assert.deepEqual(settled.balances['meteora-lp'], { initial: 30, available: 29, reserved: 0 });
    assert.equal(settled.trades[0].pnl, -1);
  });

  check('settlePaperTrade() rejects invalid prices and already-settled or unknown ids', () => {
    const opened = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'x',
      account: 'meteora-lp',
      marketId: 'SOL-USDC',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 20,
    });
    assert.throws(() => engine.settlePaperTrade(opened, 'x', 0), /Invalid settlement price/);
    assert.throws(() => engine.settlePaperTrade(opened, 'x', Number.NaN), /Invalid settlement price/);
    assert.throws(() => engine.settlePaperTrade(opened, 'missing', 21), /Open paper trade not found/);
    const settled = engine.settlePaperTrade(opened, 'x', 21);
    assert.throws(() => engine.settlePaperTrade(settled, 'x', 22), /Open paper trade not found/);
  });

  check('calculateEaPnl() applies BUY/SELL direction and zeroes invalid input', () => {
    assert.equal(engine.calculateEaPnl(100, 110, 2, 'BUY'), 20);
    assert.equal(engine.calculateEaPnl(100, 110, 2, 'SELL'), -20);
    assert.equal(engine.calculateEaPnl(100, 90, 2, 'SELL'), 20);
    assert.equal(engine.calculateEaPnl(100, 90, 2), -20);
    assert.equal(engine.calculateEaPnl(Number.NaN, 90, 2), 0);
    assert.equal(engine.calculateEaPnl(100, 90, -1), 0);
  });

  check('fillPrice() pays Ask to open a BUY and receives Bid to close it', () => {
    const quote = { bid: 1999, ask: 2000, timestamp: NOW_MS };
    assert.equal(engine.fillPrice('BUY', quote, 'open'), 2000);
    assert.equal(engine.fillPrice('SELL', quote, 'open'), 1999);
    assert.equal(engine.fillPrice('BUY', quote, 'close'), 1999);
    assert.equal(engine.fillPrice('SELL', quote, 'close'), 2000);
  });
});

// ---------------------------------------------------------------------------
// 5. Prediction-market filter (5-minute Up/Down)
// ---------------------------------------------------------------------------

section('5. Prediction-market filter (300-second Up/Down)', () => {
  const markets = [
    { id: 'm1', question: 'Bitcoin Up or Down — 5m', active: true, closed: false, durationSeconds: 300 },
    { id: 'm2', question: 'Ethereum Up or Down', duration: 300 },
    { id: 'm3', question: 'Bitcoin Up or Down', durationSeconds: 900 },
    { id: 'm4', question: 'Solana Up or Down', durationSeconds: 300, closed: true },
    { id: 'm5', question: 'Cardano Up or Down', durationSeconds: 300, active: false },
    { id: 'm6', question: 'Bitcoin price on Friday', durationSeconds: 300 },
    { id: 'm7', slug: 'btc-up-or-down', durationSeconds: 300, category: 'crypto' },
  ];

  check('keeps only active, open, 300s markets that mention Up or Down', () => {
    assert.deepEqual(
      engine.filterFiveMinuteMarkets(markets).map((market) => market.id),
      ['m1', 'm2', 'm7'],
    );
  });

  check('token narrowing is case-insensitive and matches question, slug or category', () => {
    assert.deepEqual(
      engine.filterFiveMinuteMarkets(markets, 'BTC').map((market) => market.id),
      ['m7'],
    );
    assert.deepEqual(
      engine.filterFiveMinuteMarkets(markets, 'down').map((market) => market.id),
      ['m1', 'm2'],
    );
  });

  check('an empty market list stays empty', () => {
    assert.deepEqual(engine.filterFiveMinuteMarkets([]), []);
  });
});

// ---------------------------------------------------------------------------
// 6. Meteora DLMM ranking
// ---------------------------------------------------------------------------

section('6. Meteora DLMM pool ranking (fee/TVL)', () => {
  const pools = [
    { address: 'A', tvl: 1000, fee24h: 100 },
    { address: 'B', tvl: 2000, fee24h: 100 },
    { address: 'C', tvl: 0, fee24h: 10 },
    { address: 'D', tvl: 500, fee24h: -1 },
    { address: 'E', tvl: 1000, fees24h: 250 },
    { address: 'F', tvl: 100, fee24h: 4 },
  ];

  check('orders by fee/TVL descending, dropping zero-TVL and negative-fee pools', () => {
    const ranked = engine.rankMeteoraPools(pools);
    assert.deepEqual(ranked.map((pool) => pool.address), ['E', 'A', 'B', 'F']);
    assert.ok(closeTo(ranked[0].feeTvlRatio, 0.25));
    assert.ok(closeTo(ranked[1].feeTvlRatio, 0.1));
    assert.ok(closeTo(ranked[2].feeTvlRatio, 0.05));
  });

  check('minTvl drops small pools and limit truncates the ranking', () => {
    assert.deepEqual(
      engine.rankMeteoraPools(pools, { minTvl: 500 }).map((pool) => pool.address),
      ['E', 'A', 'B'],
    );
    assert.deepEqual(
      engine.rankMeteoraPools(pools, { limit: 2 }).map((pool) => pool.address),
      ['E', 'A'],
    );
    assert.deepEqual(engine.rankMeteoraPools(pools, { limit: 0 }), []);
    assert.deepEqual(engine.rankMeteoraPools([]), []);
  });
});

// ---------------------------------------------------------------------------
// 7. Indicators: closed candles, EMA, ATR
// ---------------------------------------------------------------------------

section('7. Indicators (closed candles / EMA / ATR)', () => {
  check('closedCandles() drops the forming bar and sorts oldest first', () => {
    const forming = candle(64, 99);
    const shuffled = [CROSS_UP_CANDLES[3], forming, ...CROSS_UP_CANDLES.slice(0, 3)];
    const closed = engine.closedCandles(shuffled, NOW_MS);
    assert.equal(closed.length, 4);
    assert.equal(closed.some((bar) => bar.close === 99), false);
    assert.deepEqual(
      closed.map((bar) => bar.openTime),
      [...closed.map((bar) => bar.openTime)].sort((a, b) => a - b),
    );
  });

  check('emaSeries() seeds with the SMA of the first period and leaves gaps null', () => {
    assert.deepEqual(engine.emaSeries([1, 2, 3], 3), [null, null, 2]);
    assert.deepEqual(engine.emaSeries([5, 7], 1), [5, 7]);
    assert.deepEqual(engine.emaSeries([1, 2], 3), [null, null]);
  });

  check('latestAtr() needs period + 1 bars and averages true range', () => {
    const bars = Array.from({ length: 4 }, (_, i) => candle(i, 10));
    assert.ok(closeTo(engine.latestAtr(bars, 2), 0.4));
    assert.equal(engine.latestAtr([bars[0]], 2), null);
    assert.equal(engine.latestAtr(bars, 0), null);
  });
});

// ---------------------------------------------------------------------------
// 8. EA signal evaluation
// ---------------------------------------------------------------------------

section('8. EA EMA/ATR signal', () => {
  check('BUY on a confirmed EMA cross up', () => {
    const result = engine.evaluateEmaAtrSignal(CROSS_UP_CANDLES, NOW_MS);
    assert.equal(result.signal, 'BUY');
    assert.equal(result.reason, 'ema-cross-up');
    assert.equal(result.closedCount, CROSS_UP_CANDLES.length);
    assert.ok(result.atr > 0);
  });

  check('SELL on a confirmed EMA cross down', () => {
    const result = engine.evaluateEmaAtrSignal(CROSS_DOWN_CANDLES, NOW_MS);
    assert.equal(result.signal, 'SELL');
    assert.equal(result.reason, 'ema-cross-down');
  });

  check('HOLD when there is no cross', () => {
    const result = engine.evaluateEmaAtrSignal(FLAT_CANDLES, NOW_MS);
    assert.equal(result.signal, 'HOLD');
    assert.equal(result.reason, 'no-cross');
  });

  check('HOLD until the 50-bar seed is available', () => {
    const result = engine.evaluateEmaAtrSignal(FLAT_CANDLES.slice(0, 10), NOW_MS);
    assert.equal(result.signal, 'HOLD');
    assert.equal(result.reason, 'insufficient-seed');
    assert.equal(result.atr, null);
  });

  check('HOLD on invalid period configuration', () => {
    const result = engine.evaluateEmaAtrSignal(CROSS_UP_CANDLES, NOW_MS, {
      fastPeriod: 21,
      slowPeriod: 9,
      atrPeriod: 14,
      minClosedCandles: 50,
    });
    assert.equal(result.signal, 'HOLD');
    assert.equal(result.reason, 'invalid-periods');
  });

  check('the forming candle never contributes to a signal', () => {
    const result = engine.evaluateEmaAtrSignal([...CROSS_UP_CANDLES, candle(64, 20)], NOW_MS);
    assert.equal(result.closedCount, CROSS_UP_CANDLES.length);
    assert.equal(result.signal, 'BUY');
  });
});

// ---------------------------------------------------------------------------
// 9. Sizing, daily loss stop, quote freshness
// ---------------------------------------------------------------------------

section('9. Sizing, daily loss stop, quote freshness', () => {
  check('calculateEaPositionSize() risks the requested percent over the stop distance', () => {
    assert.equal(engine.calculateEaPositionSize(1000, 1, 10), 1);
    assert.equal(engine.calculateEaPositionSize(1000, 1, 10, 2), 0.5);
    assert.equal(engine.calculateEaPositionSize(500, 2, 5), 2);
  });

  check('calculateEaPositionSize() is zero on invalid input or a closed daily gate', () => {
    assert.equal(engine.calculateEaPositionSize(0, 1, 10), 0);
    assert.equal(engine.calculateEaPositionSize(1000, 0, 10), 0);
    assert.equal(engine.calculateEaPositionSize(1000, 1, 0), 0);
    assert.equal(engine.calculateEaPositionSize(1000, 1, 10, 1, 2, 2), 0);
    assert.equal(engine.calculateEaPositionSize(Number.NaN, 1, 10), 0);
  });

  check('isDailyLossLimitReached() trips at the exact limit and fails closed', () => {
    assert.equal(engine.isDailyLossLimitReached(100, 98), true);
    assert.equal(engine.isDailyLossLimitReached(100, 98.1), false);
    assert.equal(engine.isDailyLossLimitReached(100, 100), false);
    assert.equal(engine.isDailyLossLimitReached(100, 90, 5), true);
    assert.equal(engine.isDailyLossLimitReached(Number.NaN, 100), true);
    assert.equal(engine.isDailyLossLimitReached(0, 0), true);
  });

  check('isQuoteStale() allows 15s, rejects older or future stamps', () => {
    assert.equal(engine.isQuoteStale(NOW_MS, NOW_MS), false);
    assert.equal(engine.isQuoteStale(NOW_MS - 15_000, NOW_MS), false);
    assert.equal(engine.isQuoteStale(NOW_MS - 15_001, NOW_MS), true);
    assert.equal(engine.isQuoteStale(NOW_MS + 2_000, NOW_MS), true);
    assert.equal(engine.isQuoteStale(Number.NaN, NOW_MS), true);
  });
});

// ---------------------------------------------------------------------------
// 10. EA entry gate
// ---------------------------------------------------------------------------

section('10. EA entry gate', () => {
  check('allows a sized BUY that fills at the Ask when every check passes', () => {
    const decision = engine.evaluateEaEntry({
      ledger: engine.createPaperLedger(),
      candles: CROSS_UP_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    });
    assert.equal(decision.allowed, true);
    assert.deepEqual(decision.reasons, []);
    assert.equal(decision.side, 'BUY');
    assert.equal(decision.entryPrice, FRESH_QUOTE.ask);
    assert.ok(decision.size > 0 && Number.isFinite(decision.size));
    assert.equal(decision.signal.signal, 'BUY');
  });

  check('allows a SELL that fills at the Bid when every check passes', () => {
    const decision = engine.evaluateEaEntry({
      ledger: engine.createPaperLedger(),
      candles: CROSS_DOWN_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.side, 'SELL');
    assert.equal(decision.entryPrice, FRESH_QUOTE.bid);
  });

  check('blocks entries while risk cap, spread and volume limits are unconfigured', () => {
    const decision = engine.evaluateEaEntry({
      ledger: engine.createPaperLedger(),
      candles: CROSS_UP_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: { riskPercent: 1 },
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.side, undefined);
    for (const reason of ['risk-cap-unconfigured', 'spread-unconfigured', 'volume-unconfigured', 'size-zero']) {
      assert.ok(decision.reasons.includes(reason), `expected reason ${reason}`);
    }
  });

  check('blocks a missing or stale quote', () => {
    const base = {
      ledger: engine.createPaperLedger(),
      candles: CROSS_UP_CANDLES,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    };
    assert.ok(engine.evaluateEaEntry({ ...base, quote: undefined }).reasons.includes('quote-missing'));
    assert.ok(
      engine
        .evaluateEaEntry({ ...base, quote: { ...FRESH_QUOTE, timestamp: NOW_MS - 20_000 } })
        .reasons.includes('quote-stale'),
    );
  });

  check('blocks a second XAUUSD position and a reached daily loss stop', () => {
    const holding = engine.openPaperTrade(engine.createPaperLedger(), {
      id: 'held',
      account: 'xauusd-ea',
      marketId: 'XAUUSD',
      side: 'BUY',
      quantity: 0.001,
      entryPrice: 2000,
    });
    const holdingDecision = engine.evaluateEaEntry({
      ledger: holding,
      candles: CROSS_UP_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    });
    assert.equal(holdingDecision.allowed, false);
    assert.ok(holdingDecision.reasons.includes('one-open-position'));

    const drawnDown = {
      ...engine.createPaperLedger(),
      balances: {
        ...SEED_LEDGER.balances,
        'xauusd-ea': { initial: 10, available: 5, reserved: 0 },
      },
    };
    const lossDecision = engine.evaluateEaEntry({
      ledger: drawnDown,
      candles: CROSS_UP_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    });
    assert.equal(lossDecision.allowed, false);
    assert.ok(lossDecision.reasons.includes('daily-loss-limit'));
  });

  check('blocks entries while the signal is HOLD', () => {
    const decision = engine.evaluateEaEntry({
      ledger: engine.createPaperLedger(),
      candles: FLAT_CANDLES,
      quote: FRESH_QUOTE,
      nowMs: NOW_MS,
      dayStartEquity: 10,
      config: RISK_CONFIG,
    });
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.includes('no-signal:no-cross'));
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} contract assertions passed${failures.length ? `, ${failures.length} failed` : ''}`);

if (failures.length > 0) {
  console.error(`\nFailing contracts:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  console.error('\nPaper-trading engine contract violated \u2014 see reasons above.');
  process.exit(1);
}

console.log('\nPaper-trading engine contract verified against the real source \u2714');
