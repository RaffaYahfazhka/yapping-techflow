import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { createSeedLedgerV2, validateLedgerV2 } = await import('../src/lib/engine/paperLedgerV2');
const { openPositionV2, settlePositionV2 } = await import('../src/lib/engine/paperLedgerOrders');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

ok('open moves stake from available to reserved and keeps invariants', () => {
  const l = createSeedLedgerV2();
  const r = openPositionV2(l, { id: 'p1', accountId: 'kenzo-usdc', stakeMajor: 100, now: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.ledger.accounts['kenzo-usdc'].available, 4_900_000_000);
  assert.equal(r.ledger.accounts['kenzo-usdc'].reserved, 100_000_000);
  assert.deepEqual(validateLedgerV2(r.ledger), []);
});

ok('open rejects stake larger than available', () => {
  const r = openPositionV2(createSeedLedgerV2(), { id: 'p', accountId: 'damian-usd', stakeMajor: 20000, now: 1 });
  assert.deepEqual(r, { ok: false, reason: 'insufficient-available' });
});

ok('open rejects non-positive, NaN, and infinite stakes', () => {
  const l = createSeedLedgerV2();
  for (const s of [0, -5, NaN, Infinity]) {
    assert.equal(openPositionV2(l, { id: 'p', accountId: 'altair-sol', stakeMajor: s, now: 1 }).ok, false);
  }
});

ok('open never mutates the input ledger', () => {
  const l = createSeedLedgerV2();
  const before = JSON.stringify(l);
  openPositionV2(l, { id: 'p', accountId: 'altair-sol', stakeMajor: 10, now: 1 });
  assert.equal(JSON.stringify(l), before);
});

ok('winning settle credits stake plus profit and releases reservation', () => {
  const l0 = createSeedLedgerV2();
  const o = openPositionV2(l0, { id: 'p', accountId: 'kenzo-usdc', stakeMajor: 100, now: 1 });
  const s = settlePositionV2(o.ledger, o.position, { pnlMajor: 80, now: 2 });
  assert.equal(s.ok, true);
  assert.equal(s.ledger.accounts['kenzo-usdc'].reserved, 0);
  assert.equal(s.ledger.accounts['kenzo-usdc'].available, 5_080_000_000);
  assert.equal(s.position.pnlMinor, 80_000_000);
});

ok('losing settle is capped at stake and never drives available negative', () => {
  const o = openPositionV2(createSeedLedgerV2(), { id: 'p', accountId: 'damian-usd', stakeMajor: 500, now: 1 });
  const s = settlePositionV2(o.ledger, o.position, { pnlMajor: -9999, now: 2 });
  assert.equal(s.ok, true);
  assert.equal(s.position.pnlMinor, -50_000);
  assert.equal(s.ledger.accounts['damian-usd'].available, 9_500 * 100);
  assert.deepEqual(validateLedgerV2(s.ledger), []);
});

ok('settling an already settled position is rejected (no double credit)', () => {
  const o = openPositionV2(createSeedLedgerV2(), { id: 'p', accountId: 'altair-sol', stakeMajor: 1, now: 1 });
  const s = settlePositionV2(o.ledger, o.position, { pnlMajor: 0, now: 2 });
  const again = settlePositionV2(s.ledger, s.position, { pnlMajor: 5, now: 3 });
  assert.equal(again.ok, false);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
