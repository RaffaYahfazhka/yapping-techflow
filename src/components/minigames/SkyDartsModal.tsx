'use client';

/**
 * Penthouse Sky Darts: exactly three throws per round, board-relative rendering.
 * Pointer: hold on the board to charge, release to throw (captured, so releasing
 * outside the board still counts). Keyboard: arrows aim, Space/Enter hold-to-charge,
 * or set power with the slider and press "Throw". Only a completed round persists.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Target, Play, X, Trophy, RotateCcw } from 'lucide-react';
import {
  DART_SWEET_MAX,
  DART_SWEET_MIN,
  DART_THROWS_PER_ROUND,
  isDartRoundComplete,
  resolveDartThrow,
  scoreDartRound,
  type ScoreRecord,
} from '@/lib/engine/minigames';
import {
  loadGameBoards,
  nextRecordId,
  resetGameBoard,
  RULESETS,
  submitCompletedScore,
  withSessionRecords,
  type GameBoards,
} from '@/lib/storage/gameScores';

export interface DartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
  onScored?: (score: number, label: string) => void;
}

interface DartThrowView {
  points: number;
  label: string;
  x: number;
  y: number;
}

const INITIAL_AIM = { x: 0.5, y: 0.5 };
/** Power sweeps 0→1→0 over this period while charging. */
const POWER_PERIOD_MS = 2200;
const AIM_STEP = 0.025;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function makeNonce(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampUnit(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export default function SkyDartsModal({ isOpen, onClose, playerName = 'raffa', onScored }: DartsModalProps) {
  const [aim, setAim] = useState(INITIAL_AIM);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [throws, setThrows] = useState<DartThrowView[]>([]);
  const [boards, setBoards] = useState<GameBoards>(() => loadGameBoards(null).boards);
  const [pending, setPending] = useState<ScoreRecord[]>([]);
  const [storageFailed, setStorageFailed] = useState(false);
  const [invalidStored, setInvalidStored] = useState(false);
  const [lastSavedScore, setLastSavedScore] = useState<{ score: number; persisted: boolean } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const chargeStartRef = useRef<number | null>(null);
  const throwsRef = useRef<DartThrowView[]>([]);
  const aimRef = useRef(INITIAL_AIM);
  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const pendingRef = useRef<ScoreRecord[]>([]);

  const stopCharge = useCallback(() => {
    chargingRef.current = false;
    chargeStartRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setCharging(false);
  }, []);

  /** Cancel an in-progress charge without throwing (blur, hidden tab, pointer lost). */
  const cancelCharge = useCallback(() => {
    stopCharge();
    powerRef.current = 0;
    setPower(0);
  }, [stopCharge]);

  const refreshScores = useCallback(() => {
    const loaded = loadGameBoards(getStorage());
    setBoards(withSessionRecords(loaded.boards, pendingRef.current));
    setInvalidStored(loaded.invalid);
    setStorageFailed(loaded.readFailed || pendingRef.current.length > 0);
  }, []);

  const setAimSafely = useCallback((x: number, y: number) => {
    const next = { x: clampUnit(x), y: clampUnit(y) };
    aimRef.current = next;
    setAim(next);
  }, []);

  /** Open: reload boards. Close: cancel charges and reset the round (no score is written). */
  useEffect(() => {
    if (isOpen) {
      refreshScores();
      return;
    }
    stopCharge();
    aimRef.current = INITIAL_AIM;
    powerRef.current = 0;
    throwsRef.current = [];
    setAim(INITIAL_AIM);
    setPower(0);
    setThrows([]);
    setLastSavedScore(null);
    setResetConfirm(false);
  }, [isOpen, refreshScores, stopCharge]);

  // Charging is a visible, cancellable state: hidden tab cancels it.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') cancelCharge();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopCharge();
    };
  }, [isOpen, cancelCharge, stopCharge]);

  const roundFull = throws.length >= DART_THROWS_PER_ROUND;

  /** Land one dart with the current aim and power. The only place a throw happens. */
  const throwDart = useCallback(() => {
    if (throwsRef.current.length >= DART_THROWS_PER_ROUND) return;
    stopCharge();
    const resolved = resolveDartThrow(aimRef.current.x, aimRef.current.y, powerRef.current);
    const landed: DartThrowView = { points: resolved.points, label: resolved.label, x: resolved.x, y: resolved.y };
    const next = [...throwsRef.current, landed];
    throwsRef.current = next;
    setThrows(next);
    onScored?.(resolved.points, resolved.label);
    powerRef.current = 0;
    setPower(0);
  }, [onScored, stopCharge]);

  const beginCharge = useCallback(() => {
    if (chargingRef.current || throwsRef.current.length >= DART_THROWS_PER_ROUND) return;
    chargingRef.current = true;
    chargeStartRef.current = null;
    setCharging(true);
    const animate = (timestamp: number) => {
      if (!chargingRef.current) return;
      if (chargeStartRef.current === null) chargeStartRef.current = timestamp;
      const elapsed = timestamp - chargeStartRef.current;
      const nextPower = (elapsed % POWER_PERIOD_MS) / POWER_PERIOD_MS;
      powerRef.current = nextPower;
      setPower(nextPower);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  /** Keyboard/slider power: only when no charge is running. */
  const setPowerManually = useCallback((value: number) => {
    if (chargingRef.current) return;
    powerRef.current = clampUnit(value);
    setPower(clampUnit(value));
  }, []);

  const finishRound = useCallback(() => {
    if (!isDartRoundComplete(throwsRef.current.length)) return;
    const completedAt = Date.now();
    const record: ScoreRecord = {
      gameId: 'darts',
      recordId: nextRecordId('darts', completedAt, makeNonce()),
      playerId: playerName.trim() || 'raffa',
      score: scoreDartRound(throwsRef.current),
      completedAt,
      ruleset: RULESETS.darts,
    };
    const outcome = submitCompletedScore(getStorage(), record, true, pendingRef.current);
    pendingRef.current = outcome.unsaved;
    setPending(outcome.unsaved);
    setBoards(outcome.boards);
    setStorageFailed(!outcome.persisted);
    setInvalidStored(false);
    setLastSavedScore({ score: record.score, persisted: outcome.persisted });
    throwsRef.current = [];
    setThrows([]);
  }, [playerName]);

  const resetBoard = useCallback(() => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    const outcome = resetGameBoard(getStorage(), 'darts', pendingRef.current);
    pendingRef.current = outcome.unsaved;
    setPending(outcome.unsaved);
    setBoards(outcome.boards);
    setStorageFailed(!outcome.persisted);
    setResetConfirm(false);
  }, [resetConfirm]);

  const onBoardPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (roundFull) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) setAimSafely((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture can fail on detached nodes; the release handler still runs */
    }
    beginCharge();
  }, [beginCharge, roundFull, setAimSafely]);

  const onBoardPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    // Aim follows the pointer even outside the board while captured; coordinates stay clamped.
    setAimSafely((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }, [setAimSafely]);

  const onBoardPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!chargingRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0) setAimSafely((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    throwDart();
  }, [setAimSafely, throwDart]);

  const onBoardKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (!event.repeat) beginCharge();
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-AIM_STEP, 0],
      ArrowRight: [AIM_STEP, 0],
      ArrowUp: [0, -AIM_STEP],
      ArrowDown: [0, AIM_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setAimSafely(aimRef.current.x + move[0], aimRef.current.y + move[1]);
    }
  }, [beginCharge, setAimSafely]);

  const onBoardKeyUp = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (chargingRef.current) throwDart();
    }
  }, [throwDart]);

  const roundScore = useMemo(() => scoreDartRound(throws), [throws]);
  const boardHits = throws.filter((t) => t.points > 0).length;
  const misses = throws.length - boardHits;
  const sweet = power >= DART_SWEET_MIN && power <= DART_SWEET_MAX;
  const board = boards.darts;

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/70 p-3" role="dialog" aria-label="Penthouse Sky Darts">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-violet-400/20 bg-slate-950/95 p-4 shadow-2xl sm:p-5">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Target size={16} className="text-violet-400" /> Penthouse Sky Darts
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200" aria-label="Close darts">
            <X size={16} />
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]">
          <section aria-label="Darts game">
            <p className="mb-3 text-xs text-slate-400">
              Bidik dengan kursor atau panah. Tahan papan (atau Space/Enter) untuk mengisi tenaga, lepas untuk melempar. Tenaga menggeser titik jatuh. Tepat 3 lemparan per ronde.
            </p>

            <div className="mx-auto w-full max-w-[360px]">
              <div
                ref={boardRef}
                className="relative aspect-square w-full touch-none cursor-crosshair select-none overflow-hidden rounded-full border border-white/15 bg-[radial-gradient(circle_at_center,#20203a_0%,#111122_70%,#070711_100%)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                onPointerDown={onBoardPointerDown}
                onPointerMove={onBoardPointerMove}
                onPointerUp={onBoardPointerUp}
                onPointerCancel={cancelCharge}
                onLostPointerCapture={cancelCharge}
                onKeyDown={onBoardKeyDown}
                onKeyUp={onBoardKeyUp}
                onBlur={cancelCharge}
                tabIndex={0}
                role="application"
                aria-label="Dartboard. Arrow keys aim; hold Space or Enter, then release to throw."
                aria-disabled={roundFull}
              >
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <circle cx="50" cy="50" r="49" fill="#111827" stroke="#94a3b8" strokeWidth="0.7" />
                  <circle cx="50" cy="50" r="43" fill="#7f1d1d" stroke="#cbd5e1" strokeWidth="0.6" />
                  <circle cx="50" cy="50" r="39" fill="#14532d" stroke="#cbd5e1" strokeWidth="0.5" />
                  <circle cx="50" cy="50" r="22" fill="#111827" stroke="#cbd5e1" strokeWidth="0.5" />
                  <circle cx="50" cy="50" r="19" fill="#991b1b" stroke="#cbd5e1" strokeWidth="0.5" />
                  <circle cx="50" cy="50" r="6" fill="#166534" stroke="#e2e8f0" strokeWidth="0.6" />
                  <circle cx="50" cy="50" r="3" fill="#ef4444" stroke="#fecaca" strokeWidth="0.5" />
                  {Array.from({ length: 20 }, (_, index) => {
                    const angle = (index / 20) * Math.PI * 2 - Math.PI / 2;
                    return (
                      <text key={index} x={50 + Math.cos(angle) * 46} y={50 + Math.sin(angle) * 46} textAnchor="middle" dominantBaseline="middle" fontSize="3" fill="white">
                        {index + 1}
                      </text>
                    );
                  })}
                  {throws.map((dart, index) => (
                    <g key={index} transform={`translate(${dart.x * 100} ${dart.y * 100})`}>
                      <circle r="2.4" fill={dart.points > 0 ? '#34d399' : '#f87171'} stroke="#020617" strokeWidth="0.7" />
                      <text y="-3.5" textAnchor="middle" fontSize="3" fill="white">{index + 1}</text>
                    </g>
                  ))}
                  <g transform={`translate(${aim.x * 100} ${aim.y * 100})`}>
                    <circle r="2.8" fill="none" stroke="#fef08a" strokeWidth="0.7" />
                    <path d="M -4 0 H 4 M 0 -4 V 4" stroke="#fef08a" strokeWidth="0.5" />
                  </g>
                </svg>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Tenaga{charging ? ' · mengisi' : ''}</span>
                <span className={sweet ? 'text-emerald-300' : 'text-violet-300'}>
                  {Math.round(power * 100)}%{sweet ? ' · sweet spot' : ''}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full border border-white/10 bg-slate-900">
                <div className="absolute inset-y-0 bg-emerald-500/20" style={{ left: `${DART_SWEET_MIN * 100}%`, width: `${(DART_SWEET_MAX - DART_SWEET_MIN) * 100}%` }} />
                <div className="h-full bg-violet-500" style={{ width: `${power * 100}%` }} />
              </div>
              <label className="flex items-center gap-2 text-[10px] text-slate-400">
                Tenaga (keyboard)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(power * 100)}
                  disabled={charging || roundFull}
                  onChange={(event) => setPowerManually(Number(event.currentTarget.value) / 100)}
                  className="min-w-0 flex-1 accent-violet-400"
                  aria-label="Tenaga lemparan"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                {throws.map((t, index) => (
                  <div key={index} className="rounded-lg border border-white/5 bg-white/5 p-2 text-[10px]">
                    {index + 1}: <strong className={t.points > 0 ? 'text-emerald-300' : 'text-rose-300'}>{t.points}</strong> {t.label}
                  </div>
                ))}
                {Array.from({ length: DART_THROWS_PER_ROUND - throws.length }, (_, index) => (
                  <div key={`pending-${index}`} className="rounded-lg border border-dashed border-white/10 p-2 text-[10px] text-slate-600">
                    Lemparan {throws.length + index + 1} belum
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-300">
                Skor ronde: <strong className="text-emerald-400">{roundScore}</strong> ({boardHits} hit · {misses} miss · {DART_THROWS_PER_ROUND - throws.length} tersisa)
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={throwDart}
                  disabled={roundFull || charging}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Lempar dengan tenaga ini
                </button>
                <button
                  type="button"
                  onClick={finishRound}
                  disabled={!isDartRoundComplete(throws.length)}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play size={13} /> Selesaikan ronde
                </button>
              </div>

              {lastSavedScore && (
                <p className={`text-xs ${lastSavedScore.persisted ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
                  Ronde terakhir: {lastSavedScore.score} poin {lastSavedScore.persisted ? 'tersimpan.' : 'hanya untuk sesi ini (penyimpanan gagal).'}
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-3" aria-label="Darts leaderboard">
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-200"><Trophy size={13} className="text-amber-300" /> Top 10 · Sky Darts</h3>
            </header>
            <button type="button" onClick={resetBoard} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-400/10">
              <RotateCcw size={10} /> Reset papan Sky Darts saja
            </button>
            {resetConfirm && (
              <div className="mb-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2 text-[10px]" role="alertdialog" aria-label="Konfirmasi reset papan darts">
                <p className="mb-2 text-rose-200">Hapus hanya papan Sky Darts? Papan arcade tidak berubah.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={resetBoard} className="rounded bg-rose-500 px-2 py-1 font-bold text-white">Hapus</button>
                  <button type="button" onClick={() => setResetConfirm(false)} className="rounded bg-white/10 px-2 py-1 text-slate-200">Batal</button>
                </div>
              </div>
            )}
            {storageFailed && <p className="mb-2 rounded bg-amber-400/10 p-2 text-[10px] text-amber-200" role="status">Penyimpanan tidak tersedia atau gagal: skor tertahan untuk sesi ini.</p>}
            {invalidStored && <p className="mb-2 text-[10px] text-amber-300" role="status">Data skor tersimpan tidak valid dan diabaikan.</p>}
            {board.length === 0 ? (
              <p className="py-3 text-[10px] text-slate-500">Belum ada ronde selesai.</p>
            ) : (
              <ol className="grid gap-1.5">
                {board.map((record, index) => (
                  <li key={record.recordId} className="grid grid-cols-[20px_1fr_auto] items-center gap-1 rounded bg-white/[0.03] px-2 py-1.5 text-[10px]">
                    <span className="text-slate-500">{index + 1}.</span>
                    <span className="truncate text-slate-300" title={record.playerId}>{record.playerId}</span>
                    <strong className="font-mono text-emerald-300">{record.score}</strong>
                  </li>
                ))}
              </ol>
            )}
            {pending.length > 0 && <p className="mt-2 text-[9px] text-amber-300">{pending.length} skor belum tersimpan (sesi ini).</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
