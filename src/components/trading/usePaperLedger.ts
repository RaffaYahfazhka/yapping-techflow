'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PAPER_ACCOUNTS,
  type PaperAccount,
  type PaperBalance,
  type PaperLedger,
  type PaperTrade,
  loadPaperLedger,
  openPaperTrade,
  persistPaperLedger,
  resetPaperLedger,
  settlePaperTrade,
} from '../../lib/engine/paperTrading';

/**
 * State owner untuk ledger paper (satu instance per desk bot yang sedang tampil).
 *
 * Semua mutasi memakai fungsi murni ledger engine lalu menulis ulang lewat
 * `persistPaperLedger`, sehingga UI tidak pernah menyentuh storage langsung dan
 * tidak pernah mengarang saldo. Data yang rusak TIDAK diperbaiki otomatis:
 * status `corrupt` hanya menyediakan tombol reset eksplisit.
 */

export type PaperLedgerStatus = 'loading' | 'ready' | 'corrupt';

export interface PaperActionFeedback {
  tone: 'ok' | 'danger';
  message: string;
}

export interface PaperLedgerController {
  status: PaperLedgerStatus;
  ledger: PaperLedger | null;
  corruptRaw: string | null;
  /** false bila storage tidak tersedia (mis. SSR / localStorage diblokir). */
  persisted: boolean;
  feedback: PaperActionFeedback | null;
  dismissFeedback: () => void;
  balanceOf: (account: PaperAccount) => PaperBalance | null;
  tradesOf: (account: PaperAccount) => PaperTrade[];
  openTrade: (input: {
    account: PaperAccount;
    marketId: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
  }) => boolean;
  settleTrade: (id: string, exitPrice: number) => boolean;
  reset: () => void;
}

export function usePaperLedger(): PaperLedgerController {
  const [status, setStatus] = useState<PaperLedgerStatus>('loading');
  const [ledger, setLedger] = useState<PaperLedger | null>(null);
  const [corruptRaw, setCorruptRaw] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [feedback, setFeedback] = useState<PaperActionFeedback | null>(null);
  const feedbackTimer = useRef<NodeJS.Timeout | null>(null);

  const pushFeedback = useCallback((next: PaperActionFeedback) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 7000);
    setFeedback(next);
  }, []);

  useEffect(() => {
    const result = loadPaperLedger();
    if (result.status === 'ready') {
      setLedger(result.ledger);
      setPersisted(result.persisted);
      setStatus('ready');
    } else {
      setCorruptRaw(null);
      setStatus('corrupt');
    }
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);
  const commit = useCallback(
    (next: PaperLedger) => {
      setLedger(next);
      setPersisted(persistPaperLedger(next));
    },
    []
  );

  return useMemo<PaperLedgerController>(
    () => ({
      status,
      ledger,
      corruptRaw,
      persisted,
      feedback,
      dismissFeedback: () => setFeedback(null),

      balanceOf: (account) => {
        if (!ledger) return null;
        return ledger.balances[account] ?? null;
      },

      tradesOf: (account) => {
        if (!ledger) return [];
        return ledger.trades
          .filter((trade) => trade.account === account)
          .sort((a, b) => Date.parse(String(b.openedAt)) - Date.parse(String(a.openedAt)));
      },

      openTrade: (input) => {
        if (!ledger) return false;
        try {
          const next = openPaperTrade(ledger, {
            id: `paper-${input.account}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            account: input.account,
            marketId: input.marketId,
            side: input.side,
            quantity: input.quantity,
            entryPrice: input.entryPrice,
          });
          commit(next);
          pushFeedback({
            tone: 'ok',
            message: `Posisi paper dicatat: ${input.side} ${input.quantity} × ${input.entryPrice} pada ${input.marketId}.`,
          });
          return true;
        } catch (err) {
          pushFeedback({ tone: 'danger', message: err instanceof Error ? err.message : 'Gagal mencatat posisi paper.' });
          return false;
        }
      },

      settleTrade: (id, exitPrice) => {
        if (!ledger) return false;
        try {
          const next = settlePaperTrade(ledger, id, exitPrice);
          commit(next);
          const settled = next.trades.find((trade) => trade.id === id);
          pushFeedback({
            tone: 'ok',
            message: `Posisi ${id} diselesaikan pada ${exitPrice} · PnL ${settled?.pnl ?? 0}.`,
          });
          return true;
        } catch (err) {
          pushFeedback({ tone: 'danger', message: err instanceof Error ? err.message : 'Gagal menyelesaikan posisi paper.' });
          return false;
        }
      },

      reset: () => {
        const next = resetPaperLedger();
        setCorruptRaw(null);
        setLedger(next);
        setPersisted(true);
        setStatus('ready');
        pushFeedback({ tone: 'ok', message: 'Ledger paper direset ke saldo seed (Meteora $30, Prediction $10, XAUUSD $10).' });
      },
    }),
    [status, ledger, corruptRaw, persisted, feedback, commit, pushFeedback]
  );
}

/** Akun paper yang dipakai bot trading — dipakai UI untuk menghitung ringkasan. */
export const PAPER_ACCOUNT_LIST: readonly PaperAccount[] = PAPER_ACCOUNTS;
