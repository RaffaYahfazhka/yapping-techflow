import type { PaperLedgerV2, PaperAccountId } from './paperLedgerV2';
import { openPositionV2, settlePositionV2, type V2Position } from './paperLedgerOrders';

/**
 * Polymarket binary outcome on the v2 ledger (kenzo-usdc).
 * Shares = stake / price; a winning share pays 1 USDC. Realized P&L = payout - stake.
 * Unlike v1, the stake is reserved on open and released on settle, and each order
 * gets a unique id from a monotonic counter rather than Date.now().
 */
export const POLY_ACCOUNT: PaperAccountId = 'kenzo-usdc';

export type PolySide = 'up' | 'down';

export type PolyOrderResult =
  | { ok: true; ledger: PaperLedgerV2; position: V2Position }
  | { ok: false; reason: 'invalid-price' | 'invalid-amount' | 'insufficient-available' | 'unknown-account' | 'invariant-broken' };

export function placePolymarketOrderV2(
  ledger: PaperLedgerV2,
  order: { id: string; side: PolySide; stakeUsdc: number; price: number; now: number; label?: string },
): PolyOrderResult {
  if (!(order.price > 0 && order.price < 1)) return { ok: false, reason: 'invalid-price' };
  const r = openPositionV2(ledger, {
    id: order.id,
    accountId: POLY_ACCOUNT,
    stakeMajor: order.stakeUsdc,
    now: order.now,
    label: order.label,
    side: order.side,
    price: order.price,
  });
  if (r.ok === false) return { ok: false, reason: r.reason };
  return { ok: true, ledger: r.ledger, position: r.position };
}

export function settlePolymarketOrderV2(
  ledger: PaperLedgerV2,
  position: V2Position,
  price: number,
  winningSide: PolySide,
  side: PolySide,
  now: number,
) {
  const won = side === winningSide;
  const stake = position.stakeMinor / 1_000_000;
  const payout = won ? stake / price : 0;
  return settlePositionV2(ledger, position, { pnlMajor: payout - stake, now });
}
