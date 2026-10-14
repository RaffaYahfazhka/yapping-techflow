/**
 * Paper ledger schema v2 — pure model, no storage I/O.
 *
 * Amounts are persisted as integer minor units (safe integers only):
 *   SOL  → lamports  (1e9 per SOL)
 *   USDC → micro     (1e6 per USDC)
 *   USD  → cents     (1e2 per USD)
 *
 * Employee identity, paper-account identity, and currency stay separate fields.
 */

export const LEDGER_SCHEMA_VERSION = 2 as const;

export const CURRENCY_SCALE = {
  SOL: 1_000_000_000,
  USDC: 1_000_000,
  USD: 100,
} as const;

export type Currency = keyof typeof CURRENCY_SCALE;

export type EmployeeId = 'EMP-007' | 'EMP-008' | 'EMP-009';
export type PaperAccountId = 'altair-sol' | 'kenzo-usdc' | 'damian-usd';

export interface PaperAccountSpec {
  accountId: PaperAccountId;
  employeeId: EmployeeId;
  currency: Currency;
  seedMajor: number;
}

export const PAPER_ACCOUNT_SPECS: readonly PaperAccountSpec[] = [
  { accountId: 'altair-sol', employeeId: 'EMP-007', currency: 'SOL', seedMajor: 150 },
  { accountId: 'kenzo-usdc', employeeId: 'EMP-008', currency: 'USDC', seedMajor: 5000 },
  { accountId: 'damian-usd', employeeId: 'EMP-009', currency: 'USD', seedMajor: 10000 },
];

/** Legacy bot identity → v2 account. Used only by the one-way migrator. */
export const LEGACY_BOT_TO_ACCOUNT: Readonly<Record<string, PaperAccountId>> = {
  'meteora-lp': 'altair-sol',
  'prediction-market': 'kenzo-usdc',
  'xauusd-ea': 'damian-usd',
};

export interface PaperAccountV2 {
  accountId: PaperAccountId;
  employeeId: EmployeeId;
  currency: Currency;
  initial: number;
  available: number;
  reserved: number;
}

export interface PaperLedgerV2 {
  version: typeof LEDGER_SCHEMA_VERSION;
  revision: number;
  resetEpoch: number;
  accounts: Record<PaperAccountId, PaperAccountV2>;
}

export function majorToMinor(major: number, currency: Currency): number {
  const minor = Math.round(major * CURRENCY_SCALE[currency]);
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`amount ${major} ${currency} exceeds safe integer range`);
  }
  return minor;
}

export function formatMinor(minor: number, currency: Currency): string {
  const scale = CURRENCY_SCALE[currency];
  const digits = Math.round(Math.log10(scale));
  const whole = Math.trunc(minor / scale);
  const frac = Math.abs(minor % scale).toString().padStart(digits, '0');
  return `${whole.toLocaleString('en-US')}.${frac} ${currency}`;
}

/** Fresh seed ledger. Every balance is exactly the required demo amount. */
export function createSeedLedgerV2(): PaperLedgerV2 {
  const accounts = {} as Record<PaperAccountId, PaperAccountV2>;
  for (const spec of PAPER_ACCOUNT_SPECS) {
    const minor = majorToMinor(spec.seedMajor, spec.currency);
    accounts[spec.accountId] = {
      accountId: spec.accountId,
      employeeId: spec.employeeId,
      currency: spec.currency,
      initial: minor,
      available: minor,
      reserved: 0,
    };
  }
  return { version: LEDGER_SCHEMA_VERSION, revision: 0, resetEpoch: 0, accounts };
}

export type LedgerIssue =
  | { kind: 'unsafe-integer'; accountId: string; field: string }
  | { kind: 'negative'; accountId: string; field: string }
  | { kind: 'reservation-mismatch'; accountId: string }
  | { kind: 'currency-mismatch'; accountId: string }
  | { kind: 'missing-account'; accountId: string };

/** Structural + accounting invariants. Returns every issue found (empty = valid). */
export function validateLedgerV2(ledger: PaperLedgerV2): LedgerIssue[] {
  const issues: LedgerIssue[] = [];
  for (const spec of PAPER_ACCOUNT_SPECS) {
    const acc = ledger.accounts[spec.accountId];
    if (!acc) {
      issues.push({ kind: 'missing-account', accountId: spec.accountId });
      continue;
    }
    if (acc.currency !== spec.currency || acc.employeeId !== spec.employeeId) {
      issues.push({ kind: 'currency-mismatch', accountId: spec.accountId });
    }
    for (const field of ['initial', 'available', 'reserved'] as const) {
      const v = acc[field];
      if (!Number.isSafeInteger(v)) issues.push({ kind: 'unsafe-integer', accountId: spec.accountId, field });
      else if (v < 0) issues.push({ kind: 'negative', accountId: spec.accountId, field });
    }
  }
  return issues;
}

/**
 * Structural classification of a legacy v1 payload. Never reinterprets numbers
 * across currencies: the old `$30` Meteora balance is NOT treated as 30 SOL.
 */
export type LegacyClassification =
  | { kind: 'canonical-ledger-v1' }
  | { kind: 'compat-paperstate-v1' }
  | { kind: 'unrecognized' };

export function classifyLegacyPayload(raw: unknown): LegacyClassification {
  if (!raw || typeof raw !== 'object') return { kind: 'unrecognized' };
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return { kind: 'unrecognized' };
  const balances = obj.balances as Record<string, unknown> | undefined;
  if (balances && typeof balances === 'object' && Array.isArray(obj.trades)) {
    const sample = Object.values(balances)[0] as Record<string, unknown> | undefined;
    if (sample && 'initial' in sample && 'available' in sample && 'reserved' in sample) {
      return { kind: 'canonical-ledger-v1' };
    }
  }
  if (obj.openPositions !== undefined || obj.dailyTracking !== undefined) {
    return { kind: 'compat-paperstate-v1' };
  }
  return { kind: 'unrecognized' };
}
