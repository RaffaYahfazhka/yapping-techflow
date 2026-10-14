'use client';

/**
 * RetroArcadeModal - kabinet arcade retro di teras.
 * Mode A: Crypto Candle Runner (canvas 2D, arrow-key dodge)
 * Mode B: Boss Whack-A-Bug (click bugs, avoid Khansaku/prod)
 * Deterministic scoring via minigames engine; leaderboard persisted per round.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Trophy, X, RotateCcw } from 'lucide-react';
import { scoreRunner, scoreWhack, submitScore, type ScoreRecord, type ScoreRecord as Rec } from '@/lib/engine/minigames';

const SCORE_KEY = 'kantor-raffa.minigame-scores';

export interface RetroArcadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode?: (m: 'candle-runner' | 'whack-a-bug') => void;
  playerName?: string;
}

type Mode = 'candle-runner' | 'whack-a-bug';

interface GameState {
  coins: number;
  wick: number;
  bug: number;
  friendly: number;
  running: boolean;
  t0: number;
  finished: boolean;
  failed: boolean;
}

interface Bug {
  id: number;
  x: number;
  y: number;
  spawnAt: number;
  isFriendly: boolean;
}

const W = 440;
const H = 260;

export default function RetroArcadeModal({ isOpen, onClose, onSelectMode, playerName = 'raffa' }: RetroArcadeModalProps) {
  const [menu, setMenu] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [gs, setGs] = useState<GameState>({ coins: 0, wick: 0, bug: 0, friendly: 0, running: false, t0: 0, finished: false, failed: false });
  const [playerY, setPlayerY] = useState(H - 40);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [candles, setCandles] = useState<{ x: number; h: number; down: boolean }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);

  const resetRun = useCallback(() => {
    setGs({ coins: 0, wick: 0, bug: 0, friendly: 0, running: true, t0: Date.now(), finished: false, failed: false });
    setPlayerY(H - 40);
    setBugs([]);
    setCandles([]);
  }, []);

  const pick = useCallback((m: Mode) => {
    setMode(m);
    setMenu(false);
    resetRun();
    onSelectMode?.(m);
  }, [resetRun, onSelectMode]);

  // main game tick
  useEffect(() => {
    if (!isOpen || !gs.running || gs.finished) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const elapsed = (now - gs.t0) / 1000;

      if (mode === 'candle-runner') {
        // spawn a candle every ~0.5s, random red/green
        if (Math.random() < 0.06) {
          const down = Math.random() < 0.35;
          const h = 20 + Math.random() * 70;
          setCandles((prev) => [...prev.slice(-8), { x: W, h, down }]);
        }
        setCandles((prev) => prev.map((c) => ({ ...c, x: c.x - 2.2 })).filter((c) => c.x > -30));
        setGs((prev) => ({ ...prev, coins: prev.coins + 1 }));
        // auto-finish after a fixed 60s round
        if (elapsed >= 60) {
          const score = scoreRunner({ coins: gs.coins, wickHits: gs.wick, completed: true, durationMs: elapsed * 1000 });
          submitLeaderboard({ gameId: 'crypto-runner', recordId: `cr-${Date.now()}`, playerId: playerName, score, completedAt: Date.now(), ruleset: 'runner-v1' });
          setGs((prev) => ({ ...prev, running: false, finished: true }));
        }
      } else if (mode === 'whack-a-bug') {
        if (Math.random() < 0.05) {
          const isFriendly = Math.random() < 0.18;
          setBugs((prev) => [...prev.slice(-7), { id: now, x: 20 + Math.random() * (W - 40), y: 20 + Math.random() * (H - 60), spawnAt: now, isFriendly }]);
        }
        setBugs((prev) => prev.filter((b) => now - b.spawnAt < 2500));
        if (elapsed >= 30) {
          const score = scoreWhack({ bugsWhacked: gs.bug, friendlyFire: gs.friendly, completed: true });
          submitLeaderboard({ gameId: 'whack-a-bug', recordId: `wb-${Date.now()}`, playerId: playerName, score, completedAt: Date.now(), ruleset: 'whack-v1' });
          setGs((prev) => ({ ...prev, running: false, finished: true }));
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [gs.running, gs.finished, gs.t0, gs.coins, gs.bug, gs.wick, mode, isOpen, playerName]);

  const submitLeaderboard = useCallback((rec: ScoreRecord) => {
    try {
      const raw = window.localStorage.getItem(SCORE_KEY);
      const list: Rec[] = raw ? (JSON.parse(raw) as Rec[]) : [];
      const filtered = list.filter((e) => e.gameId === rec.gameId);
      const r = submitScore(filtered, rec);
      if (r.ok) {
        // merge back with other games
        const others = list.filter((e) => e.gameId !== rec.gameId);
        window.localStorage.setItem(SCORE_KEY, JSON.stringify([...others, ...r.entries]));
      }
    } catch {
      /* session-only */
    }
  }, []);

  // keyboard controls for runner
  useEffect(() => {
    if (!isOpen || mode !== 'candle-runner') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp') setPlayerY((y) => Math.max(0, y - 14));
      if (e.code === 'ArrowDown') setPlayerY((y) => Math.min(H - 40, y + 14));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen) return;
    setMenu(true);
    setMode(null);
    setGs({ coins: 0, wick: 0, bug: 0, friendly: 0, running: false, t0: 0, finished: false, failed: false });
  }, [isOpen]);

  if (!isOpen) return null;

  const finalScore = mode === 'candle-runner'
    ? scoreRunner({ coins: gs.coins, wickHits: gs.wick, completed: gs.finished, durationMs: 60_000 })
    : scoreWhack({ bugsWhacked: gs.bug, friendlyFire: gs.friendly, completed: gs.finished });

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-label="Retro Arcade">
      <div className="w-full max-w-lg rounded-2xl border border-violet-500/25 bg-slate-950/95 p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Gamepad2 size={16} className="text-violet-400" /> Retro Arcade · TechFlow Terminal
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300" aria-label="Tutup arcade">
            <X size={14} />
          </button>
        </header>

        {menu && (
          <div className="grid gap-3">
            <button type="button" onClick={() => pick('candle-runner')} className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left hover:bg-emerald-500/20">
              <span className="text-2xl">📈</span>
              <div>
                <strong className="text-xs text-emerald-300">Crypto Candle Runner</strong>
                <p className="text-[10px] text-slate-400">Lompati jarum wick dan hindari candle merah; kumpulkan koin cuan selama 60 detik. ArrowUp/Down.</p>
              </div>
            </button>
            <button type="button" onClick={() => pick('whack-a-bug')} className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-left hover:bg-rose-500/20">
              <span className="text-2xl">🐛</span>
              <div>
                <strong className="text-xs text-rose-300">Boss Whack-A-Bug</strong>
                <p className="text-[10px] text-slate-400">Pukul bug Jira selama 30 detik; hindari Khansaku atau tiket prod (friendly fire -75 pts).</p>
              </div>
            </button>
          </div>
        )}

        {!menu && mode !== null && (
          <>
            <canvas ref={canvasRef} width={W} height={H} className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900" aria-label={`Arcade game ${mode}`} />
            <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-slate-300">
              <span className="font-mono">🕐 {mode === 'candle-runner' ? '60' : '30'}s</span>
              {mode === 'candle-runner' ? (<>
                <span>🪙 {gs.coins}</span>
                <span>⚡ Wick hits {gs.wick}</span>
              </>) : (<>
                <span>🐛 Whacked {gs.bug}</span>
                <span>🚫 Friendly {gs.friendly}</span>
              </>)}
              <span>Skor: <strong className="text-emerald-400">{finalScore}</strong></span>
            </div>

            {gs.finished ? (
              <div className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <p className="flex items-center gap-2 text-xs text-emerald-300">
                  <Trophy size={12} /> Ronde selesai! Skor <strong className="ml-1 font-mono">{finalScore}</strong> masuk leaderboard.
                </p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button type="button" onClick={resetRun} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400">
                <RotateCcw size={12} /> {gs.finished ? 'Main lagi' : 'Restart'}
              </button>
              <button type="button" onClick={() => { setMenu(true); setMode(null); setGs((p) => ({ ...p, running: false })); }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
                Menu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}