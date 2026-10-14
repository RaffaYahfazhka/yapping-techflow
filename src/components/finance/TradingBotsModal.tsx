'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { ShivBadge, ShivButton, ShivModal } from '@/components/ui/shiv';
import { useVenueFeed } from '@/components/trading/useVenueFeed';
import BacktestSimulator from '@/components/laptop/BacktestSimulator';
import { AGENTS } from '@/lib/data/agents';
import {
  isUsablePrice,
  type ExnessFeedData,
  type MarketFeedEnvelope,
  type MeteoraFeedData,
  type MeteoraPool,
  type PolymarketFeedData,
  type PolymarketMarket,
} from '@/lib/data/markets';
import type { PaperTrade } from '@/lib/engine/paperTrading';
import { placePolymarketOrderV2, settlePolymarketOrderV2 } from '@/lib/engine/paperPolymarketV2';
import { CURRENCY_SCALE, type PaperAccountId, type PaperLedgerV2 } from '@/lib/engine/paperLedgerV2';
import {
  loadPaperLedger,
  resetPaperLedger,
  resolvePaperRecovery,
  savePaperLedger,
} from '@/lib/storage/paperLedger';
import type { PaperLoadResult } from '@/lib/storage/paperLedger';

/** Named contract for a storage load/reset/recovery outcome, consumed by this modal. */
export type PaperLoadOutcome = PaperLoadResult;

interface TradingBotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBotId?: string;
  onFocusAgentInScene?: (id: string) => void;
}

type FeedTone = 'live' | 'stale' | 'unavailable' | 'connecting';
type LedgerState =
  | { status: 'loading' }
  | { status: 'ready'; ledger: PaperLedgerV2; persisted: boolean }
  | { status: 'recovery-required'; reason: string; hasLegacy: boolean };

type BuildResult = { ok: true; ledger: PaperLedgerV2 } | { ok: false; message: string };

const ACCOUNT_FOR_BOT: Record<string, PaperAccountId> = {
  'altair-raditya': 'altair-sol',
  'kenzo-danendra': 'kenzo-usdc',
  'damian-prasetya': 'damian-usd',
};

const TONE_COLOR: Record<FeedTone, string> = {
  live: '#34d399',
  stale: '#fbbf24',
  connecting: '#38bdf8',
  unavailable: '#f87171',
};

const POLL_MS = 6000;

const PANEL = 'flex min-w-0 flex-col gap-3 rounded-2xl border border-white/10 bg-[#111218] p-4';
const LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500';
const MONO = 'font-mono tabular-nums';
const TABLE_WRAP = 'overflow-x-auto rounded-xl border border-white/10 bg-[#0d0e13]';
const TH = 'whitespace-nowrap border-b border-white/10 px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500';
const TD = 'border-b border-white/5 px-2.5 py-2 align-top text-zinc-200';
const INPUT =
  'w-28 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white focus:border-emerald-400/60 focus:outline-none';

function feedTone<T>(envelope: MarketFeedEnvelope<T> | null, failed: boolean): FeedTone {
  if (!envelope) return failed ? 'stale' : 'connecting';
  return envelope.status === 'live' ? 'live' : 'stale';
}

function Banner({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'warn'; children: React.ReactNode }) {
  const palette = {
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    danger: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    warn: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${palette[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

function Metric({ label, value, color = '#ffffff', title }: { label: string; value: React.ReactNode; color?: string; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" title={title}>
      <span className={LABEL}>{label}</span>
      <span className={`${MONO} break-words text-lg font-extrabold`} style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function NativePriceChart({ points, strokeColor, label }: { points: number[]; strokeColor: string; label: string }) {
  if (points.length < 2) {
    return (
      <div className={PANEL}>
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
          <span>{label}</span>
          <span>Waiting for candle/tick series...</span>
        </div>
        <div className="flex h-36 items-center justify-center text-xs text-zinc-500">No price points recorded yet</div>
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 600;
  const height = 140;
  const pad = 12;

  const coords = points.map((val, idx) => {
    const x = pad + (idx / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return { x: x.toFixed(1), y: y.toFixed(1) };
  });
  const pathD = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
  const last = coords[coords.length - 1];
  const currentVal = points[points.length - 1];

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-zinc-400">
        <span>{label}</span>
        <span className={MONO} style={{ color: strokeColor }}>
          Current: {currentVal.toFixed(4)} (Min: {min.toFixed(4)} · Max: {max.toFixed(4)})
        </span>
      </div>
      <div className="relative h-44 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
          {[pad, height / 2, height - pad].map((y) => (
            <line key={y} x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          ))}
          <path d={`${pathD} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`} fill={`${strokeColor}15`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last.x} cy={last.y} r="4" fill={strokeColor} />
        </svg>
      </div>
    </div>
  );
}

export default function TradingBotsModal({
  isOpen,
  onClose,
  initialBotId = 'altair-raditya',
  onFocusAgentInScene,
}: TradingBotsModalProps) {
  const tradingBots = useMemo(() => AGENTS.filter((a) => a.workspace === 'trading'), []);

  const [activeBotId, setActiveBotId] = useState(initialBotId);
  const [ledgerState, setLedgerState] = useState<LedgerState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [polyStake, setPolyStake] = useState('2.00');
  const [polyStakeError, setPolyStakeError] = useState('');
  /** Sticky: set on any non-persisted outcome, cleared only by a later persisted save or reload. */
  const [stickyWarning, setStickyWarning] = useState<string | null>(null);
  const orderSeq = useRef(0);

  // Source of truth for logic. Mirrors the committed ledger; updated synchronously
  // on every commit so queued actions always build from the latest committed state.
  const ledgerRef = useRef<PaperLedgerV2 | null>(null);
  // Serializes writes: one in-flight save at a time.
  const inFlight = useRef(false);

  const ledgerV2 = ledgerState.status === 'ready' ? ledgerState.ledger : null;

  // Market feeds: envelope-validated hooks, polled while the modal is open.
  const meteoraFeed = useVenueFeed<MeteoraFeedData>('meteora', undefined, { enabled: isOpen, auto: true });
  const polyFeed = useVenueFeed<PolymarketFeedData>('polymarket', undefined, { enabled: isOpen, auto: true });
  const exnessFeed = useVenueFeed<ExnessFeedData>('exness', undefined, { enabled: isOpen, auto: true });
  const refreshMeteora = meteoraFeed.refresh;
  const refreshPoly = polyFeed.refresh;
  const refreshExness = exnessFeed.refresh;

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      refreshMeteora();
      refreshPoly();
      refreshExness();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isOpen, refreshMeteora, refreshPoly, refreshExness]);

  // Derived feed views (never fabricated: empty when the envelope is missing).
  const meteoraPools = useMemo<MeteoraPool[]>(() => meteoraFeed.envelope?.data?.pools ?? [], [meteoraFeed.envelope]);
  const meteoraStatus = feedTone(meteoraFeed.envelope, meteoraFeed.status === 'failed');
  const meteoraCandles = useMemo(
    () =>
      meteoraPools
        .slice(0, 10)
        .map((p) => Number(p.priceUsd || 0))
        .filter(isUsablePrice),
    [meteoraPools],
  );

  const polymarkets = useMemo<PolymarketMarket[]>(() => polyFeed.envelope?.data?.markets ?? [], [polyFeed.envelope]);
  const polyStatus = feedTone(polyFeed.envelope, polyFeed.status === 'failed');
  const polyMessage = polyFeed.envelope?.reason ?? '';

  const latestXauQuote = exnessFeed.envelope?.data?.quote ?? null;
  const exnessUnavailable = !exnessFeed.envelope
    ? exnessFeed.status === 'failed'
    : exnessFeed.envelope.status === 'unavailable' || exnessFeed.envelope.status === 'unconfigured' || !latestXauQuote;
  const exnessStatus: FeedTone = exnessUnavailable
    ? 'unavailable'
    : exnessFeed.envelope?.status === 'live'
      ? 'live'
      : exnessFeed.envelope
        ? 'stale'
        : 'connecting';
  const exnessMessage = exnessFeed.envelope?.reason || 'Exness XAUUSD feed unavailable';
  const latestXau = latestXauQuote ? { bid: latestXauQuote.bid, ask: latestXauQuote.ask } : null;

  const [xauTicks, setXauTicks] = useState<number[]>([]);
  const exnessLoadedAt = exnessFeed.lastLoadedAt;
  useEffect(() => {
    if (!latestXauQuote) return;
    setXauTicks((prev) => [...prev.slice(-30), latestXauQuote.bid]);
    // Append one tick per successful load, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exnessLoadedAt]);

  // Sync initial bot id.
  useEffect(() => {
    if (initialBotId && tradingBots.some((b) => b.id === initialBotId)) {
      setActiveBotId(initialBotId);
    }
  }, [initialBotId, tradingBots]);

  const applyReady = (ledger: PaperLedgerV2, persisted: boolean) => {
    ledgerRef.current = ledger;
    setLedgerState({ status: 'ready', ledger, persisted });
  };

  const applyLoadResult = (result: PaperLoadOutcome) => {
    if (result.status === 'ready') {
      applyReady(result.ledger, result.persisted);
    } else {
      ledgerRef.current = null;
      setLedgerState({ status: 'recovery-required', reason: result.reason, hasLegacy: result.rawLegacy !== null });
    }
  };

  // Load the durable ledger each time the modal opens. Recovery-required
  // never auto-seeds: the user must choose reset or discard explicitly.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    ledgerRef.current = null;
    setLedgerState({ status: 'loading' });
    loadPaperLedger().then((result) => {
      if (cancelled) return;
      applyLoadResult(result);
      if (result.status === 'ready' && !result.persisted) {
        setStickyWarning('Sesi saja: penyimpanan tidak tersedia. Order hilang saat halaman dimuat ulang.');
      }
    });
    return () => {
      cancelled = true;
    };
    // applyLoadResult only writes refs and state; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const activeBot = useMemo(
    () => tradingBots.find((b) => b.id === activeBotId) || tradingBots[0],
    [activeBotId, tradingBots],
  );

  const activeAccountId: PaperAccountId | null = ledgerV2 ? (ACCOUNT_FOR_BOT[activeBotId] ?? 'kenzo-usdc') : null;
  const activeAccount = ledgerV2 && activeAccountId ? ledgerV2.accounts[activeAccountId] : null;
  const currentBalance = activeAccount ? activeAccount.available / CURRENCY_SCALE[activeAccount.currency] : 0;
  const balanceLabel = `${currentBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${activeAccount?.currency || ''}`;

  const recentTrades = useMemo<PaperTrade[]>(() => {
    if (!ledgerV2 || !activeAccountId) return [];
    const currency = ledgerV2.accounts[activeAccountId].currency;
    const scale = CURRENCY_SCALE[currency];
    return ledgerV2.positions
      .filter((p) => p.accountId === activeAccountId)
      .slice()
      .reverse()
      .map((p) => {
        const pnl = p.pnlMinor === undefined ? undefined : p.pnlMinor / scale;
        return {
          id: p.id,
          market: p.label || p.id,
          side: (p.side || 'up') as PaperTrade['side'],
          stake: p.stakeMinor / scale,
          entryPrice: p.price,
          openedAt: p.openedAt,
          closedAt: p.settledAt,
          status: p.status === 'OPEN' ? 'OPEN' : 'SETTLED',
          outcome: p.status === 'OPEN' ? 'pending' : pnl !== undefined && pnl >= 0 ? 'win' : 'loss',
          grossPnl: pnl,
        } as PaperTrade;
      });
  }, [ledgerV2, activeAccountId]);

  /**
   * Serialized write path. `build` derives the successor from the latest committed
   * ledger; the result is only adopted after the durable write confirms.
   *   - persisted: adopt the successor, clear the sticky warning.
   *   - stale-revision / stale-reset-epoch: the durable record moved on (another tab
   *     or a reset). Discard the action, reload the durable copy, and say so.
   *   - any other failure: the order is NOT saved. Show a sticky warning and resync
   *     to the durable copy, which is the source of truth.
   */
  const commitWrite = async (build: (base: PaperLedgerV2) => BuildResult) => {
    if (inFlight.current) return;
    const base = ledgerRef.current;
    if (!base) return;
    const built = build(base);
    if (built.ok === false) {
      setPolyStakeError(built.message);
      return;
    }

    inFlight.current = true;
    setBusy(true);
    try {
      const outcome = await savePaperLedger(built.ledger);
      if (outcome.persisted === true) {
        applyReady(built.ledger, true);
        setStickyWarning(null);
        return;
      }
      const fenced = outcome.reason === 'stale-revision' || outcome.reason === 'stale-reset-epoch';
      if (fenced) {
        setStickyWarning('Ledger berubah di tab lain atau setelah reset. Aksi dibatalkan; data terbaru dimuat ulang.');
        applyLoadResult(await loadPaperLedger());
        return;
      }
      if (outcome.reason === 'indexeddb-unavailable') {
        // Option A: no durable store. Keep the session ledger in memory; do not resync,
        // because loadPaperLedger() would recompute a fresh seed and drop this session's orders.
        applyReady(built.ledger, false);
        setStickyWarning('Sesi saja: penyimpanan tidak tersedia. Order hilang saat halaman dimuat ulang.');
        return;
      }
      setStickyWarning(`Order tidak tersimpan (${outcome.reason}). Data tersimpan yang berlaku ditampilkan.`);
      applyLoadResult(await loadPaperLedger());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const runExplicit = async (action: () => Promise<PaperLoadOutcome>, success: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await action();
      applyLoadResult(result);
      if (result.status === 'ready') {
        setStickyWarning(result.persisted ? null : `${success} Penyimpanan gagal, perubahan hanya untuk sesi ini.`);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handleRecovery = (choice: 'reset' | 'discard-legacy') =>
    runExplicit(() => resolvePaperRecovery(choice), 'Saldo di-reset.');

  const handleResetLedger = () => runExplicit(() => resetPaperLedger(), 'Saldo di-reset.');

  const handlePolyOrder = (side: 'up' | 'down', market: PolymarketMarket) => {
    setPolyStakeError('');
    const stakeNum = parseFloat(polyStake);
    if (isNaN(stakeNum) || stakeNum <= 0) {
      setPolyStakeError('Stake harus berupa angka positif.');
      return;
    }
    const token = market.outcomes?.find((o) => o.outcome.toLowerCase() === side);
    const price = token ? token.price : 0.5;
    const id = `poly-${++orderSeq.current}-${Date.now()}`;
    void commitWrite((base) => {
      const res = placePolymarketOrderV2(base, {
        id,
        side,
        stakeUsdc: stakeNum,
        price,
        now: Date.now(),
        label: market.question,
      });
      if (res.ok === false) {
        return {
          ok: false,
          message:
            res.reason === 'insufficient-available' ? 'Stake melebihi saldo USDC tersedia.' : 'Gagal membuat paper order.',
        };
      }
      return { ok: true, ledger: res.ledger };
    });
  };

  const handlePolySettle = (tradeId: string) => {
    void commitWrite((base) => {
      const position = base.positions.find((p) => p.id === tradeId);
      if (!position || position.status !== 'OPEN') {
        return { ok: false, message: 'Posisi tidak lagi terbuka.' };
      }
      const side = (position.side as 'up' | 'down') || 'up';
      // Paper settlement: deterministic demo result (opposite side wins).
      const winningSide: 'up' | 'down' = side === 'up' ? 'down' : 'up';
      const res = settlePolymarketOrderV2(base, position, 0.5, winningSide, side, Date.now());
      if (res.ok === false) return { ok: false, message: 'Gagal menyelesaikan paper order.' };
      return { ok: true, ledger: res.ledger };
    });
  };

  if (!isOpen) return null;

  const botColor = activeBot.color || '#10b981';
  const actionsDisabled = !ledgerV2 || busy;

  return (
    <ShivModal isOpen={isOpen} onClose={onClose} size="xl" title="Trading Bots Workspace" subtitle="Paper-trading & real-time market feeds — virtual balances only, no live execution">
      <div className="-mx-4 -mt-1">
        {/* Bot tabs & Reset Portfolio Action */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-white/10 bg-[#12141d]/70 px-4 pb-3">
          <div className="flex items-center gap-2">
            {tradingBots.map((bot) => {
              const isActive = bot.id === activeBotId;
              const color = bot.color || '#10b981';
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => {
                    setActiveBotId(bot.id);
                    onFocusAgentInScene?.(bot.id);
                  }}
                  className="flex items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  style={{
                    borderColor: isActive ? color : 'rgba(255,255,255,0.08)',
                    background: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#ffffff' : '#a1a1aa',
                  }}
                >
                  <span className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span>{bot.name}</span>
                  <span className="text-[11px] opacity-60">({bot.employeeId})</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResetLedger()}
            className="ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
            title="Reset saldo paper trading ke nilai default awal ($10,000 USD / 150 SOL / $5,000 USDC)"
          >
            <RotateCcw size={12} className={busy ? 'animate-spin' : ''} />
            <span>Reset Balance / Portfolio</span>
          </button>
        </div>

        <div className="flex max-h-[calc(85vh-160px)] flex-col gap-5 overflow-y-auto p-4">
          {ledgerState.status === 'loading' && <div className="p-3 text-xs text-zinc-500">Memuat buku besar paper...</div>}

          {ledgerState.status === 'recovery-required' && (
            <Banner tone="danger">
              <div className="flex flex-col gap-3">
                <span>
                  Data paper trading lokal tidak dapat dibaca dengan aman ({ledgerState.reason}). Tidak ada saldo baru yang dibuat otomatis.
                </span>
                <div className="flex flex-wrap gap-2">
                  <ShivButton variant="danger" size="sm" disabled={busy} onClick={() => void handleRecovery('reset')}>
                    <RotateCcw size={12} />
                    Reset Saldo ke Default
                  </ShivButton>
                  {ledgerState.hasLegacy && (
                    <ShivButton variant="secondary" size="sm" disabled={busy} onClick={() => void handleRecovery('discard-legacy')}>
                      Buang data lama &amp; reset
                    </ShivButton>
                  )}
                </div>
              </div>
            </Banner>
          )}

          {stickyWarning && (
            <Banner tone="warn">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span role="status">{stickyWarning}</span>
                <ShivButton variant="secondary" size="sm" disabled={busy} onClick={() => void handleResetLedger()}>
                  <RotateCcw size={12} />
                  Reset Saldo ke Default
                </ShivButton>
              </div>
            </Banner>
          )}

          {/* Header metrics */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <Metric label="Virtual Balance (Paper)" value={balanceLabel} color={botColor} />

            <div className="flex min-w-0 flex-col gap-1">
              <span className={LABEL}>Connection Feed</span>
              {activeBotId === 'altair-raditya' && (
                <ShivBadge color={TONE_COLOR[meteoraStatus]}>{meteoraStatus.toUpperCase()} (Meteora DLMM)</ShivBadge>
              )}
              {activeBotId === 'kenzo-danendra' && (
                <ShivBadge color={TONE_COLOR[polyStatus]}>{polyStatus.toUpperCase()} (Polymarket Gamma)</ShivBadge>
              )}
              {activeBotId === 'damian-prasetya' && (
                <ShivBadge color={TONE_COLOR[exnessStatus]}>{exnessStatus.toUpperCase()} (Exness Demo)</ShivBadge>
              )}
            </div>

            <Metric label="Execution Mode" value={<span className="text-[13px] font-bold text-zinc-200">Paper Only (Simulation)</span>} />

            <Metric
              label="Strategy Status"
              value={
                <span className="text-[13px] font-semibold text-zinc-400">
                  {activeBotId === 'kenzo-danendra' ? 'Repo belum dipilih' : activeBot.duties.split(';')[0]}
                </span>
              }
            />
          </div>

          {/* Bot-specific view */}
          {activeBotId === 'altair-raditya' && (
            <>
              <Banner>
                <strong>Meteora LP Worker (Read-Only):</strong> Memeringkat pool Solana dari rasio fee/TVL 24 jam. Saldo virtual 150 SOL tidak dialokasikan karena metrik API tidak memodelkan impermanent loss atau bin-range fee DLMM personal.
              </Banner>

              <NativePriceChart points={meteoraCandles} strokeColor="#14f195" label="Meteora Top Pool Price Index" />

              <div className={PANEL}>
                <div className="text-[13px] font-bold text-zinc-200">Top Ranked DLMM Pools (Sorted by 24h Fee/TVL Ratio)</div>
                {meteoraPools.length === 0 ? (
                  <div className="p-3 text-xs text-zinc-500">
                    {meteoraStatus === 'stale' ? 'Meteora feed stale / offline' : 'Loading pools...'}
                  </div>
                ) : (
                  <div className={TABLE_WRAP}>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className={TH}>Pool Name</th>
                          <th className={TH}>Fee/TVL 24h</th>
                          <th className={TH}>24h Volume</th>
                          <th className={TH}>Current Price</th>
                          <th className={TH}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meteoraPools.slice(0, 8).map((pool) => (
                          <tr key={pool.address}>
                            <td className={`${TD} font-semibold`}>{pool.name || pool.address.slice(0, 8)}</td>
                            <td className={`${TD} font-mono text-[#14f195]`}>
                              {pool.feeTvlRatio ? `${(pool.feeTvlRatio * 100).toFixed(2)}%` : '—'}
                            </td>
                            <td className={`${TD} font-mono`}>${Number(pool.volume24h || 0).toLocaleString()}</td>
                            <td className={`${TD} font-mono`}>{pool.priceUsd ? `$${Number(pool.priceUsd).toFixed(4)}` : '—'}</td>
                            <td className={TD}>
                              <span className="text-[11px] text-emerald-400">Eligible</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeBotId === 'kenzo-danendra' && (
            <>
              <Banner>
                <strong>Polymarket 5m Crypto Worker:</strong> Memfilter pasar prediksi crypto Up/Down berdurasi 300 detik. Mendukung simulasi paper trade manual. Otomasi bot berstatus <em>Repo belum dipilih</em> hingga URL repositori GitHub diserahkan dan ditinjau.
              </Banner>

              <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
                <span className="text-[13px] font-semibold text-zinc-200">Paper Stake ($):</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max={currentBalance}
                  value={polyStake}
                  onChange={(e) => setPolyStake(e.target.value)}
                  className={INPUT}
                />
                <span className="text-[11px] text-zinc-500">Tersedia: {balanceLabel}</span>
                {polyStakeError && <span className="text-xs font-semibold text-rose-400">{polyStakeError}</span>}
              </div>

              <div className={PANEL}>
                <div className="text-[13px] font-bold text-zinc-200">
                  Active 5-Minute Crypto Up/Down Markets ({polymarkets.length})
                </div>
                {polymarkets.length === 0 ? (
                  <div className="p-4 text-[13px] text-zinc-400">{polyMessage || 'No active 5-minute crypto Up/Down market'}</div>
                ) : (
                  <div className={TABLE_WRAP}>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className={TH}>Market Question</th>
                          <th className={TH}>Up Price</th>
                          <th className={TH}>Down Price</th>
                          <th className={TH}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {polymarkets.map((m) => {
                          const upOutcome = m.outcomes?.find((o) => o.outcome.toLowerCase() === 'up');
                          const downOutcome = m.outcomes?.find((o) => o.outcome.toLowerCase() === 'down');
                          return (
                            <tr key={m.id}>
                              <td className={`${TD} max-w-[300px] font-semibold`}>{m.question}</td>
                              <td className={`${TD} font-mono text-emerald-400`}>
                                ${upOutcome?.price != null ? upOutcome.price.toFixed(2) : '—'}
                              </td>
                              <td className={`${TD} font-mono text-rose-400`}>
                                ${downOutcome?.price != null ? downOutcome.price.toFixed(2) : '—'}
                              </td>
                              <td className={TD}>
                                <div className="flex gap-1.5">
                                  <ShivButton variant="primary" size="sm" disabled={actionsDisabled} onClick={() => handlePolyOrder('up', m)}>
                                    Paper UP
                                  </ShivButton>
                                  <ShivButton variant="danger" size="sm" disabled={actionsDisabled} onClick={() => handlePolyOrder('down', m)}>
                                    Paper DOWN
                                  </ShivButton>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeBotId === 'damian-prasetya' && (
            <>
              {exnessStatus === 'unavailable' ? (
                <Banner tone="danger">
                  <strong>Exness XAUUSD feed unavailable.</strong> {exnessMessage} EA dalam status jeda (paused) tanpa harga simulasi buatan.
                </Banner>
              ) : (
                <Banner>
                  <strong>Exness Demo Feed Connected:</strong> Menampilkan Bid/Ask live XAUUSD via signed WebSocket SSE relay. Baseline eksperimental EMA(9)/EMA(21) + ATR(14) stop 1.5x aktif.
                </Banner>
              )}

              <NativePriceChart points={xauTicks} strokeColor="#f59e0b" label="XAUUSD Real-Time Price (Exness)" />

              <BacktestSimulator />

              {latestXau && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <Metric label="Bid" value={latestXau.bid.toFixed(2)} color="#f59e0b" />
                  <Metric label="Ask" value={latestXau.ask.toFixed(2)} color="#f59e0b" />
                  <Metric label="Spread" value={(latestXau.ask - latestXau.bid).toFixed(2)} color="#a1a1aa" />
                </div>
              )}
            </>
          )}

          {/* Paper trades ledger */}
          <div className={PANEL}>
            <div className="text-[13px] font-bold text-zinc-200">Recent Paper Trades &amp; Signals ({recentTrades.length})</div>
            {recentTrades.length === 0 ? (
              <div className="p-3 text-xs text-zinc-500">Belum ada riwayat paper trade untuk bot ini.</div>
            ) : (
              <div className={TABLE_WRAP}>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className={TH}>Time</th>
                      <th className={TH}>Market</th>
                      <th className={TH}>Side</th>
                      <th className={TH}>Stake</th>
                      <th className={TH}>Entry Price</th>
                      <th className={TH}>Exit Price</th>
                      <th className={TH}>Gross P&amp;L</th>
                      <th className={TH}>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t) => (
                      <tr key={t.id}>
                        <td className={`${TD} font-mono text-[11px]`}>{new Date(t.openedAt).toLocaleTimeString()}</td>
                        <td className={TD}>{t.market}</td>
                        <td className={`${TD} font-bold uppercase`}>{t.side}</td>
                        <td className={`${TD} font-mono`}>
                          {t.stake.toLocaleString('en-US', { maximumFractionDigits: 4 })} {activeAccount?.currency || ''}
                        </td>
                        <td className={`${TD} font-mono`}>${t.entryPrice.toFixed(4)}</td>
                        <td className={`${TD} font-mono`}>{t.exitPrice ? `$${t.exitPrice.toFixed(4)}` : '—'}</td>
                        <td
                          className={`${TD} font-mono font-bold`}
                          style={{
                            color: (t.grossPnl || 0) > 0 ? '#34d399' : (t.grossPnl || 0) < 0 ? '#f87171' : '#a1a1aa',
                          }}
                        >
                          {t.grossPnl !== undefined ? `$${t.grossPnl.toFixed(4)}` : '—'}
                        </td>
                        <td className={TD}>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              t.outcome === 'win'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : t.outcome === 'loss'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-white/10 text-zinc-400'
                            }`}
                          >
                            {t.outcome || 'pending'}
                          </span>
                          {activeBotId === 'kenzo-danendra' && t.outcome === 'pending' && (
                            <button
                              type="button"
                              disabled={actionsDisabled}
                              onClick={() => handlePolySettle(t.id)}
                              title="Settle paper order secara manual (demo 50/50)"
                              className="ml-2 rounded-md bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
                            >
                              Settle
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ShivModal>
  );
}
