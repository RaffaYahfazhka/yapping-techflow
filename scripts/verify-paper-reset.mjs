import assert from 'node:assert/strict';
import { resetPaperLedgerWithResult, resetPaperState, PAPER_STORAGE_KEY } from '../src/lib/engine/paperTrading.ts';

let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`✓ ${name}`); };

ok('reset writes fresh seed and reports persisted=true when store accepts it', () => {
  const data = new Map();
  const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const { ledger, persisted } = resetPaperLedgerWithResult(store);
  assert.equal(persisted, true);
  assert.equal(ledger.balances['meteora-lp'].available, 30);
  assert.ok(data.has(PAPER_STORAGE_KEY));
});

ok('reset reports persisted=false when the write throws (no silent success)', () => {
  const store = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  const { persisted, ledger } = resetPaperLedgerWithResult(store);
  assert.equal(persisted, false);
  assert.equal(ledger.trades.length, 0);
});

ok('reset reports persisted=false when no store is available', () => {
  assert.equal(resetPaperLedgerWithResult(undefined).persisted, false);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
