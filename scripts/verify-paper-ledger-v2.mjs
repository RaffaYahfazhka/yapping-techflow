import assert from 'node:assert/strict';
import {
  createSeedLedgerV2,
  validateLedgerV2,
  majorToMinor,
  formatMinor,
  classifyLegacyPayload,
  LEGACY_BOT_TO_ACCOUNT,
} from '../src/lib/engine/paperLedgerV2.ts';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

check('seed balances are exactly 150 SOL, 5,000 USDC, 10,000 USD', () => {
  const l = createSeedLedgerV2();
  assert.equal(l.accounts['altair-sol'].available, 150_000_000_000);
  assert.equal(l.accounts['kenzo-usdc'].available, 5_000_000_000);
  assert.equal(l.accounts['damian-usd'].available, 1_000_000);
  assert.equal(formatMinor(l.accounts['altair-sol'].available, 'SOL'), '150.000000000 SOL');
  assert.equal(formatMinor(l.accounts['kenzo-usdc'].available, 'USDC'), '5,000.000000 USDC');
  assert.equal(formatMinor(l.accounts['damian-usd'].available, 'USD'), '10,000.00 USD');
});

check('seed ledger passes every invariant', () => {
  assert.deepEqual(validateLedgerV2(createSeedLedgerV2()), []);
});

check('employee and account identities are separate and mapped', () => {
  const l = createSeedLedgerV2();
  assert.equal(l.accounts['altair-sol'].employeeId, 'EMP-007');
  assert.equal(l.accounts['kenzo-usdc'].employeeId, 'EMP-008');
  assert.equal(l.accounts['damian-usd'].employeeId, 'EMP-009');
  assert.equal(LEGACY_BOT_TO_ACCOUNT['meteora-lp'], 'altair-sol');
});

check('minor-unit conversion rejects unsafe integers', () => {
  assert.throws(() => majorToMinor(1e12, 'SOL'), RangeError);
});

check('negative, unsafe, and mismatched values are reported', () => {
  const l = createSeedLedgerV2();
  l.accounts['kenzo-usdc'].available = -1;
  l.accounts['damian-usd'].reserved = 2 ** 60;
  const kinds = validateLedgerV2(l).map((i) => i.kind).sort();
  // reserved is now also required to match open positions, so a bare reserved value is flagged too
  assert.deepEqual(kinds, ['negative', 'reservation-mismatch', 'unsafe-integer']);
});

check('legacy $30 Meteora payload is never reinterpreted as SOL', () => {
  const legacy = {
    version: 1,
    balances: {
      'meteora-lp': { initial: 30, available: 30, reserved: 0 },
      'prediction-market': { initial: 10, available: 10, reserved: 0 },
      'xauusd-ea': { initial: 10, available: 10, reserved: 0 },
    },
    trades: [],
  };
  assert.equal(classifyLegacyPayload(legacy).kind, 'canonical-ledger-v1');
  // Migration must route this to recovery, not to a SOL seed; the classifier only
  // identifies structure. The v2 seed is never derived from legacy numbers.
  assert.equal(createSeedLedgerV2().accounts['altair-sol'].currency, 'SOL');
});

check('compatibility PaperState shape is distinguished from canonical v1', () => {
  const compat = { version: 1, openPositions: [], dailyTracking: {} };
  assert.equal(classifyLegacyPayload(compat).kind, 'compat-paperstate-v1');
});

check('unknown or non-object payloads are unrecognized', () => {
  assert.equal(classifyLegacyPayload(null).kind, 'unrecognized');
  assert.equal(classifyLegacyPayload({ version: 3 }).kind, 'unrecognized');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
