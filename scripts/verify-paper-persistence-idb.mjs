import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { register } from 'node:module';

register('./ts-import-loader.mjs', import.meta.url);
const { createSeedLedgerV2 } = await import('../src/lib/engine/paperLedgerV2');
const { openPositionV2, settlePositionV2 } = await import('../src/lib/engine/paperLedgerOrders');
const {
  loadPaperLedger,
  savePaperLedger,
  resetPaperLedger,
  resolvePaperRecovery,
  PAPER_DATABASE,
  PAPER_STORE,
  PAPER_KEY,
  LEGACY_KEY,
} = await import('../src/lib/storage/paperLedger');

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const memoryLocalStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    _data: data,
  };
};

const deleteDatabase = () => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase(PAPER_DATABASE);
  req.onsuccess = () => resolve();
  req.onerror = () => reject(req.error);
  req.onblocked = () => resolve();
});

const readDurable = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(PAPER_DATABASE);
  req.onsuccess = () => {
    const db = req.result;
    const get = db.transaction(PAPER_STORE, 'readonly').objectStore(PAPER_STORE).get(PAPER_KEY);
    get.onsuccess = () => { db.close(); resolve(get.result); };
    get.onerror = () => reject(get.error);
  };
  req.onerror = () => reject(req.error);
});

const writeDurableRaw = (value) => new Promise((resolve, reject) => {
  const req = indexedDB.open(PAPER_DATABASE, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(PAPER_STORE);
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction(PAPER_STORE, 'readwrite');
    tx.objectStore(PAPER_STORE).put(value, PAPER_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
  req.onerror = () => reject(req.error);
});

globalThis.localStorage = memoryLocalStorage();

await deleteDatabase();

await check('fresh IndexedDB seeds once and persists with persisted=true', async () => {
  const r = await loadPaperLedger();
  assert.equal(r.status, 'ready');
  assert.equal(r.persisted, true);
  assert.equal(r.source, 'seeded');
  const durable = await readDurable();
  assert.equal(durable.revision, 0);
  assert.equal(durable.accounts['altair-sol'].available, 150_000_000_000);
});

await check('second load returns the durable record (source=indexeddb)', async () => {
  const r = await loadPaperLedger();
  assert.equal(r.source, 'indexeddb');
  assert.equal(r.persisted, true);
});

await check('consecutive monotonic saves persist and advance the durable revision', async () => {
  const { ledger } = await loadPaperLedger();
  const o = openPositionV2(ledger, { id: 'p1', accountId: 'kenzo-usdc', stakeMajor: 100, now: 1 });
  const s1 = await savePaperLedger(o.ledger);
  assert.deepEqual(s1, { persisted: true });
  const s = settlePositionV2(o.ledger, o.position, { pnlMajor: 10, now: 2 });
  const s2 = await savePaperLedger(s.ledger);
  assert.deepEqual(s2, { persisted: true });
  assert.equal((await readDurable()).revision, 2);
});

await check('stale-revision: an older base cannot overwrite a newer durable record', async () => {
  const { ledger } = await loadPaperLedger();
  const newer = openPositionV2(ledger, { id: 'p2', accountId: 'kenzo-usdc', stakeMajor: 10, now: 3 });
  assert.deepEqual(await savePaperLedger(newer.ledger), { persisted: true });
  const stale = openPositionV2(ledger, { id: 'p3', accountId: 'altair-sol', stakeMajor: 1, now: 3 });
  const r = await savePaperLedger(stale.ledger);
  assert.equal(r.persisted, false);
  assert.equal(r.reason, 'stale-revision');
  assert.equal((await readDurable()).positions.some((p) => p.id === 'p3'), false);
});

await check('same-revision duplicate save is rejected (no double write)', async () => {
  const durable = await readDurable();
  const r = await savePaperLedger(structuredClone(durable));
  assert.equal(r.persisted, false);
  assert.equal(r.reason, 'stale-revision');
});

await check('stale-reset-epoch: a pre-reset ledger cannot commit after reset', async () => {
  const { ledger: preReset } = await loadPaperLedger();
  const reset = await resetPaperLedger();
  assert.equal(reset.persisted, true);
  assert.equal(reset.ledger.resetEpoch, preReset.resetEpoch + 1);
  const late = openPositionV2(preReset, { id: 'late', accountId: 'kenzo-usdc', stakeMajor: 5, now: 9 });
  const r = await savePaperLedger(late.ledger);
  assert.equal(r.persisted, false);
  assert.equal(r.reason, 'stale-reset-epoch');
  assert.equal((await readDurable()).positions.length, 0);
});

await check('reset bumps epoch and revision and clears every position', async () => {
  const before = await readDurable();
  const r = await resetPaperLedger();
  assert.equal(r.ledger.resetEpoch, before.resetEpoch + 1);
  assert.equal(r.ledger.revision, before.revision + 1);
  assert.equal(r.ledger.positions.length, 0);
  assert.equal(r.ledger.accounts['damian-usd'].available, 1_000_000);
});

await check('corrupt durable record enters recovery without reseeding', async () => {
  await writeDurableRaw({ version: 2, garbage: true });
  const r = await loadPaperLedger();
  assert.equal(r.status, 'recovery-required');
  assert.equal(r.reason, 'indexeddb-invalid');
  assert.equal((await readDurable()).garbage, true);
});

await check('explicit reset recovers from the invalid record', async () => {
  const r = await resolvePaperRecovery('reset');
  assert.equal(r.status, 'ready');
  assert.equal(r.persisted, true);
  assert.equal((await loadPaperLedger()).source, 'indexeddb');
});

await check('legacy v1 migrates once, writes v2, and retires the legacy key', async () => {
  await deleteDatabase();
  globalThis.localStorage = memoryLocalStorage({
    [LEGACY_KEY]: JSON.stringify({
      version: 1,
      balances: {
        'meteora-lp': { initial: 30, available: 30, reserved: 0 },
        'prediction-market': { initial: 10, available: 10, reserved: 0 },
        'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
      },
      trades: [],
    }),
  });
  const r = await loadPaperLedger();
  assert.equal(r.status, 'ready');
  assert.equal(r.source, 'migrated-v1');
  assert.equal(r.persisted, true);
  assert.equal(globalThis.localStorage.getItem(LEGACY_KEY), null);
  assert.equal((await readDurable()).accounts['altair-sol'].available, 150_000_000_000);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
