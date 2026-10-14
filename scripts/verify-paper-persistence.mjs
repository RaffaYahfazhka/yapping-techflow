import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./ts-import-loader.mjs', import.meta.url);
const { createSeedLedgerV2 } = await import('../src/lib/engine/paperLedgerV2');
const {
  summarizeLedger,
  isValidLedger,
  loadPaperLedger,
  savePaperLedger,
  resetPaperLedger,
  resolvePaperRecovery,
  LEGACY_KEY,
} = await import('../src/lib/storage/paperLedger');
const { openPositionV2, settlePositionV2 } = await import('../src/lib/engine/paperLedgerOrders');

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

await check('summary reports seed balances per currency without summing across currencies', () => {
  const s = summarizeLedger(createSeedLedgerV2());
  assert.equal(s.accounts.length, 3);
  assert.equal(s.openPositions, 0);
  assert.equal(s.settledPositions, 0);
  assert.deepEqual(s.realizedPnlMinor, { SOL: 0, USDC: 0, USD: 0 });
  const sol = s.accounts.find((a) => a.currency === 'SOL');
  assert.equal(sol.availableMinor, 150_000_000_000);
});

await check('summary realized P&L is kept per currency after a settle', () => {
  const o = openPositionV2(createSeedLedgerV2(), { id: 'p1', accountId: 'kenzo-usdc', stakeMajor: 100, now: 1 });
  const s = settlePositionV2(o.ledger, o.position, { pnlMajor: 25, now: 2 });
  const sum = summarizeLedger(s.ledger);
  assert.equal(sum.settledPositions, 1);
  assert.equal(sum.realizedPnlMinor.USDC, 25_000_000);
  assert.equal(sum.realizedPnlMinor.SOL, 0);
});

await check('isValidLedger accepts seed and rejects a tampered reservation', () => {
  const seed = createSeedLedgerV2();
  assert.equal(isValidLedger(seed), true);
  const bad = structuredClone(seed);
  bad.accounts['altair-sol'].reserved = 5;
  assert.equal(isValidLedger(bad), false);
  assert.equal(isValidLedger(null), false);
  assert.equal(isValidLedger({ version: 1 }), false);
});

await check('without IndexedDB, savePaperLedger reports persisted=false instead of pretending success', async () => {
  const r = await savePaperLedger(createSeedLedgerV2());
  assert.equal(r.persisted, false);
  assert.equal(r.reason, 'indexeddb-unavailable');
});

await check('savePaperLedger rejects an invalid ledger before touching storage', async () => {
  const bad = createSeedLedgerV2();
  bad.accounts['kenzo-usdc'].available = -1;
  const r = await savePaperLedger(bad);
  assert.deepEqual(r, { persisted: false, reason: 'ledger-invalid' });
});

await check('without IndexedDB, reset returns a full seed in memory with persisted=false', async () => {
  const r = await resetPaperLedger();
  assert.equal(r.status, 'ready');
  assert.equal(r.persisted, false);
  assert.equal(r.ledger.accounts['damian-usd'].available, 1_000_000);
});

await check('without IndexedDB, a legacy v1 record with balances enters recovery and keeps raw data', async () => {
  const legacy = {
    version: 1,
    balances: { 'meteora-lp': { initial: 30, available: 12.5, reserved: 0 } },
    trades: [],
  };
  globalThis.localStorage = {
    getItem: (k) => (k === LEGACY_KEY ? JSON.stringify(legacy) : null),
    removeItem: () => {},
  };
  try {
    const r = await loadPaperLedger();
    assert.equal(r.status, 'recovery-required');
    assert.equal(r.rawLegacy, JSON.stringify(legacy));
  } finally {
    delete globalThis.localStorage;
  }
});

await check('discard-legacy recovery resolves to an explicit seed reset (epoch 0 without IndexedDB)', async () => {
  const r = await resolvePaperRecovery('discard-legacy');
  assert.equal(r.status, 'ready');
  assert.equal(r.ledger.resetEpoch, 0);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
