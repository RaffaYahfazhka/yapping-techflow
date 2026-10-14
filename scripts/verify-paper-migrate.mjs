import assert from 'node:assert/strict';
import { migrateLegacyLedger } from '../src/lib/engine/paperLedgerMigrate.ts';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };
const seedV1 = JSON.stringify({
  version: 1,
  balances: {
    'meteora-lp': { initial: 30, available: 30, reserved: 0 },
    'prediction-market': { initial: 10, available: 10, reserved: 0 },
    'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
  },
  trades: [],
});

ok('no legacy data seeds the three required balances', () => {
  const r = migrateLegacyLedger(null);
  assert.equal(r.kind, 'seeded');
  assert.equal(r.ledger.accounts['altair-sol'].available, 150_000_000_000);
});

ok('empty untouched legacy v1 migrates to v2 seed', () => {
  const r = migrateLegacyLedger(seedV1);
  assert.equal(r.kind, 'migrated');
  assert.equal(r.ledger.accounts['damian-usd'].available, 1_000_000);
});

ok('legacy v1 with an open trade enters recovery (never auto-converted)', () => {
  const withTrade = JSON.parse(seedV1);
  withTrade.trades = [{ id: 't1' }];
  const r = migrateLegacyLedger(JSON.stringify(withTrade));
  assert.equal(r.kind, 'recovery-required');
  assert.equal(r.rawPreserved, true);
});

ok('legacy v1 with changed balances enters recovery, not SOL reinterpretation', () => {
  const changed = JSON.parse(seedV1);
  changed.balances['meteora-lp'].available = 12.5;
  const r = migrateLegacyLedger(JSON.stringify(changed));
  assert.equal(r.kind, 'recovery-required');
});

ok('corrupt JSON enters recovery and preserves raw', () => {
  const r = migrateLegacyLedger('{not json');
  assert.equal(r.kind, 'recovery-required');
  assert.equal(r.reason, 'corrupt-json');
});

ok('compat PaperState shape enters recovery, not canonical migration', () => {
  const r = migrateLegacyLedger(JSON.stringify({ version: 1, openPositions: [], dailyTracking: {} }));
  assert.equal(r.kind, 'recovery-required');
  assert.equal(r.reason, 'compat-paperstate-v1');
});

ok('missing legacy account enters recovery', () => {
  const missing = JSON.parse(seedV1);
  delete missing.balances['xauusd-ea'];
  const r = migrateLegacyLedger(JSON.stringify(missing));
  assert.equal(r.kind, 'recovery-required');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
