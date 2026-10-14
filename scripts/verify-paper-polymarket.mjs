import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { createSeedLedgerV2, validateLedgerV2 } = await import('../src/lib/engine/paperLedgerV2');
const { placePolymarketOrderV2, settlePolymarketOrderV2 } = await import('../src/lib/engine/paperPolymarketV2');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

ok('winning Up at 0.5 pays stake/price and nets profit', () => {
  const l0 = createSeedLedgerV2();
  const o = placePolymarketOrderV2(l0, { id: 'a', side: 'up', stakeUsdc: 10, price: 0.5, now: 1 });
  assert.equal(o.ok, true);
  const s = settlePolymarketOrderV2(o.ledger, o.position, 0.5, 'up', 'up', 2);
  assert.equal(s.ok, true);
  assert.equal(s.position.pnlMinor, 10_000_000);
  assert.equal(s.ledger.accounts['kenzo-usdc'].available, 5_010_000_000);
  assert.equal(s.ledger.accounts['kenzo-usdc'].reserved, 0);
});

ok('losing side forfeits stake and leaves reservation released', () => {
  const o = placePolymarketOrderV2(createSeedLedgerV2(), { id: 'b', side: 'down', stakeUsdc: 10, price: 0.5, now: 1 });
  const s = settlePolymarketOrderV2(o.ledger, o.position, 0.5, 'up', 'down', 2);
  assert.equal(s.position.pnlMinor, -10_000_000);
  assert.equal(s.ledger.accounts['kenzo-usdc'].available, 4_990_000_000);
  assert.deepEqual(validateLedgerV2(s.ledger), []);
});

ok('prices outside (0,1) are rejected before reserving anything', () => {
  const l = createSeedLedgerV2();
  for (const p of [0, 1, -0.2, 1.5, NaN]) {
    assert.equal(placePolymarketOrderV2(l, { id: 'x', side: 'up', stakeUsdc: 5, price: p, now: 1 }).ok, false);
  }
});

ok('order ids are supplied by caller so two same-ms orders can differ', () => {
  const l = createSeedLedgerV2();
  const a = placePolymarketOrderV2(l, { id: 'poly-1', side: 'up', stakeUsdc: 1, price: 0.5, now: 7 });
  const b = placePolymarketOrderV2(a.ledger, { id: 'poly-2', side: 'up', stakeUsdc: 1, price: 0.5, now: 7 });
  assert.equal(a.position.id !== b.position.id, true);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
