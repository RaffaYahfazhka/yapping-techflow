/**
 * Minigames engine — pure deterministic scoring and leaderboard handling.
 * Games: darts, crypto-runner, whack-a-bug. Score persist is isolated per game.
 */

export type GameId = 'darts' | 'crypto-runner' | 'whack-a-bug';

export interface ScoreRecord {
  gameId: GameId;
  recordId: string;
  /** Stable id of the player (employee id, or 'raffa' for the boss). */
  playerId: string;
  score: number;
  completedAt: number;
  ruleset: string;
}

export interface Leaderboard {
  gameId: GameId;
  entries: ScoreRecord[];
}

export const LEADERBOARD_CAP = 10;
export const SCORE_STORAGE_KEY = 'kantor-raffa.minigame-scores';

/** Deterministic ranking: score desc, completion time asc, recordId asc. */
export function rankEntries(entries: ScoreRecord[]): ScoreRecord[] {
  return [...entries].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
    return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0;
  });
}

export type ScoreResult = { ok: true; entries: ScoreRecord[] } | { ok: false; reason: string };

export function submitScore(entries: ScoreRecord[], incoming: ScoreRecord): ScoreResult {
  if (!Number.isSafeInteger(incoming.score) || incoming.score < 0) {
    return { ok: false, reason: 'Score must be a non-negative integer' };
  }
  if (entries.some((e) => e.recordId === incoming.recordId)) {
    // idempotent duplicate completion
    return { ok: true, entries: rankEntries(entries) };
  }
  const next = rankEntries([...entries, incoming]).slice(0, LEADERBOARD_CAP);
  return { ok: true, entries: next };
}

// ─── Darts scoring (deterministic) ──────────────────────────────────────────

export interface DartThrow {
  /** Distance from centre, 0..1 (1 = outer edge). */
  radial: number;
  /** Angle in radians. */
  angle: number;
  /** Power bar position 0..1 at release; sweet-spot is 0.68..0.82. */
  power: number;
}

/** Sector boundaries (20 sectors, 50-point bullseye at r<=0.06). */
export function scoreDartThrow(d: DartThrow): { points: number; label: string } {
  if (d.radial <= 0.06) return { points: 50, label: 'Bullseye' };
  if (d.power < 0.68 || d.power > 0.82) {
    // off-sweet-spot: radial error grows, can miss entirely
    if (d.radial > 1) return { points: 0, label: 'Miss' };
  }
  if (d.radial > 0.95) return { points: 0, label: 'Miss' };
  const sector = Math.floor(((d.angle + Math.PI) / (2 * Math.PI)) * 20) % 20;
  if (d.radial <= 0.22) return { points: 60, label: 'Triple 20' };
  if (d.radial <= 0.5) return { points: 30, label: `Sector ${sector}` };
  if (d.radial <= 0.95) return { points: 20, label: `Ring ${sector}` };
  return { points: 0, label: 'Miss' };
}

// ─── Crypto Candle Runner / Whack-A-Bug scores ──────────────────────────────

export interface RunnerEvent {
  /** Coins collected. */
  coins: number;
  /** Wicks hit (each costs 5 coins). */
  wickHits: number;
  /** Whether the run was completed without pause/abandonment. */
  completed: boolean;
  /** Elapsed ms. */
  durationMs: number;
}

export function scoreRunner(e: RunnerEvent): number {
  if (!e.completed) return 0;
  return Math.max(0, e.coins - 5 * e.wickHits) * 10;
}

export interface WhackEvent {
  bugsWhacked: number;
  /** Wrong target hits (Khansaku or prod tickets) — each costs 3. */
  friendlyFire: number;
  completed: boolean;
}

export function scoreWhack(e: WhackEvent): number {
  if (!e.completed) return 0;
  return Math.max(0, e.bugsWhacked * 25 - e.friendlyFire * 75);
}