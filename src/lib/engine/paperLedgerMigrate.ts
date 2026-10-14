import {
  createSeedLedgerV2,
  classifyLegacyPayload,
  validateLedgerV2,
  majorToMinor,
  LEGACY_BOT_TO_ACCOUNT,
  PAPER_ACCOUNT_SPECS,
  type PaperLedgerV2,
  type PaperAccountId,
} from './paperLedgerV2.ts';

export type MigrationOutcome =
  | { kind: 'migrated'; ledger: PaperLedgerV2; source: 'canonical-ledger-v1' }
  | { kind: 'seeded'; ledger: PaperLedgerV2; reason: 'no-legacy-data' }
  | { kind: 'recovery-required'; reason: string; rawPreserved: true };

/**
 * One-way migration from the v1 record. It never reinterprets a legacy number
 * as a different currency: the old `$30` Meteora balance is NOT treated as SOL.
 * Anything it cannot map losslessly goes to recovery and the raw source is kept.
 *
 * Only an empty, seed-compatible canonical v1 record is auto-seeded; a v1 record
 * with balances or open trades enters recovery so the user decides.
 */
export function migrateLegacyLedger(raw: string | null): MigrationOutcome {
  if (raw === null) {
    return { kind: 'seeded', ledger: createSeedLedgerV2(), reason: 'no-legacy-data' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'recovery-required', reason: 'corrupt-json', rawPreserved: true };
  }

  const cls = classifyLegacyPayload(parsed);
  if (cls.kind !== 'canonical-ledger-v1') {
    return { kind: 'recovery-required', reason: cls.kind, rawPreserved: true };
  }

  const obj = parsed as { balances: Record<string, Record<string, unknown>>; trades: unknown[] };

  // Auto-seed only when the legacy record carries no economic state at all.
  const hasOpenOrTrades = obj.trades.length > 0;
  const hasNonSeedBalances = Object.entries(obj.balances).some(
    ([, b]) => Number(b.available) !== Number(b.initial) || Number(b.reserved) !== 0,
  );
  if (hasOpenOrTrades || hasNonSeedBalances) {
    return { kind: 'recovery-required', reason: 'legacy-economic-state', rawPreserved: true };
  }

  const ledger = createSeedLedgerV2();
  for (const [legacyId, accountId] of Object.entries(LEGACY_BOT_TO_ACCOUNT) as [string, PaperAccountId][]) {
    if (!(legacyId in obj.balances)) {
      return { kind: 'recovery-required', reason: `missing-legacy-account:${legacyId}`, rawPreserved: true };
    }
  }
  const issues = validateLedgerV2(ledger);
  if (issues.length > 0) {
    return { kind: 'recovery-required', reason: 'seed-invalid', rawPreserved: true };
  }
  return { kind: 'migrated', ledger, source: 'canonical-ledger-v1' };
}

export { PAPER_ACCOUNT_SPECS, majorToMinor };
