import { majorToMinor, validateLedgerV2, type PaperLedgerV2, type PaperPositionV2, type PaperAccountId, type Currency } from './paperLedgerV2';

export type V2Position = PaperPositionV2;

export type OrderResult =
  | { ok: true; ledger: PaperLedgerV2; position: V2Position }
  | { ok: false; reason: 'invalid-amount' | 'insufficient-available' | 'unknown-account' | 'invariant-broken' };

/** Reserve stake from `available` into `reserved`. Never mutates the input ledger. */
export function openPositionV2(
  ledger: PaperLedgerV2,
  input: { id: string; accountId: PaperAccountId; stakeMajor: number; now: number; label?: string; side?: string; price?: number },
): OrderResult {
  if ((ledger.positions ?? []).some((p) => p.id === input.id)) return { ok: false, reason: 'invariant-broken' };
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

  const position: PaperPositionV2 = {
    id: input.id,
    accountId: acc.accountId,
    currency: acc.currency,
    stakeMinor,
    status: 'OPEN',
    label: input.label ?? '',
    side: input.side ?? '',
    price: input.price ?? 0,
    openedAt: input.now,
  };
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
    positions: [...(ledger.positions ?? []), position],
  };
  if (validateLedgerV2(next).length > 0) return { ok: false, reason: 'invariant-broken' };
  return { ok: true, ledger: next, position: position };
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
  const stored = (ledger.positions ?? []).find((p) => p.id === position.id);
  if (!stored || stored.status !== 'OPEN') return { ok: false, reason: 'invariant-broken' };
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

  const settled: PaperPositionV2 = { ...stored, status: 'SETTLED', settledAt: outcome.now, pnlMinor: clampedPnl };
  const next: PaperLedgerV2 = {
    ...ledger,
    revision: ledger.revision + 1,
    accounts: {
      ...ledger.accounts,
      [acc.accountId]: {
        ...acc,
        reserved: acc.reserved - stored.stakeMinor,
        available: acc.available + stored.stakeMinor + clampedPnl,
      },
    },
    positions: (ledger.positions ?? []).map((p) => (p.id === stored.id ? settled : p)),
  };
  if (validateLedgerV2(next).length > 0) return { ok: false, reason: 'invariant-broken' };
  return { ok: true, ledger: next, position: settled };
}

