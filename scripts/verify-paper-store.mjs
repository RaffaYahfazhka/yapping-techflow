import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const {
  loadPaperLedgerV2, savePaperLedgerV2, resetPaperLedgerV2,
  LEDGER_V2_STORAGE_KEY, LEGACY_V1_STORAGE_KEY,
} = await import('../src/lib/engine/paperLedgerStore');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };
const mem = (init = {}) => {
  const d = new Map(Object.entries(init));
  return {
    d,
    getItem: (k) => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => d.set(k, v),
    removeItem: (k) => d.delete(k),
  };
};
const legacySeed = JSON.stringify({
  version: 1,
  balances: {
    'meteora-lp': { initial: 30, available: 30, reserved: 0 },
    'prediction-market': { initial: 10, available: 10, reserved: 0 },
    'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
  },
  trades: [],
});

ok('fresh store seeds v2 and writes it', () => {
  const s = mem();
  const r = loadPaperLedgerV2(s);
  assert.equal(r.status, 'ready');
  assert.equal(r.source, 'seeded');
  assert.ok(s.d.has(LEDGER_V2_STORAGE_KEY));
});

ok('untouched v1 migrates, writes v2, and retires the legacy key', () => {
  const s = mem({ [LEGACY_V1_STORAGE_KEY]: legacySeed });
  const r = loadPaperLedgerV2(s);
  assert.equal(r.source, 'migrated-v1');
  assert.ok(s.d.has(LEDGER_V2_STORAGE_KEY));
  assert.equal(s.d.has(LEGACY_V1_STORAGE_KEY), false);
});

ok('existing v2 is loaded as-is, not re-migrated', () => {
  const s = mem();
  loadPaperLedgerV2(s);
  const again = loadPaperLedgerV2(s);
  assert.equal(again.source, 'v2');
});

ok('corrupt legacy keeps raw data and asks for recovery (no overwrite)', () => {
  const s = mem({ [LEGACY_V1_STORAGE_KEY]: '{bad' });
  const r = loadPaperLedgerV2(s);
  assert.equal(r.status, 'recovery-required');
  assert.equal(r.rawLegacy, '{bad');
  assert.equal(s.d.get(LEGACY_V1_STORAGE_KEY), '{bad');
  assert.equal(s.d.has(LEDGER_V2_STORAGE_KEY), false);
});

ok('corrupt v2 record enters recovery without silent reseed', () => {
  const s = mem({ [LEDGER_V2_STORAGE_KEY]: 'nope' });
  assert.equal(loadPaperLedgerV2(s).status, 'recovery-required');
});

ok('save reports persisted=false when the store throws', () => {
  const s = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(savePaperLedgerV2(s, resetPaperLedgerV2(mem()).ledger).persisted, false);
});

ok('reset replaces everything with the seed and reports persisted', () => {
  const s = mem({ [LEDGER_V2_STORAGE_KEY]: 'stale' });
  const { ledger, persisted } = resetPaperLedgerV2(s);
  assert.equal(persisted, true);
  assert.equal(ledger.accounts['altair-sol'].available, 150_000_000_000);
  assert.equal(JSON.parse(s.d.get(LEDGER_V2_STORAGE_KEY)).revision, 0);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
