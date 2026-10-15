'use client';

/**
 * RetroArcadeModal: two playable games on one canvas cabinet.
 *   Crypto Candle Runner: dodge wicks, collect coins, 60 s of elapsed time.
 *   Boss Whack-A-Bug: hit bugs, avoid friendly Khansaku bugs, 30 s.
 * Mechanics live in `lib/engine/minigames`; this file owns the rAF loop,
 * input and drawing. Only completed rounds are persisted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Trophy, X, RotateCcw, Pause, Play } from 'lucide-react';
import {
  GAME_LABELS,
  RUNNER_HEIGHT,
  RUNNER_PLAYER_HALF_H,
  RUNNER_PLAYER_HALF_W,
  RUNNER_PLAYER_X,
  RUNNER_ROUND_MS,
  RUNNER_WIDTH,
  WHACK_BUG_RADIUS,
  WHACK_ROUND_MS,
  createRunnerState,
  createWhackState,
  runnerObjectX,
  runnerScore,
  runnerSpeed,
  scoreRunner,
  scoreWhack,
  stepRunner,
  stepWhack,
  whackAt,
  whackScore,
  type GameId,
  type RunnerInput,
  type RunnerState,
  type ScoreRecord,
  type WhackState,
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

export interface RetroArcadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode?: (m: 'candle-runner' | 'whack-a-bug') => void;
  playerName?: string;
}

type Mode = 'candle-runner' | 'whack-a-bug';
type Phase = 'menu' | 'running' | 'paused' | 'finished';

/** Static mode → leaderboard mapping. */
const MODE_BOARD: Record<Mode, GameId> = {
  'candle-runner': 'crypto-runner',
  'whack-a-bug': 'whack-a-bug',
};

const W = RUNNER_WIDTH;
const H = RUNNER_HEIGHT;
/** Frame dt clamp: a stalled tab must not teleport the game. */
const MAX_FRAME_DT_MS = 100;

interface LastSaved {
  score: number;
  persisted: boolean;
}

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

function seedFromClock(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
}

/** Canvas-space point of a pointer event (intrinsic canvas size, not CSS size). */
function toCanvasPoint(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function drawRunner(ctx: CanvasRenderingContext2D, state: RunnerState) {
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  for (let y = 0; y <= H; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (const obj of state.objects) {
    if (obj.consumed) continue;
    const x = runnerObjectX(obj, state.distance);
    if (obj.kind === 'coin') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, obj.y, obj.halfW, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#854d0e';
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x, obj.y);
    } else {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, obj.y - obj.halfH);
      ctx.lineTo(x, obj.y + obj.halfH);
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x - obj.halfW, obj.y - 6, obj.halfW * 2, 12);
    }
  }
  const invulnerable = state.elapsedMs < state.invulnUntilMs;
  ctx.fillStyle = invulnerable ? 'rgba(52,211,153,0.5)' : '#34d399';
  ctx.fillRect(RUNNER_PLAYER_X - RUNNER_PLAYER_HALF_W, state.playerY - RUNNER_PLAYER_HALF_H, RUNNER_PLAYER_HALF_W * 2, RUNNER_PLAYER_HALF_H * 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.max(0, Math.ceil((RUNNER_ROUND_MS - state.elapsedMs) / 1000))}s`, 8, 6);
  ctx.fillText(`speed ${Math.round(runnerSpeed(state.elapsedMs))}`, 8, 20);
}

function drawWhack(ctx: CanvasRenderingContext2D, state: WhackState) {
  ctx.fillStyle = '#140b14';
  ctx.fillRect(0, 0, W, H);
  for (const bug of state.bugs) {
    const life = 1 - (state.elapsedMs - bug.spawnedAtMs) / bug.ttlMs;
    ctx.globalAlpha = Math.max(0.25, Math.min(1, life * 1.5));
    ctx.fillStyle = bug.isFriendly ? '#38bdf8' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(bug.x, bug.y, WHACK_BUG_RADIUS - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bug.isFriendly ? 'KH' : 'BUG', bug.x, bug.y);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.max(0, Math.ceil((WHACK_ROUND_MS - state.elapsedMs) / 1000))}s`, 8, 6);
}

export default function RetroArcadeModal({ isOpen, onClose, onSelectMode, playerName = 'raffa' }: RetroArcadeModalProps) {
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<Mode | null>(null);
  const [runnerView, setRunnerView] = useState<RunnerState>(() => createRunnerState(1));
  const [whackView, setWhackView] = useState<WhackState>(() => createWhackState(1));
  const [boards, setBoards] = useState<GameBoards>(() => loadGameBoards(null).boards);
  const [boardView, setBoardView] = useState<GameId>('crypto-runner');
  const [pendingCount, setPendingCount] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  const [invalidStored, setInvalidStored] = useState(false);
  const [lastSaved, setLastSaved] = useState<LastSaved | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('menu');
  const modeRef = useRef<Mode | null>(null);
  const runnerRef = useRef<RunnerState>(createRunnerState(1));
  const whackRef = useRef<WhackState>(createWhackState(1));
  const keysRef = useRef({ up: false, down: false });
  const targetYRef = useRef<number | null>(null);
  const pendingRef = useRef<ScoreRecord[]>([]);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const drawCurrent = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (modeRef.current === 'candle-runner') drawRunner(ctx, runnerRef.current);
    else if (modeRef.current === 'whack-a-bug') drawWhack(ctx, whackRef.current);
  }, []);

  const refreshScores = useCallback(() => {
    const loaded = loadGameBoards(getStorage());
    setBoards(withSessionRecords(loaded.boards, pendingRef.current));
    setInvalidStored(loaded.invalid);
    setStorageFailed(loaded.readFailed || pendingRef.current.length > 0);
  }, []);

  const finishRound = useCallback((m: Mode) => {
    if (phaseRef.current !== 'running') return;
    const score = m === 'candle-runner' ? runnerScore(runnerRef.current) : whackScore(whackRef.current);
    const gameId = MODE_BOARD[m];
    const completedAt = Date.now();
    const record: ScoreRecord = {
      gameId,
      recordId: nextRecordId(gameId, completedAt, makeNonce()),
      playerId: playerName.trim() || 'raffa',
      score,
      completedAt,
      ruleset: RULESETS[gameId],
    };
    const outcome = submitCompletedScore(getStorage(), record, true, pendingRef.current);
    pendingRef.current = outcome.unsaved;
    setPendingCount(outcome.unsaved.length);
    setBoards(outcome.boards);
    setStorageFailed(!outcome.persisted);
    setLastSaved({ score, persisted: outcome.persisted });
    setPhaseBoth('finished');
  }, [playerName, setPhaseBoth]);

  // The only RAF loop. It exists only while phase === 'running' and is torn down on
  // pause, finish, menu or close. Elapsed time is measured per frame and clamped.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    let last: number | null = null;
    let frameId: number | null = null;
    const frame = (now: number) => {
      const dt = last === null ? 0 : Math.min(MAX_FRAME_DT_MS, Math.max(0, now - last));
      last = now;
      const current = modeRef.current;
      if (current === 'candle-runner') {
        const input: RunnerInput = targetYRef.current !== null
          ? { targetY: targetYRef.current }
          : { moveY: (keysRef.current.down ? 1 : 0) - (keysRef.current.up ? 1 : 0) };
        const step = stepRunner(runnerRef.current, dt, input);
        runnerRef.current = step.state;
        setRunnerView(step.state);
        drawCurrent();
        if (step.state.runOver) {
          finishRound('candle-runner');
          return;
        }
      } else if (current === 'whack-a-bug') {
        const step = stepWhack(whackRef.current, dt);
        whackRef.current = step.state;
        setWhackView(step.state);
        drawCurrent();
        if (step.state.runOver) {
          finishRound('whack-a-bug');
          return;
        }
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [phase, drawCurrent, finishRound]);

  // Redraw the frozen frame when the loop is not running (pause / finished).
  useEffect(() => {
    if (phase === 'paused' || phase === 'finished') drawCurrent();
  }, [phase, drawCurrent]);

  const beginRound = useCallback((m: Mode) => {
    modeRef.current = m;
    setMode(m);
    const seed = seedFromClock();
    if (m === 'candle-runner') {
      runnerRef.current = createRunnerState(seed);
      setRunnerView(runnerRef.current);
    } else {
      whackRef.current = createWhackState(seed);
      setWhackView(whackRef.current);
    }
    keysRef.current = { up: false, down: false };
    targetYRef.current = null;
    setLastSaved(null);
    setPhaseBoth('running');
    onSelectMode?.(m);
  }, [onSelectMode, setPhaseBoth]);

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    keysRef.current = { up: false, down: false };
    targetYRef.current = null;
    setPhaseBoth('paused');
  }, [setPhaseBoth]);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setPhaseBoth('running');
  }, [setPhaseBoth]);

  /** Leave a round without scoring it. Unfinished rounds are never persisted. */
  const leaveToMenu = useCallback(() => {
    keysRef.current = { up: false, down: false };
    targetYRef.current = null;
    modeRef.current = null;
    setMode(null);
    setLastSaved(null);
    setPhaseBoth('menu');
  }, [setPhaseBoth]);

  // Visibility loss pauses the round.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  // Keyboard: arrows/W/S steer the runner; P toggles pause.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'KeyP' && !e.repeat) {
        if (phaseRef.current === 'running') pause();
        else resume();
        return;
      }
      if (phaseRef.current !== 'running' || modeRef.current !== 'candle-runner') return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        keysRef.current.up = true;
        targetYRef.current = null;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        keysRef.current.down = true;
        targetYRef.current = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isOpen, pause, resume]);

  // Open: reload boards. Close: end any round without scoring it.
  useEffect(() => {
    if (isOpen) {
      refreshScores();
      return;
    }
    leaveToMenu();
    setResetConfirm(false);
  }, [isOpen, refreshScores, leaveToMenu]);

  const onCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'running') return;
    const point = toCanvasPoint(event.currentTarget, event);
    if (!point) return;
    if (modeRef.current === 'candle-runner') {
      event.currentTarget.setPointerCapture(event.pointerId);
      targetYRef.current = point.y;
      return;
    }
    if (modeRef.current === 'whack-a-bug') {
      const result = whackAt(whackRef.current, point.x, point.y);
      whackRef.current = result.state;
      setWhackView(result.state);
      drawCurrent();
    }
  }, [drawCurrent]);

  const onCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'running' || modeRef.current !== 'candle-runner') return;
    if (event.buttons === 0) return;
    const point = toCanvasPoint(event.currentTarget, event);
    if (point) targetYRef.current = point.y;
  }, []);

  const onCanvasPointerEnd = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    targetYRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const resetBoard = useCallback(() => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    const outcome = resetGameBoard(getStorage(), boardView, pendingRef.current);
    pendingRef.current = outcome.unsaved;
    setPendingCount(outcome.unsaved.length);
    setBoards(outcome.boards);
    setStorageFailed(!outcome.persisted);
    setResetConfirm(false);
  }, [boardView, resetConfirm]);

  if (!isOpen) return null;

  const liveScore = mode === 'candle-runner'
    ? scoreRunner({ coins: runnerView.coins, wickHits: runnerView.wickHits, completed: true, durationMs: runnerView.elapsedMs })
    : mode === 'whack-a-bug'
      ? scoreWhack({ bugsWhacked: whackView.hits, friendlyFire: whackView.friendlyFire, completed: true })
      : 0;
  const board = boards[boardView];
  const inRound = phase !== 'menu' && mode !== null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 md:p-6 backdrop-blur-md" role="dialog" aria-label="Retro Arcade">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-violet-500/30 bg-[#0c0d12]/95 p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <header className="mb-6 pb-3 flex items-center justify-between border-b border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-20 pointer-events-none overflow-hidden">
            <img
              src="/textures/props/retro_arcade_cabinet.jpg"
              alt="Retro Arcade Cabinet"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d12] to-transparent" />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15 overflow-hidden relative">
              <img
                src="/textures/props/retro_arcade_cabinet.jpg"
                alt="Retro Arcade Cabinet"
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              />
              <Gamepad2 size={20} className="text-violet-400 relative z-10 drop-shadow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Retro Arcade · TechFlow Cabinet
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  ROOFTOP DECK
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Rooftop Sky Terrace Arcade Machine · Pilih Mini-Game</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors relative z-10" aria-label="Close arcade">
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <section aria-label="Arcade game">
            {phase === 'menu' && (
              <div className="grid gap-4">
                <button type="button" onClick={() => beginRound('candle-runner')} className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all hover:-translate-y-0.5">
                  <span className="text-3xl shrink-0">📈</span>
                  <div>
                    <strong className="text-sm font-bold text-emerald-300 block">{GAME_LABELS['crypto-runner']}</strong>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">Kumpulkan koin $ dan hindari wick merah selama 60 detik. Arrow Up/Down, W/S, atau tahan dan geser kursor.</p>
                  </div>
                </button>
                <button type="button" onClick={() => beginRound('whack-a-bug')} className="flex items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-left hover:bg-rose-500/20 hover:border-rose-500/50 transition-all hover:-translate-y-0.5">
                  <span className="text-3xl shrink-0">🐛</span>
                  <div>
                    <strong className="text-sm font-bold text-rose-300 block">{GAME_LABELS['whack-a-bug']}</strong>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">Pukul bug merah selama 30 detik; hindari Khansaku biru (friendly fire −75). Klik atau tap layar.</p>
                  </div>
                </button>
              </div>
            )}

            {inRound && (
              <>
                <div className="relative mb-3">
                  <canvas
                    ref={canvasRef}
                    width={W}
                    height={H}
                    className="w-full touch-none rounded-xl border border-white/10 bg-slate-900"
                    style={{ cursor: mode === 'whack-a-bug' ? 'crosshair' : 'ns-resize' }}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerEnd}
                    onPointerCancel={onCanvasPointerEnd}
                    role="img"
                    aria-label={`${GAME_LABELS[MODE_BOARD[mode]]} playfield`}
                  />
                  {phase === 'paused' && (
                    <div className="absolute inset-0 grid place-items-center rounded-xl bg-slate-950/70 text-xs text-slate-200" role="status">
                      Paused. Tekan P atau klik Lanjut.
                    </div>
                  )}
                </div>

                <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-slate-300">
                  {mode === 'candle-runner' ? (
                    <>
                      <span>🪙 {runnerView.coins}</span>
                      <span>⚡ Wick hits {runnerView.wickHits}</span>
                      <span>Coin lewat {runnerView.misses}</span>
                    </>
                  ) : (
                    <>
                      <span>🐛 Hit {whackView.hits}</span>
                      <span>🚫 Friendly {whackView.friendlyFire}</span>
                      <span>Meleset {whackView.misses}</span>
                    </>
                  )}
                  <span>Skor sementara: <strong className="text-emerald-400">{liveScore}</strong></span>
                </div>

                {phase === 'finished' && lastSaved && (
                  <div className={`mb-3 rounded-xl border p-3 ${lastSaved.persisted ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`} role="status">
                    <p className="flex items-center gap-2 text-xs text-slate-200">
                      <Trophy size={12} /> Ronde selesai! Skor <strong className="ml-1 font-mono">{lastSaved.score}</strong>{' '}
                      {lastSaved.persisted ? 'masuk leaderboard.' : 'hanya untuk sesi ini (penyimpanan gagal).'}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {phase === 'running' && (
                    <button type="button" onClick={pause} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {phase === 'paused' && (
                    <button type="button" onClick={resume} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400">
                      <Play size={12} /> Lanjut
                    </button>
                  )}
                  {phase === 'finished' && mode !== null && (
                    <button type="button" onClick={() => beginRound(mode)} className="flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400">
                      <RotateCcw size={12} /> Main lagi
                    </button>
                  )}
                  <button type="button" onClick={leaveToMenu} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
                    Menu
                  </button>
                  {phase !== 'finished' && (
                    <span className="text-[10px] text-slate-500">Keluar sebelum selesai tidak menyimpan skor.</span>
                  )}
                </div>
              </>
            )}
          </section>

          <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-3" aria-label="Arcade leaderboard">
            <header className="mb-2">
              <h3 className="text-xs font-bold text-slate-200">Top 10 · {GAME_LABELS[boardView]}</h3>
            </header>
            <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label="Pilih papan skor">
              {(['crypto-runner', 'whack-a-bug'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setBoardView(g);
                    setResetConfirm(false);
                  }}
                  aria-pressed={boardView === g}
                  className={`rounded-lg border px-2 py-1 text-[10px] ${boardView === g ? 'border-violet-400 text-violet-200' : 'border-white/10 text-slate-400'}`}
                >
                  {g === 'crypto-runner' ? 'Runner' : 'Whack'}
                </button>
              ))}
            </div>
            <button type="button" onClick={resetBoard} className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/30 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-400/10">
              <RotateCcw size={10} /> Reset papan {boardView === 'crypto-runner' ? 'Runner' : 'Whack'} saja
            </button>
            {resetConfirm && (
              <div className="mb-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2 text-[10px]" role="alertdialog" aria-label="Konfirmasi reset papan arcade">
                <p className="mb-2 text-rose-200">Hapus hanya papan {GAME_LABELS[boardView]}? Papan game lain tidak berubah.</p>
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
            {pendingCount > 0 && <p className="mt-2 text-[9px] text-amber-300">{pendingCount} skor belum tersimpan (sesi ini).</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
