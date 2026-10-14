/**
 * Minigames engine — pure, deterministic mechanics + scoring + leaderboard
 * bookkeeping for the three penthouse games:
 *
 *   - darts         Penthouse Sky Darts — exactly 3 throws, power shifts the
 *                   landing point so the meter genuinely changes where the
 *                   dart sticks.
 *   - crypto-runner Crypto Candle Runner — elapsed-time scrolling physics,
 *                   real coin/needle collision, collect or dodge.
 *   - whack-a-bug   Boss Whack-A-Bug — pointer/keyboard hit tests on bugs,
 *                   friendly fire penalised.
 *
 * Everything here is pure and frame-rate independent: the modals drive it from
 * rAF with a measured `dt`, and `scripts/verify-minigames.mjs` asserts exact
 * outcomes with no DOM. Persistence lives in `src/lib/storage/gameScores.ts`.
 */

export type GameId = 'darts' | 'crypto-runner' | 'whack-a-bug';

export const GAME_IDS: readonly GameId[] = ['darts', 'crypto-runner', 'whack-a-bug'];

/** Human labels for boards/UI (kept here so storage + UI never diverge). */
export const GAME_LABELS: Record<GameId, string> = {
  darts: 'Penthouse Sky Darts',
  'crypto-runner': 'Crypto Candle Runner',
  'whack-a-bug': 'Boss Whack-A-Bug',
};

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

// ─── Record validation (used before anything is trusted or persisted) ───────

function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && (GAME_IDS as readonly string[]).includes(value);
}

/** A stored record is only accepted when every field is the exact right shape. */
export function isValidScoreRecord(value: unknown): value is ScoreRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Partial<ScoreRecord>;
  return (
    isGameId(r.gameId) &&
    typeof r.playerId === 'string' &&
    r.playerId.length > 0 &&
    typeof r.recordId === 'string' &&
    r.recordId.length > 0 &&
    typeof r.ruleset === 'string' &&
    r.ruleset.length > 0 &&
    Number.isSafeInteger(r.score) &&
    (r.score as number) >= 0 &&
    Number.isFinite(r.completedAt) &&
    (r.completedAt as number) >= 0
  );
}

/**
 * Drop everything malformed, de-duplicate by `recordId` (first wins), then
 * rank. Never throws — unknown shapes degrade to an empty list.
 */
export function sanitizeScoreRecords(value: unknown): { records: ScoreRecord[]; dropped: number } {
  if (!Array.isArray(value)) return { records: [], dropped: 0 };
  const seen = new Set<string>();
  const records: ScoreRecord[] = [];
  let dropped = 0;
  for (const candidate of value) {
    if (!isValidScoreRecord(candidate) || seen.has(candidate.recordId)) {
      dropped += 1;
      continue;
    }
    seen.add(candidate.recordId);
    records.push(candidate);
  }
  return { records: rankEntries(records), dropped };
}

/** Split ranked records into independent per-game top-N boards. */
export function groupBoards(records: ScoreRecord[]): Record<GameId, ScoreRecord[]> {
  const boards = {} as Record<GameId, ScoreRecord[]>;
  for (const gameId of GAME_IDS) {
    boards[gameId] = rankEntries(records.filter((r) => r.gameId === gameId)).slice(0, LEADERBOARD_CAP);
  }
  return boards;
}

export type ScoreResult = { ok: true; entries: ScoreRecord[] } | { ok: false; reason: string };

export function submitScore(entries: ScoreRecord[], incoming: ScoreRecord): ScoreResult {
  if (!Number.isSafeInteger(incoming.score) || incoming.score < 0) {
    return { ok: false, reason: 'Score must be a non-negative integer' };
  }
  if (!isGameId(incoming.gameId)) {
    return { ok: false, reason: `Unknown game id: ${String(incoming.gameId)}` };
  }
  if (entries.some((e) => e.recordId === incoming.recordId)) {
    // idempotent duplicate completion
    return { ok: true, entries: rankEntries(entries) };
  }
  const sameGame = rankEntries([...entries.filter((e) => e.gameId === incoming.gameId), incoming]);
  const others = entries.filter((e) => e.gameId !== incoming.gameId);
  return { ok: true, entries: [...others, ...sameGame.slice(0, LEADERBOARD_CAP)] };
}

// ─── Penthouse Sky Darts ─────────────────────────────────────────────────────

/** Throws per round — the round can only be completed after exactly this many. */
export const DART_THROWS_PER_ROUND = 3;
/** Power bar sweet spot: inside it the dart lands where you aimed. */
export const DART_SWEET_MIN = 0.68;
export const DART_SWEET_MAX = 0.82;
/** Board radii of extra drift per unit of power error outside the sweet spot. */
export const DART_POWER_DRIFT = 1.35;

export interface DartThrow {
  /** Distance from centre, 0..1 (1 = outer edge). */
  radial: number;
  /** Angle in radians. */
  angle: number;
  /** Power bar position 0..1 at release; sweet-spot is 0.68..0.82. */
  power: number;
}

export interface DartLanding {
  /** Board-relative position 0..1 (0.5, 0.5 = centre); can leave the board on a wild throw. */
  x: number;
  y: number;
  /** Distance from centre in board radii (1 = outer edge). */
  radial: number;
  /** Angle in radians of the landing point. */
  angle: number;
  /** Clamped power actually used. */
  power: number;
}

export interface DartThrowResult extends DartLanding {
  points: number;
  label: string;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** How far outside the sweet spot a release was (0 = perfect timing). */
export function dartPowerError(power: number): number {
  const p = clamp01(power);
  if (p < DART_SWEET_MIN) return DART_SWEET_MIN - p;
  if (p > DART_SWEET_MAX) return p - DART_SWEET_MAX;
  return 0;
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

/**
 * Aim (board-relative 0..1) + power → the actual landing point of the dart.
 * Power error outside the sweet spot pushes the landing radially outward, so
 * a rushed release visibly travels past the rim instead of sticking where
 * the crosshair sat.
 */
export function resolveDartLanding(aimX: number, aimY: number, power: number): DartLanding {
  const pwr = clamp01(power);
  const ox = clamp01(aimX) * 2 - 1;
  const oy = clamp01(aimY) * 2 - 1;
  const aimRadial = Math.hypot(ox, oy);
  const angle = aimRadial === 0 ? 0 : Math.atan2(oy, ox);
  const radial = aimRadial + dartPowerError(pwr) * DART_POWER_DRIFT;
  return {
    x: 0.5 + (Math.cos(angle) * radial) / 2,
    y: 0.5 + (Math.sin(angle) * radial) / 2,
    radial,
    angle,
    power: pwr,
  };
}

/** Full throw resolution: landing coordinates *and* the points they earn. */
export function resolveDartThrow(aimX: number, aimY: number, power: number): DartThrowResult {
  const landing = resolveDartLanding(aimX, aimY, power);
  const scored = scoreDartThrow(landing);
  return { ...landing, ...scored };
}

export function scoreDartRound(throws: { points: number }[]): number {
  return throws.reduce((sum, t) => sum + (Number.isFinite(t.points) ? t.points : 0), 0);
}

/** A dart round is only completable once every throw has been taken. */
export function isDartRoundComplete(throwsTaken: number): boolean {
  return throwsTaken >= DART_THROWS_PER_ROUND;
}


// ─── Shared deterministic RNG (mulberry32 as an explicit pure step) ──────────

/** One pure RNG step: returns the value plus the seed to carry forward. */
export function rngNext(seed: number): { value: number; seed: number } {
  let a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: a };
}

// ─── Crypto Candle Runner ────────────────────────────────────────────────────

export const RUNNER_WIDTH = 440;
export const RUNNER_HEIGHT = 260;
export const RUNNER_ROUND_MS = 60_000;
/** Player track and hitbox (px, canvas space). */
export const RUNNER_PLAYER_X = 86;
export const RUNNER_PLAYER_HALF_W = 12;
export const RUNNER_PLAYER_HALF_H = 16;
/** Vertical speed of the player in px/s (elapsed-time physics, not per-frame). */
export const RUNNER_PLAYER_SPEED = 300;
export const RUNNER_MIN_SPEED = 190;
export const RUNNER_MAX_SPEED = 320;
/** Grace period after clipping a needle so one candle cannot bill twice. */
export const RUNNER_INVULN_MS = 700;

export type RunnerObjectKind = 'coin' | 'wick';

export interface RunnerObject {
  id: number;
  kind: RunnerObjectKind;
  /** Distance travelled (px) at the moment the object was spawned. */
  spawnDistance: number;
  /** Centre y in canvas space. */
  y: number;
  /** Half extents in px. */
  halfW: number;
  halfH: number;
  /** Set once collected/hit so it can neither score nor bill twice. */
  consumed: boolean;
}

export interface RunnerState {
  rngSeed: number;
  elapsedMs: number;
  /** Total scrolled distance in px — the single source of object positions. */
  distance: number;
  playerY: number;
  /** Next distance (px) at which an object spawns. */
  nextSpawnDistance: number;
  nextId: number;
  objects: RunnerObject[];
  coins: number;
  wickHits: number;
  invulnUntilMs: number;
  misses: number;
  runOver: boolean;
  completed: boolean;
}

export type RunnerEvent =
  | { type: 'coin'; id: number; atMs: number; x: number; y: number }
  | { type: 'wick'; id: number; atMs: number; x: number; y: number }
  | { type: 'escaped'; id: number; atMs: number };

export interface RunnerInput {
  /** -1 (up) .. 1 (down) held direction. */
  moveY?: number;
  /** Pointer/touch target y in canvas space; `null` = not steering. */
  targetY?: number | null;
}

export interface RunnerStep {
  state: RunnerState;
  events: RunnerEvent[];
}

/** Scroll speed ramps with elapsed time, capped so the run stays fair. */
export function runnerSpeed(elapsedMs: number): number {
  const ramp = Math.min(Math.max(elapsedMs, 0) / RUNNER_ROUND_MS, 1);
  return RUNNER_MIN_SPEED + (RUNNER_MAX_SPEED - RUNNER_MIN_SPEED) * ramp;
}

export function createRunnerState(seed = 1): RunnerState {
  return {
    rngSeed: (seed >>> 0) || 1,
    elapsedMs: 0,
    distance: 0,
    playerY: RUNNER_HEIGHT / 2,
    nextSpawnDistance: 90,
    nextId: 1,
    objects: [],
    coins: 0,
    wickHits: 0,
    invulnUntilMs: -RUNNER_INVULN_MS,
    misses: 0,
    runOver: false,
    completed: false,
  };
}

/** Object x is derived from scrolled distance, so physics never depends on frame rate. */
export function runnerObjectX(obj: RunnerObject, distance: number): number {
  return RUNNER_WIDTH + 30 - (distance - obj.spawnDistance);
}

export function runnerPlayerBox(playerY: number): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: RUNNER_PLAYER_X - RUNNER_PLAYER_HALF_W,
    maxX: RUNNER_PLAYER_X + RUNNER_PLAYER_HALF_W,
    minY: playerY - RUNNER_PLAYER_HALF_H,
    maxY: playerY + RUNNER_PLAYER_HALF_H,
  };
}

/** AABB overlap between the player box and one object box (pure hit test). */
export function runnerCollides(obj: RunnerObject, distance: number, playerY: number): boolean {
  const ox = runnerObjectX(obj, distance);
  const box = runnerPlayerBox(playerY);
  return (
    Math.abs(ox - RUNNER_PLAYER_X) < obj.halfW + RUNNER_PLAYER_HALF_W &&
    Math.abs(obj.y - playerY) < obj.halfH + RUNNER_PLAYER_HALF_H
  );
}

function movePlayerToward(state: RunnerState, input: RunnerInput, dtMs: number): number {
  const dt = Math.max(dtMs, 0) / 1000;
  const min = RUNNER_PLAYER_HALF_H;
  const max = RUNNER_HEIGHT - RUNNER_PLAYER_HALF_H;
  let y = state.playerY;
  const step = RUNNER_PLAYER_SPEED * dt;

  if (typeof input.targetY === 'number' && Number.isFinite(input.targetY)) {
    const target = Math.min(max, Math.max(min, input.targetY));
    const delta = target - y;
    y += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;
  } else {
    y += Math.min(1, Math.max(-1, input.moveY ?? 0)) * step;
  }
  return Math.min(max, Math.max(min, y));
}

/**
 * Advance the runner by `dtMs` of elapsed time. Spawning, scrolling, player
 * motion and collisions all derive from `dt` + the carried RNG seed, so the
 * same seed + same dt sequence always produces the same run.
 */
export function stepRunner(state: RunnerState, dtMs: number, input: RunnerInput = {}): RunnerStep {
  const events: RunnerEvent[] = [];
  if (state.runOver) return { state, events };

  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  const elapsedMs = Math.min(state.elapsedMs + dt, RUNNER_ROUND_MS);
  const distance = state.distance + runnerSpeed(elapsedMs) * (dt / 1000);
  const playerY = movePlayerToward(state, input, dt);

  let rngSeed = state.rngSeed;
  let nextId = state.nextId;
  let nextSpawnDistance = state.nextSpawnDistance;
  const objects = state.objects.map((o) => ({ ...o }));

  // Spawn ahead of the player, in scrolled-distance space.
  while (nextSpawnDistance <= distance) {
    const kindRoll = rngNext(rngSeed);
    rngSeed = kindRoll.seed;
    const yRoll = rngNext(rngSeed);
    rngSeed = yRoll.seed;
    const gapRoll = rngNext(rngSeed);
    rngSeed = gapRoll.seed;

    const kind: RunnerObjectKind = kindRoll.value < 0.6 ? 'coin' : 'wick';
    const y = 34 + yRoll.value * (RUNNER_HEIGHT - 68);
    objects.push({
      id: nextId++,
      kind,
      spawnDistance: nextSpawnDistance,
      y,
      halfW: kind === 'coin' ? 10 : 6,
      halfH: kind === 'coin' ? 10 : 20,
      consumed: false,
    });
    nextSpawnDistance += 120 + gapRoll.value * 110;
  }

  let coins = state.coins;
  let wickHits = state.wickHits;
  let misses = state.misses;
  let invulnUntilMs = state.invulnUntilMs;

  for (const obj of objects) {
    const x = runnerObjectX(obj, distance);
    if (x < -40) {
      if (!obj.consumed) {
        misses += 1;
        if (obj.kind === 'coin') events.push({ type: 'escaped', id: obj.id, atMs: elapsedMs });
      }
      obj.consumed = true;
      continue;
    }
    if (obj.consumed) continue;
    if (!runnerCollides(obj, distance, playerY)) continue;

    obj.consumed = true;
    if (obj.kind === 'coin') {
      coins += 1;
      events.push({ type: 'coin', id: obj.id, atMs: elapsedMs, x, y: obj.y });
    } else if (elapsedMs >= invulnUntilMs) {
      wickHits += 1;
      invulnUntilMs = elapsedMs + RUNNER_INVULN_MS;
      events.push({ type: 'wick', id: obj.id, atMs: elapsedMs, x, y: obj.y });
    }
  }

  const runOver = elapsedMs >= RUNNER_ROUND_MS;
  return {
    state: {
      ...state,
      rngSeed,
      elapsedMs,
      distance,
      playerY,
      nextSpawnDistance,
      nextId,
      objects: objects.filter((o) => runnerObjectX(o, distance) > -40),
      coins,
      wickHits,
      invulnUntilMs,
      misses,
      runOver,
      completed: runOver || state.completed,
    },
    events,
  };
}

/** Runner score for a finished run — aborted/abandoned runs are worth nothing. */
export function runnerScore(state: RunnerState): number {
  return scoreRunner({
    coins: state.coins,
    wickHits: state.wickHits,
    completed: state.completed && state.runOver,
    durationMs: state.elapsedMs,
  });
}

export interface RunnerScoreInput {
  /** Coins collected. */
  coins: number;
  /** Wicks hit (each costs 5 coins). */
  wickHits: number;
  /** Whether the run was completed without pause/abandonment. */
  completed: boolean;
  /** Elapsed ms. */
  durationMs: number;
}

export function scoreRunner(e: RunnerScoreInput): number {
  if (!e.completed) return 0;
  return Math.max(0, e.coins - 5 * e.wickHits) * 10;
}

// ─── Boss Whack-A-Bug ─────────────────────────────────────────────────────────

export const WHACK_WIDTH = 440;
export const WHACK_HEIGHT = 260;
export const WHACK_ROUND_MS = 30_000;
export const WHACK_BUG_RADIUS = 22;
export const WHACK_FRIENDLY_CHANCE = 0.18;
export const WHACK_MIN_TTL_MS = 1_900;
export const WHACK_MAX_TTL_MS = 2_800;

export interface WhackBug {
  id: number;
  x: number;
  y: number;
  isFriendly: boolean;
  spawnedAtMs: number;
  ttlMs: number;
}

export interface WhackState {
  rngSeed: number;
  elapsedMs: number;
  bugs: WhackBug[];
  nextSpawnAtMs: number;
  nextId: number;
  hits: number;
  friendlyFire: number;
  misses: number;
  escaped: number;
  runOver: boolean;
  completed: boolean;
}

export type WhackHitEvent =
  | { type: 'bug'; id: number; x: number; y: number; atMs: number }
  | { type: 'friendly'; id: number; x: number; y: number; atMs: number }
  | { type: 'miss'; x: number; y: number; atMs: number }
  | { type: 'escaped'; id: number; atMs: number };

export function createWhackState(seed = 1): WhackState {
  return {
    rngSeed: (seed >>> 0) || 1,
    elapsedMs: 0,
    bugs: [],
    nextSpawnAtMs: 350,
    nextId: 1,
    hits: 0,
    friendlyFire: 0,
    misses: 0,
    escaped: 0,
    runOver: false,
    completed: false,
  };
}

/** True when a whack at (x, y) lands on this bug's hit circle. */
export function whackHitsBug(bug: WhackBug, x: number, y: number): boolean {
  return Math.hypot(bug.x - x, bug.y - y) <= WHACK_BUG_RADIUS;
}

/** Nearest bug under the pointer, or null — used by the pointer hit test. */
export function bugAtPoint(state: WhackState, x: number, y: number): WhackBug | null {
  let best: WhackBug | null = null;
  let bestDist = Infinity;
  for (const bug of state.bugs) {
    const d = Math.hypot(bug.x - x, bug.y - y);
    if (d <= WHACK_BUG_RADIUS && d < bestDist) {
      best = bug;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Apply a whack. Only real hits score; empty swings just record a miss and
 * never touch the score.
 */
export function whackAt(state: WhackState, x: number, y: number): { state: WhackState; event: WhackHitEvent } {
  if (state.runOver) {
    return { state, event: { type: 'miss', x, y, atMs: state.elapsedMs } };
  }
  const bug = bugAtPoint(state, x, y);
  if (!bug) {
    return {
      state: { ...state, misses: state.misses + 1 },
      event: { type: 'miss', x, y, atMs: state.elapsedMs },
    };
  }
  const bugs = state.bugs.filter((b) => b.id !== bug.id);
  if (bug.isFriendly) {
    return {
      state: { ...state, bugs, friendlyFire: state.friendlyFire + 1 },
      event: { type: 'friendly', id: bug.id, x: bug.x, y: bug.y, atMs: state.elapsedMs },
    };
  }
  return {
    state: { ...state, bugs, hits: state.hits + 1 },
    event: { type: 'bug', id: bug.id, x: bug.x, y: bug.y, atMs: state.elapsedMs },
  };
}

/** Advance bug spawning/expiry by elapsed time (no automatic scoring). */
export function stepWhack(state: WhackState, dtMs: number): { state: WhackState; events: WhackHitEvent[] } {
  const events: WhackHitEvent[] = [];
  if (state.runOver) return { state, events };

  const dt = Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  const elapsedMs = Math.min(state.elapsedMs + dt, WHACK_ROUND_MS);
  let rngSeed = state.rngSeed;
  let nextId = state.nextId;
  let nextSpawnAtMs = state.nextSpawnAtMs;
  const bugs = state.bugs.map((b) => ({ ...b }));
  let escaped = state.escaped;

  while (nextSpawnAtMs <= elapsedMs) {
    const friendlyRoll = rngNext(rngSeed);
    rngSeed = friendlyRoll.seed;
    const xRoll = rngNext(rngSeed);
    rngSeed = xRoll.seed;
    const yRoll = rngNext(rngSeed);
    rngSeed = yRoll.seed;
    const ttlRoll = rngNext(rngSeed);
    rngSeed = ttlRoll.seed;
    const gapRoll = rngNext(rngSeed);
    rngSeed = gapRoll.seed;

    bugs.push({
      id: nextId++,
      x: 34 + xRoll.value * (WHACK_WIDTH - 68),
      y: 34 + yRoll.value * (WHACK_HEIGHT - 68),
      isFriendly: friendlyRoll.value < WHACK_FRIENDLY_CHANCE,
      spawnedAtMs: nextSpawnAtMs,
      ttlMs: WHACK_MIN_TTL_MS + ttlRoll.value * (WHACK_MAX_TTL_MS - WHACK_MIN_TTL_MS),
    });
    nextSpawnAtMs += 620 + gapRoll.value * 380;
  }

  const alive = bugs.filter((b) => {
    const expired = elapsedMs - b.spawnedAtMs >= b.ttlMs;
    if (expired) {
      escaped += 1;
      events.push({ type: 'escaped', id: b.id, atMs: elapsedMs });
    }
    return !expired;
  });

  const runOver = elapsedMs >= WHACK_ROUND_MS;
  return {
    state: {
      ...state,
      rngSeed,
      elapsedMs,
      bugs: alive,
      nextSpawnAtMs,
      nextId,
      escaped,
      runOver,
      completed: runOver || state.completed,
    },
    events,
  };
}

/** Whack score for a finished round — abandoned rounds are worth nothing. */
export function whackScore(state: WhackState): number {
  return scoreWhack({
    bugsWhacked: state.hits,
    friendlyFire: state.friendlyFire,
    completed: state.completed && state.runOver,
  });
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
