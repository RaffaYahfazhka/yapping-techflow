import {
  createSeedLedgerV2,
  validateLedgerV2,
  LEDGER_SCHEMA_VERSION,
  type PaperLedgerV2,
} from './paperLedgerV2';
import { migrateLegacyLedger, type MigrationOutcome } from './paperLedgerMigrate';

export const LEDGER_V2_STORAGE_KEY = 'kantor-raffa.paper-ledger.v2';
export const LEGACY_V1_STORAGE_KEY = 'kantor-raffa.paper-bots.v1';

export interface StoreLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export type LoadResult =
  | { status: 'ready'; ledger: PaperLedgerV2; source: 'v2' | 'migrated-v1' | 'seeded' }
  | { status: 'recovery-required'; reason: string; rawLegacy: string | null };

/**
 * Load the authoritative v2 ledger. Order:
 *  1. v2 record present and valid → use it.
 *  2. no v2 record → migrate v1 (or seed when there is no v1).
 *  3. anything ambiguous → recovery-required, legacy raw kept untouched.
 * The legacy key is removed only after the v2 record is written and read back valid.
 */
export function loadPaperLedgerV2(store: StoreLike): LoadResult {
  const v2raw = store.getItem(LEDGER_V2_STORAGE_KEY);
  if (v2raw !== null) {
    try {
      const parsed = JSON.parse(v2raw) as PaperLedgerV2;
      if (parsed.version === LEDGER_SCHEMA_VERSION && validateLedgerV2(parsed).length === 0) {
        return { status: 'ready', ledger: parsed, source: 'v2' };
      }
      return { status: 'recovery-required', reason: 'v2-invalid', rawLegacy: null };
    } catch {
      return { status: 'recovery-required', reason: 'v2-corrupt-json', rawLegacy: null };
    }
  }

  const legacyRaw = store.getItem(LEGACY_V1_STORAGE_KEY);
  const outcome: MigrationOutcome = migrateLegacyLedger(legacyRaw);
  if (outcome.kind === 'recovery-required') {
    return { status: 'recovery-required', reason: outcome.reason, rawLegacy: legacyRaw };
  }

  // Write v2, read it back, validate, and only then retire the legacy record.
  const ledger = outcome.ledger;
  try {
    store.setItem(LEDGER_V2_STORAGE_KEY, JSON.stringify(ledger));
    const back = JSON.parse(store.getItem(LEDGER_V2_STORAGE_KEY) ?? 'null') as PaperLedgerV2 | null;
    if (!back || validateLedgerV2(back).length > 0) {
      return { status: 'recovery-required', reason: 'readback-invalid', rawLegacy: legacyRaw };
    }
  } catch {
    return { status: 'recovery-required', reason: 'write-failed', rawLegacy: legacyRaw };
  }
  if (legacyRaw !== null) store.removeItem?.(LEGACY_V1_STORAGE_KEY);
  return {
    status: 'ready',
    ledger,
    source: outcome.kind === 'migrated' ? 'migrated-v1' : 'seeded',
  };
}

export interface SaveResult {
  persisted: boolean;
}

export function savePaperLedgerV2(store: StoreLike, ledger: PaperLedgerV2): SaveResult {
  try {
    store.setItem(LEDGER_V2_STORAGE_KEY, JSON.stringify(ledger));
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}

/** Confirmed reset: replaces the whole paper record with the seed. Reports persistence honestly. */
export function resetPaperLedgerV2(store: StoreLike): { ledger: PaperLedgerV2; persisted: boolean } {
  const ledger = createSeedLedgerV2();
  const { persisted } = savePaperLedgerV2(store, ledger);
  return { ledger, persisted };
}
