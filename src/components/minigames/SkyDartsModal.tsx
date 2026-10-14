'use client';

/**
 * SkyDartsModal - papan dart di teras penthouse.
 * Bidik mouse + power bar; 3 lemparan; skor ditambahkan ke leaderboard.
 * Pure Tailwind + Lucide; keyboard: Spacebar = hold/release.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Target, Play, X } from 'lucide-react';
import { scoreDartThrow, submitScore, type ScoreRecord, type GameId } from '@/lib/engine/minigames';

const SCORE_KEY = 'kantor-raffa.minigame-scores';

export interface DartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName?: string;
  onScored?: (score: number, label: string) => void;
}

interface ThrowResult {
  points: number;
  label: string;
  x: number;
  y: number;
}

const BOARD_SIZE = 260;
const SWEET_SPOT_MIN = 0.68;
const SWEET_SPOT_MAX = 0.82;

export default function SkyDartsModal({ isOpen, onClose, playerName = 'raffa', onScored }: DartsModalProps) {
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 });
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [throws, setThrows] = useState<ThrowResult[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const finishThrow = useCallback(() => {
    setCharging(false);
    const dart = {
      radial: (Math.hypot(aim.x - 0.5, aim.y - 0.5) * 2),
      angle: (Math.atan2(aim.y - 0.5, aim.x - 0.5)),
      power,
    };
    const scored = scoreDartThrow(dart);
    const px = aim.x * BOARD_SIZE;
    const py = aim.y * BOARD_SIZE;
    const next = { ...throws, points: scored.points, label: scored.label, x: px, y: py };
    void next;
    setThrows((prev) => [...prev, { points: scored.points, label: scored.label, x: px, y: py }]);
    setRoundScore((prev) => prev + scored.points);
    onScored?.(scored.points, scored.label);
    setPower(0);
  }, [aim, power, throws]);

  // charge loop
  useEffect(() => {
    if (!charging) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) / 1000;
      setPower(Math.min(1, elapsed / 1.5));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [charging]);

  useEffect(() => {
    if (!isOpen) {
      setAim({ x: 0.5, y: 0.5 });
      setPower(0);
      setThrows([]);
      setRoundScore(0);
    }
  }, [isOpen]);

  const moveAim = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAim({
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    });
  }, []);

  const boardHits = useMemo(() => throws.filter((t) => t.points > 0), [throws]);
  const misses = throws.length - boardHits.length;

  const saveScores = useCallback(
    (list: ScoreRecord[]) => {
      try {
        window.localStorage.setItem(SCORE_KEY, JSON.stringify(list));
      } catch {
        /* session-only fallback */
      }
    },
    [],
  );

  const finishRound = useCallback(() => {
    if (throws.length === 0) return;
    const incoming: ScoreRecord = {
      gameId: 'darts' as GameId,
      recordId: `darts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: playerName,
      score: roundScore,
      completedAt: Date.now(),
      ruleset: 'darts-v1',
    };
    try {
      const raw = window.localStorage.getItem(SCORE_KEY);
      const list: ScoreRecord[] = raw ? (JSON.parse(raw) as ScoreRecord[]).filter((e) => e.gameId === 'darts') : [];
      const r = submitScore(list, incoming);
      if (r.ok) saveScores(r.entries);
    } catch {
      saveScores([incoming]);
    }
    onScored?.(roundScore, 'Round end');
    setThrows([]);
    setRoundScore(0);
  }, [throws.length, roundScore, playerName, saveScores, onScored]);

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-label="Penthouse Sky Darts">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Target size={16} className="text-violet-400" /> Penthouse Sky Darts
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300" aria-label="Tutup darts">
            <X size={14} />
          </button>
        </header>

        <p className="mb-4 text-xs text-slate-400">
          Bidik dengan kursor di papan, tahan klik untuk isi meteran tenaga (sweet spot 68-82%), lalu lepaskan. 3 lemparan per ronde.
        </p>

        <div
          ref={boardRef}
          className="mx-auto grid h-64 w-64 cursor-crosshair place-items-center rounded-full border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950"
          onMouseMove={moveAim}
          onMouseDown={() => setCharging(true)}
          onMouseUp={finishThrow}
          tabIndex={0}
          role="slider"
          aria-label="Papan dart"
          aria-valuenow={Math.round(power * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(e) => {
            if (e.code === 'Space' && !e.repeat) setCharging(true);
          }}
          onKeyUp={(e) => {
            if (e.code === 'Space' && charging) finishThrow();
          }}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            {[50, 44, 24, 22, 12].map((r, i) => (
              <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={`rgba(139,92,246,${0.25 + i * 0.08})`} strokeWidth={1} />
            ))}
            <circle cx="50" cy="50" r="5" fill="#ef4444" />
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xs" style={{ transform: `translate(${(aim.x - 0.5) * 100}%, ${(aim.y - 0.5) * 100}%)` }}>
            🎯
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-slate-950">
            <div
              className={`h-full transition-all ${power >= SWEET_SPOT_MIN && power <= SWEET_SPOT_MAX ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{ width: `${Math.min(100, power * 100)}%` }}
            />
          </div>
          <div className="grid grid-cols-3">
            {throws.map((t, i) => (
              <div key={i} className="rounded-lg border border-white/5 bg-white/5 p-2 text-[10px]">
                {i + 1}: <strong style={{ color: t.points > 0 ? '#6ee7b7' : '#fca5a5' }}>{t.points}</strong> {t.label}
              </div>
            ))}
            {throws.length === 0 && <div className="text-[10px] text-slate-500">Lempar pertama belum ada.</div>}
          </div>
          <p className="text-xs text-slate-300">
            Skor ronde: <strong className="text-emerald-400">{roundScore}</strong> ({boardHits.length} hit · {misses} miss)
          </p>
          <button
            type="button"
            onClick={finishRound}
            disabled={throws.length === 0}
            className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-40"
          >
            <Play size={13} className="mr-1.5 inline" /> Submit Round
          </button>
        </div>
      </div>
    </div>
  );
}