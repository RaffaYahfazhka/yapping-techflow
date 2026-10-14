import { PAPER_ACCOUNT_SPECS, majorToMinor, validateLedgerV2, type PaperLedgerV2, type PaperAccountId, type Currency } from './paperLedgerV2';

export interface V2Position {
  id: string;
  accountId: PaperAccountId;
  currency: Currency;
  /** Reserved stake in minor units; moved from `available` to `reserved` on open. */
  stakeMinor: number;
  status: 'OPEN' | 'SETTLED';
  openedAt: number;
  settledAt?: number;
  /** Realized P&L in minor units of the account currency (settled only). */
  pnlMinor?: number;
}

export type OrderResult =
  | { ok: true; ledger: PaperLedgerV2; position: V2Position }
  | { ok: false; reason: 'invalid-amount' | 'insufficient-available' | 'unknown-account' | 'invariant-broken' };

/** Reserve stake from `available` into `reserved`. Never mutates the input ledger. */
export function openPositionV2(
  ledger: PaperLedgerV2,
  input: { id: string; accountId: PaperAccountId; stakeMajor: number; now: number },
): OrderResult {
  const acc = ledger.accounts[input.accountId];
  if (!acc) return { ok: false, reason: 'unknown-account' };
  if (!Number.isFinite(input.stakeMajor) || input.stakeMajor <= 0) return { ok: false, reason: 'invalid-amount' };

  let stakeMinor: number;
  try {
    stakeMinor = majorToMinor(input.stakeMajor, acc.currency);
  } catch {
    return { ok: false, reason: 'invalid-amount' };
  }
  if (stakeMinor <= 0) return { ok: false, reason: 'invalid-amount' };
  if (stakeMinor > acc.available) return { ok: false, reason: 'insufficient-available' };

  const next: PaperLedgerV2 = {
    ...ledger,
    revision: ledger.revision + 1,
    accounts: {
      ...ledger.accounts,
      [acc.accountId]: {
        ...acc,
        available: acc.available - stakeMinor,
        reserved: acc.reserved + stakeMinor,
      },
    },
  };
  if (validateLedgerV2(next).length > 0) return { ok: false, reason: 'invariant-broken' };

  const position: V2Position = {
    id: input.id,
    accountId: acc.accountId,
    currency: acc.currency,
    stakeMinor,
    status: 'OPEN',
    openedAt: input.now,
  };
  return { ok: true, ledger: next, position };
}

/**
 * Settle an open position: release its reservation and credit `available`
 * with stake + realized P&L. Loss is capped at the stake (no leverage here),
 * so `available` can never go negative.
 */
export function settlePositionV2(
  ledger: PaperLedgerV2,
  position: V2Position,
  outcome: { pnlMajor: number; now: number },
): OrderResult & { position?: V2Position } {
  if (position.status !== 'OPEN') return { ok: false, reason: 'invariant-broken' };
  const acc = ledger.accounts[position.accountId];
  if (!acc) return { ok: false, reason: 'unknown-account' };
  if (!Number.isFinite(outcome.pnlMajor)) return { ok: false, reason: 'invalid-amount' };

  let pnlMinor: number;
  try {
    pnlMinor = majorToMinor(outcome.pnlMajor, acc.currency);
  } catch {
    return { ok: false, reason: 'invalid-amount' };
  }
  const floorMinor = -position.stakeMinor;
  const clampedPnl = Math.max(floorMinor, pnlMinor);
  const credit = position.stakeMinor + clampedPnl;

  const next: PaperLedgerV2 = {
    ...ledger,
    revision: ledger.revision + 1,
    accounts: {
      ...ledger.accounts,
      [acc.accountId]: {
        ...acc,
        reserved: acc.reserved - position.stakeMinor,
        available: acc.available + credit,
      },
    },
  };
  if (validateLedgerV2(next).length > 0) return { ok: false, reason: 'invariant-broken' };

  const settled: V2Position = { ...position, status: 'SETTLED', settledAt: outcome.now, pnlMinor: clampedPnl };
  return { ok: true, ledger: next, position: settled };
}

export { PAPER_ACCOUNT_SPECS };
