import {
  createSeedLedgerV2,
  validateLedgerV2,
  LEDGER_SCHEMA_VERSION,
  type PaperLedgerV2,
} from '../engine/paperLedgerV2';
import { migrateLegacyLedger } from '../engine/paperLedgerMigrate';

export const PAPER_DATABASE = 'kantor-raffa';
export const PAPER_DATABASE_VERSION = 1;
export const PAPER_STORE = 'records';
export const PAPER_KEY = 'paper-ledger-v2';
export const LEGACY_KEY = 'kantor-raffa.paper-bots.v1';

export type PaperLoadResult =
  | { status: 'ready'; ledger: PaperLedgerV2; source: 'indexeddb' | 'migrated-v1' | 'seeded'; persisted: boolean }
  | { status: 'recovery-required'; reason: string; rawLegacy: string | null; persisted: false };

export interface PaperSummary {
  accounts: Array<{ accountId: string; currency: string; availableMinor: number; reservedMinor: number }>;
  openPositions: number;
  settledPositions: number;
  /** Realized P&L per currency in minor units. Currencies are never summed together. */
  realizedPnlMinor: Record<string, number>;
}

export type SaveOutcome = { persisted: true } | { persisted: false; reason: string };

export function summarizeLedger(ledger: PaperLedgerV2): PaperSummary {
  const realizedPnlMinor: Record<string, number> = {};
  for (const account of Object.values(ledger.accounts)) realizedPnlMinor[account.currency] = 0;
  for (const position of ledger.positions) {
    if (position.status === 'SETTLED') realizedPnlMinor[position.currency] += position.pnlMinor ?? 0;
  }
  return {
    accounts: Object.values(ledger.accounts).map(({ accountId, currency, available, reserved }) => ({
      accountId,
      currency,
      availableMinor: available,
      reservedMinor: reserved,
    })),
    openPositions: ledger.positions.filter((p) => p.status === 'OPEN').length,
    settledPositions: ledger.positions.filter((p) => p.status === 'SETTLED').length,
    realizedPnlMinor,
  };
}

export function isValidLedger(value: unknown): value is PaperLedgerV2 {
  if (!value || typeof value !== 'object') return false;
  const ledger = value as Partial<PaperLedgerV2>;
  if (ledger.version !== LEDGER_SCHEMA_VERSION) return false;
  if (!ledger.accounts || typeof ledger.accounts !== 'object' || !Array.isArray(ledger.positions)) return false;
  try {
    return validateLedgerV2(ledger as PaperLedgerV2).length === 0;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
  if (typeof indexedDB === 'undefined') {
    reject(new Error('IndexedDB unavailable'));
    return promise;
  }
  const request = indexedDB.open(PAPER_DATABASE, PAPER_DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(PAPER_STORE)) request.result.createObjectStore(PAPER_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  return promise;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  return promise;
}

/** Resolves when the transaction commits; rejects on error or abort. */
function transactionDone(tx: IDBTransaction): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  return promise;
}

function readLegacy(): string | null {
  try {
    return globalThis.localStorage?.getItem(LEGACY_KEY) ?? null;
  } catch {
    return null;
  }
}

function retireLegacy(): void {
  try {
    globalThis.localStorage?.removeItem(LEGACY_KEY);
  } catch {
    // Legacy cleanup is best-effort; the v2 record is already durable.
  }
}

/**
 * Load the authoritative IndexedDB ledger. A valid record wins. Otherwise the
 * legacy v1 payload is migrated once, written, read back, and only then retired.
 * Corrupt or ambiguous data enters recovery and is never overwritten.
 */
export async function loadPaperLedger(): Promise<PaperLoadResult> {
  const legacy = readLegacy();
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    // No IndexedDB: session-only; migration is computed but cannot be persisted.
    const migrated = migrateLegacyLedger(legacy);
    if (migrated.kind === 'recovery-required') {
      return { status: 'recovery-required', reason: migrated.reason, rawLegacy: legacy, persisted: false };
    }
    return {
      status: 'ready',
      ledger: migrated.ledger,
      source: migrated.kind === 'migrated' ? 'migrated-v1' : 'seeded',
      persisted: false,
    };
  }

  try {
    const current = await requestValue(db.transaction(PAPER_STORE, 'readonly').objectStore(PAPER_STORE).get(PAPER_KEY));
    if (current !== undefined) {
      if (!isValidLedger(current)) {
        return { status: 'recovery-required', reason: 'indexeddb-invalid', rawLegacy: null, persisted: false };
      }
      return { status: 'ready', ledger: current, source: 'indexeddb', persisted: true };
    }

    const outcome = migrateLegacyLedger(legacy);
    if (outcome.kind === 'recovery-required') {
      return { status: 'recovery-required', reason: outcome.reason, rawLegacy: legacy, persisted: false };
    }

    const write = db.transaction(PAPER_STORE, 'readwrite');
    const done = transactionDone(write);
    write.objectStore(PAPER_STORE).add(outcome.ledger, PAPER_KEY);
    await done;

    const saved = await requestValue(db.transaction(PAPER_STORE, 'readonly').objectStore(PAPER_STORE).get(PAPER_KEY));
    if (!isValidLedger(saved)) {
      return { status: 'recovery-required', reason: 'migration-readback-invalid', rawLegacy: legacy, persisted: false };
    }
    if (legacy !== null) retireLegacy();
    return {
      status: 'ready',
      ledger: saved,
      source: outcome.kind === 'migrated' ? 'migrated-v1' : 'seeded',
      persisted: true,
    };
  } catch {
    return { status: 'recovery-required', reason: 'indexeddb-read-write-failed', rawLegacy: legacy, persisted: false };
  } finally {
    db.close();
  }
}

/**
 * Compare-and-write in one readwrite transaction. The write is rejected when the
 * durable record has a different reset epoch or a revision that is not strictly
 * newer, so queued pre-reset saves and stale-tab mutations cannot resurrect state.
 */
export async function savePaperLedger(next: PaperLedgerV2): Promise<SaveOutcome> {
  if (!isValidLedger(next)) return { persisted: false, reason: 'ledger-invalid' };
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return { persisted: false, reason: 'indexeddb-unavailable' };
  }
  try {
    const tx = db.transaction(PAPER_STORE, 'readwrite');
    const store = tx.objectStore(PAPER_STORE);
    const durable = (await requestValue(store.get(PAPER_KEY))) as unknown;
    if (durable !== undefined) {
      if (!isValidLedger(durable)) {
        tx.abort();
        return { persisted: false, reason: 'durable-invalid' };
      }
      if (durable.resetEpoch !== next.resetEpoch) {
        tx.abort();
        return { persisted: false, reason: 'stale-reset-epoch' };
      }
      if (next.revision <= durable.revision) {
        tx.abort();
        return { persisted: false, reason: 'stale-revision' };
      }
    } else if (next.revision !== 0) {
      tx.abort();
      return { persisted: false, reason: 'missing-durable-ledger' };
    }
    const done = transactionDone(tx);
    store.put(next, PAPER_KEY);
    await done;
    return { persisted: true };
  } catch {
    return { persisted: false, reason: 'write-rejected-or-aborted' };
  } finally {
    db.close();
  }
}

/**
 * Explicit reset: atomically replaces only the paper record with the seed and
 * advances the reset epoch. Other IndexedDB namespaces are untouched.
 */
export async function resetPaperLedger(): Promise<PaperLoadResult> {
  let db: IDBDatabase;
  try {
    db = await openDatabase();
  } catch {
    return { status: 'ready', ledger: createSeedLedgerV2(), source: 'seeded', persisted: false };
  }
  try {
    const tx = db.transaction(PAPER_STORE, 'readwrite');
    const store = tx.objectStore(PAPER_STORE);
    const current = (await requestValue(store.get(PAPER_KEY))) as unknown;
    const seed = createSeedLedgerV2();
    if (isValidLedger(current)) {
      seed.resetEpoch = current.resetEpoch + 1;
      seed.revision = current.revision + 1;
    } else {
      seed.resetEpoch = 1;
    }
    const done = transactionDone(tx);
    store.put(seed, PAPER_KEY);
    await done;
    return { status: 'ready', ledger: seed, source: 'indexeddb', persisted: true };
  } catch {
    return { status: 'ready', ledger: createSeedLedgerV2(), source: 'seeded', persisted: false };
  } finally {
    db.close();
  }
}

/**
 * Explicit recovery: `discard-legacy` retires the raw legacy record only when the
 * user chooses it; both choices end in an explicit reset to the seed.
 */
export async function resolvePaperRecovery(choice: 'reset' | 'discard-legacy'): Promise<PaperLoadResult> {
  if (choice === 'discard-legacy') retireLegacy();
  return resetPaperLedger();
}
