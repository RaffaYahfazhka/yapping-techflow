'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RotateCcw,
  Wallet,
  Radio,
  ShieldCheck,
  GitBranch,
  DollarSign,
  AlertCircle,
  Clock,
  TrendingUp,
  Inbox,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import { ShivBadge, ShivButton, ShivModal } from '@/components/ui/shiv';
import { useVenueFeed } from '@/components/trading/useVenueFeed';
import BacktestSimulator from '@/components/laptop/BacktestSimulator';
import TradingViewXauChart from '@/components/laptop/TradingViewXauChart';
import { usePredictionBot } from '@/components/trading/PredictionBotRuntime';
import { Play, Pause, Cpu } from 'lucide-react';
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

const PANEL = 'flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 backdrop-blur-sm shadow-sm';
const LABEL = 'font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400';
const MONO = 'font-mono tabular-nums';
const TABLE_WRAP = 'overflow-x-auto rounded-xl border border-white/10 bg-black/40';
const TH = 'whitespace-nowrap border-b border-white/10 px-4 py-3 text-left font-mono text-xs uppercase tracking-wider text-zinc-400 bg-white/[0.02]';
const TD = 'border-b border-white/5 px-4 py-3.5 align-middle text-sm text-zinc-200';
const INPUT =
  'w-32 rounded-xl border border-white/15 bg-black/50 py-2.5 pl-8 pr-3 font-mono text-sm font-semibold text-white focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400';

function feedTone<T>(envelope: MarketFeedEnvelope<T> | null, failed: boolean): FeedTone {
  if (!envelope) return failed ? 'stale' : 'connecting';
  return envelope.status === 'live' ? 'live' : 'stale';
}

function Banner({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'warn'; children: React.ReactNode }) {
  const palette = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.06)]',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.06)]',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.06)]',
  } as const;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4.5 text-xs md:text-sm leading-relaxed ${palette[tone]}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Sparkles size={18} className="mt-0.5 shrink-0 opacity-80" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  icon,
  color,
  title,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon?: React.ReactNode;
  color?: string;
  title?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4.5 transition hover:border-white/20 hover:bg-white/[0.05] backdrop-blur-sm shadow-sm"
      title={title}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
      <div className="mt-2.5 flex flex-col gap-1">
        <div className={`${MONO} break-words text-xl font-bold tracking-tight`} style={{ color: color || '#ffffff' }}>
          {value}
        </div>
        {subtext && <span className="text-[11px] text-zinc-500">{subtext}</span>}
      </div>
    </div>
  );
}

function NativePriceChart({ points, strokeColor, label }: { points: number[]; strokeColor: string; label: string }) {
  if (points.length < 2) {
    return (
      <div className={PANEL}>
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
          <div className="flex items-center gap-2">
            <Activity size={15} style={{ color: strokeColor }} />
            <span className="font-bold text-zinc-200">{label}</span>
          </div>
          <span className="font-mono text-zinc-500">Waiting for candle/tick series...</span>
        </div>
        <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 text-xs text-zinc-500">
          <Clock size={20} className="opacity-40" />
          <span>No price points recorded yet</span>
        </div>
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 800;
  const height = 160;
  const pad = 14;

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
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-400 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: strokeColor }} />
          <span className="text-sm font-bold text-white">{label}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="font-mono text-zinc-400">Min: <strong className="text-zinc-200">{min.toFixed(4)}</strong></span>
          <span className="font-mono text-zinc-400">Max: <strong className="text-zinc-200">{max.toFixed(4)}</strong></span>
          <span className="rounded-lg px-2.5 py-1 font-mono font-bold text-sm" style={{ background: `${strokeColor}20`, color: strokeColor }}>
            Current: {currentVal.toFixed(4)}
          </span>
        </div>
      </div>
      <div className="relative h-48 w-full pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
          {[pad, height / 2, height - pad].map((y) => (
            <line key={y} x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          ))}
          <path d={`${pathD} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`} fill={`${strokeColor}15`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last.x} cy={last.y} r="5" fill={strokeColor} />
          <circle cx={last.x} cy={last.y} r="9" fill={strokeColor} opacity="0.3" className="animate-ping" />
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
  const { telemetry, toggleRunning } = usePredictionBot();
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
    <ShivModal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      noPadding={true}
      title="Trading Bots Workspace"
      subtitle="Paper-trading & real-time market feeds — virtual balances only, no live execution"
    >
      <div className="flex flex-col h-full">
        {/* Bot tabs & Reset Portfolio Action */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-white/10 bg-[#0c0d14] px-6 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
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
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2 text-xs md:text-[13px] font-semibold transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  style={{
                    borderColor: isActive ? color : 'rgba(255,255,255,0.08)',
                    background: isActive ? `${color}18` : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#ffffff' : '#a1a1aa',
                    boxShadow: isActive ? `0 0 16px ${color}22` : 'none',
                  }}
                >
                  <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span>{bot.name}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono opacity-80">
                    {bot.employeeId}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResetLedger()}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 active:scale-95 disabled:opacity-50"
            title="Reset saldo paper trading ke nilai default awal ($10,000 USD / 150 SOL / $5,000 USDC)"
          >
            <RotateCcw size={13} className={busy ? 'animate-spin' : ''} />
            <span>Reset Balance / Portfolio</span>
          </button>
        </div>

        {/* Scrollable Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
          {ledgerState.status === 'loading' && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-400">
              <RotateCcw size={14} className="animate-spin text-emerald-400" />
              <span>Memuat buku besar paper trading...</span>
            </div>
          )}

          {ledgerState.status === 'recovery-required' && (
            <Banner tone="danger">
              <div className="flex flex-col gap-3">
                <span className="font-semibold">
                  Data paper trading lokal tidak dapat dibaca dengan aman ({ledgerState.reason}). Tidak ada saldo baru yang dibuat otomatis.
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <ShivButton variant="danger" size="sm" disabled={busy} onClick={() => void handleRecovery('reset')}>
                    <RotateCcw size={13} />
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
                <span role="status" className="font-medium">{stickyWarning}</span>
                <ShivButton variant="secondary" size="sm" disabled={busy} onClick={() => void handleResetLedger()}>
                  <RotateCcw size={13} />
                  Reset Saldo ke Default
                </ShivButton>
              </div>
            </Banner>
          )}

          {/* KPI Metrics: Balanced 4-column cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Virtual Balance (Paper)"
              value={balanceLabel}
              subtext="Zero risk · Virtual simulation"
              icon={<Wallet size={16} style={{ color: botColor }} />}
              color={botColor}
            />

            <MetricCard
              label="Connection Feed"
              value={
                activeBotId === 'altair-raditya' ? (
                  <ShivBadge color={TONE_COLOR[meteoraStatus]} glow>
                    {meteoraStatus.toUpperCase()} (Meteora DLMM)
                  </ShivBadge>
                ) : activeBotId === 'kenzo-danendra' ? (
                  <ShivBadge color={TONE_COLOR[polyStatus]} glow>
                    {polyStatus.toUpperCase()} (Polymarket Gamma)
                  </ShivBadge>
                ) : (
                  <ShivBadge color={TONE_COLOR[exnessStatus]} glow>
                    {exnessStatus.toUpperCase()} (Exness Demo)
                  </ShivBadge>
                )
              }
              subtext="Auto-polled every 6 seconds"
              icon={<Radio size={16} className="text-sky-400" />}
            />

            <MetricCard
              label="Execution Mode"
              value={<span className="text-base font-bold text-zinc-100">Paper Only (Simulation)</span>}
              subtext="Isolated non-custodial ledger"
              icon={<ShieldCheck size={16} className="text-emerald-400" />}
            />

            <MetricCard
              label="Strategy Status"
              value={
                <span className="text-sm font-semibold text-zinc-300">
                  {activeBotId === 'kenzo-danendra'
                    ? (telemetry.running ? 'Otomasi Aktif (Kelly Sizing)' : 'Otomasi Di-pause')
                    : activeBot.duties.split(';')[0]}
                </span>
              }
              subtext={activeBotId === 'kenzo-danendra' ? (telemetry.running ? 'Algoritma BTC Scalper & Momentum berjalan' : 'Eksekusi otomatis dijeda oleh user') : 'Active worker pipeline'}
              icon={<GitBranch size={16} className="text-amber-400" />}
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
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp size={16} className="text-[#14f195]" />
                    <span className="text-sm font-bold text-zinc-100">Top Ranked DLMM Pools (Sorted by 24h Fee/TVL Ratio)</span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                      {meteoraPools.length}
                    </span>
                  </div>
                </div>

                {meteoraPools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500">
                      <Inbox size={22} />
                    </div>
                    <div className="text-sm font-semibold text-zinc-300">
                      {meteoraStatus === 'stale' ? 'Meteora feed stale / offline' : 'Loading pools...'}
                    </div>
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
                          <tr key={pool.address} className="hover:bg-white/[0.02] transition">
                            <td className={`${TD} font-semibold text-zinc-100`}>{pool.name || pool.address.slice(0, 8)}</td>
                            <td className={`${TD} font-mono font-bold text-[#14f195]`}>
                              {pool.feeTvlRatio ? `${(pool.feeTvlRatio * 100).toFixed(2)}%` : '—'}
                            </td>
                            <td className={`${TD} font-mono`}>${Number(pool.volume24h || 0).toLocaleString()}</td>
                            <td className={`${TD} font-mono`}>{pool.priceUsd ? `$${Number(pool.priceUsd).toFixed(4)}` : '—'}</td>
                            <td className={TD}>
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                Eligible
                              </span>
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
              {/* Automated Prediction Bot Control Banner */}
              <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4.5 backdrop-blur-sm shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${telemetry.running ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                    <Cpu size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white tracking-wide">Automated Prediction Paper Bot</span>
                      <ShivBadge color={telemetry.running ? '#34d399' : '#fbbf24'} glow>
                        {telemetry.running ? 'RUNNING' : 'PAUSED'}
                      </ShivBadge>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 flex flex-wrap items-center gap-3">
                      <span>Strategi: <strong className="text-violet-300">BTC Scalper + Momentum (Kelly)</strong></span>
                      {telemetry.btcPrice && (
                        <span>BTC Spot: <strong className="font-mono text-zinc-200">${telemetry.btcPrice.toLocaleString()}</strong></span>
                      )}
                      <span>Eksekusi: <strong className="font-mono text-emerald-300">{telemetry.totalExecutions}</strong></span>
                      <span>Settle: <strong className="font-mono text-cyan-300">{telemetry.totalSettlements}</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleRunning}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide border transition-all ${
                    telemetry.running
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                >
                  {telemetry.running ? <><Pause size={14} /> Pause Bot</> : <><Play size={14} /> Resume Bot</>}
                </button>
              </div>

              {/* Order Configuration Panel */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5.5 backdrop-blur-sm shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 border border-violet-500/25">
                      <DollarSign size={22} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white tracking-wide">Paper Stake Amount</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Tersedia untuk simulasi order: <span className="font-mono font-semibold text-violet-300">{balanceLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold text-zinc-400">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        max={currentBalance}
                        value={polyStake}
                        onChange={(e) => setPolyStake(e.target.value)}
                        className={INPUT}
                      />
                    </div>

                    {/* Quick Stake Preset Chips */}
                    <div className="flex items-center gap-1.5">
                      {['1', '2', '5', '10', '50'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPolyStake(preset)}
                          className={`rounded-xl border px-3 py-2 font-mono text-xs font-semibold transition ${
                            polyStake === preset
                              ? 'border-violet-500/50 bg-violet-500/25 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                              : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPolyStake(Math.min(currentBalance, 100).toString())}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs font-semibold text-zinc-400 hover:bg-white/10 hover:text-white transition"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>

                {polyStakeError && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400">
                    <AlertCircle size={15} />
                    <span>{polyStakeError}</span>
                  </div>
                )}
              </div>

              {/* Active 5-Minute Markets Panel */}
              <div className={PANEL}>
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Clock size={16} className="text-violet-400" />
                    <span className="text-sm font-bold text-zinc-100">
                      Active 5-Minute Crypto Up/Down Markets
                    </span>
                    <span className="rounded-full bg-violet-500/15 border border-violet-500/25 px-2.5 py-0.5 font-mono text-xs font-bold text-violet-300">
                      {polymarkets.length}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">Window: 300s</span>
                </div>

                {polymarkets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500">
                      <Inbox size={22} />
                    </div>
                    <div className="text-sm font-semibold text-zinc-300">
                      {polyMessage || 'No active 5-minute crypto Up/Down market'}
                    </div>
                    <div className="text-xs text-zinc-500 max-w-md">
                      Polymarket feed sedang memindai kontrak 300s secara real-time. Pasar baru akan otomatis muncul di sini.
                    </div>
                  </div>
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
                            <tr key={m.id} className="hover:bg-white/[0.02] transition">
                              <td className={`${TD} max-w-[320px] font-semibold text-zinc-100`}>{m.question}</td>
                              <td className={`${TD} font-mono font-bold text-emerald-400`}>
                                ${upOutcome?.price != null ? upOutcome.price.toFixed(2) : '—'}
                              </td>
                              <td className={`${TD} font-mono font-bold text-rose-400`}>
                                ${downOutcome?.price != null ? downOutcome.price.toFixed(2) : '—'}
                              </td>
                              <td className={TD}>
                                <div className="flex gap-2">
                                  <ShivButton variant="primary" size="sm" disabled={actionsDisabled} onClick={() => handlePolyOrder('up', m)}>
                                    <ArrowUpRight size={13} />
                                    Paper UP
                                  </ShivButton>
                                  <ShivButton variant="danger" size="sm" disabled={actionsDisabled} onClick={() => handlePolyOrder('down', m)}>
                                    <ArrowDownRight size={13} />
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

              <TradingViewXauChart height={360} className="mb-2" />
              <NativePriceChart points={xauTicks} strokeColor="#f59e0b" label="XAUUSD Real-Time Price (Exness)" />
              <BacktestSimulator />

              {latestXau && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard label="Bid" value={latestXau.bid.toFixed(2)} color="#f59e0b" icon={<TrendingUp size={16} className="text-amber-400" />} />
                  <MetricCard label="Ask" value={latestXau.ask.toFixed(2)} color="#f59e0b" icon={<TrendingUp size={16} className="text-amber-400" />} />
                  <MetricCard label="Spread" value={(latestXau.ask - latestXau.bid).toFixed(2)} color="#a1a1aa" icon={<Activity size={16} className="text-zinc-400" />} />
                </div>
              )}
            </>
          )}

          {/* Paper trades ledger */}
          <div className={PANEL}>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-sm font-bold text-zinc-100">
                  Recent Paper Trades &amp; Signals
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-zinc-300">
                  {recentTrades.length}
                </span>
              </div>
            </div>

            {recentTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 text-zinc-500">
                  <Inbox size={22} />
                </div>
                <div className="text-sm font-semibold text-zinc-300">
                  Belum ada riwayat paper trade untuk bot ini.
                </div>
                <div className="text-xs text-zinc-500 max-w-md">
                  Simulasi paper trade yang Anda buka akan dicatat secara otomatis dalam buku besar lokal.
                </div>
              </div>
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
                      <tr key={t.id} className="hover:bg-white/[0.02] transition">
                        <td className={`${TD} font-mono text-xs text-zinc-400`}>{new Date(t.openedAt).toLocaleTimeString()}</td>
                        <td className={`${TD} font-semibold text-zinc-100`}>{t.market}</td>
                        <td className={`${TD} font-bold uppercase`}>
                          <span className={t.side === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.side}
                          </span>
                        </td>
                        <td className={`${TD} font-mono font-semibold`}>
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
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                t.outcome === 'win'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : t.outcome === 'loss'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-white/10 text-zinc-300 border border-white/10'
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
                                className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50 shadow-sm"
                              >
                                Settle
                              </button>
                            )}
                          </div>
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
