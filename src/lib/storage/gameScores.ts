import {
  GAME_IDS,
  SCORE_STORAGE_KEY,
  groupBoards,
  sanitizeScoreRecords,
  submitScore,
  type GameId,
  type ScoreRecord,
} from '../engine/minigames';

/**
 * Persistence for the penthouse minigame leaderboards.
 *
 * One storage key holds a flat array of validated records; boards are split per
 * game on read, so saving or resetting one game never clobbers another. Every
 * read is validated and every write may fail. A failed write returns the
 * records as `unsaved`; the caller keeps them as session-only pending records
 * and merges them back on the next read, so they are never silently dropped.
 */

export interface ScoreStoreLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export type GameBoards = Record<GameId, ScoreRecord[]>;

export const RULESETS: Record<GameId, string> = {
  darts: 'darts-v1',
  'crypto-runner': 'runner-v1',
  'whack-a-bug': 'whack-v1',
};

export function emptyBoards(): GameBoards {
  const boards = {} as GameBoards;
  for (const gameId of GAME_IDS) boards[gameId] = [];
  return boards;
}

/** Deterministic record id: game + completion time + nonce. */
export function nextRecordId(gameId: GameId, completedAt: number, nonce: string): string {
  return `${gameId}-${completedAt}-${nonce}`;
}

function flattenBoards(boards: GameBoards): ScoreRecord[] {
  const flat: ScoreRecord[] = [];
  for (const gameId of GAME_IDS) flat.push(...(boards[gameId] ?? []));
  return flat;
}

/** Stored boards plus session-only pending records, deduplicated and ranked. */
export function withSessionRecords(boards: GameBoards, pending: ScoreRecord[]): GameBoards {
  return groupBoards(sanitizeScoreRecords([...flattenBoards(boards), ...pending]).records);
}

export interface LoadBoardsOutcome {
  boards: GameBoards;
  /** Stored payload was unreadable or partially malformed (still usable). */
  invalid: boolean;
  /** Storage itself refused to be read: session-only mode. */
  readFailed: boolean;
}

export function loadGameBoards(store: ScoreStoreLike | null | undefined): LoadBoardsOutcome {
  if (!store) return { boards: emptyBoards(), invalid: false, readFailed: true };

  let raw: string | null;
  try {
    raw = store.getItem(SCORE_STORAGE_KEY);
  } catch {
    return { boards: emptyBoards(), invalid: false, readFailed: true };
  }
  if (raw === null || raw.trim() === '') return { boards: emptyBoards(), invalid: false, readFailed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { boards: emptyBoards(), invalid: true, readFailed: false };
  }

  const { records, dropped } = sanitizeScoreRecords(parsed);
  return {
    boards: groupBoards(records),
    invalid: dropped > 0 || !Array.isArray(parsed),
    readFailed: false,
  };
}

/** Write the complete set of boards. Returns whether the write actually stuck. */
export function saveGameBoards(store: ScoreStoreLike | null | undefined, boards: GameBoards): boolean {
  if (!store) return false;
  try {
    store.setItem(SCORE_STORAGE_KEY, JSON.stringify(flattenBoards(boards)));
    return true;
  } catch {
    return false;
  }
}

export interface SubmitOutcome {
  /** True when the record was accepted by the ranking rules. */
  ok: boolean;
  /** True when the boards (including this record) reached storage. */
  persisted: boolean;
  /** Boards to show: stored data plus any session-only records. */
  boards: GameBoards;
  /** Session-only records to carry into the next submit/read. Empty once persisted. */
  unsaved: ScoreRecord[];
  reason?: string;
}

/**
 * Persist a completed round. Abandoned rounds (`completed === false`) and rejected
 * scores never reach storage. `pending` holds earlier session-only records that
 * failed to save; they are written together with this one when storage recovers.
 */
export function submitCompletedScore(
  store: ScoreStoreLike | null | undefined,
  record: ScoreRecord,
  completed: boolean,
  pending: ScoreRecord[] = [],
): SubmitOutcome {
  const base = withSessionRecords(loadGameBoards(store).boards, pending);
  if (!completed) {
    return { ok: false, persisted: false, boards: base, unsaved: pending, reason: 'Round was not completed' };
  }
  const result = submitScore(base[record.gameId] ?? [], record);
  if (result.ok === false) {
    return { ok: false, persisted: false, boards: base, unsaved: pending, reason: result.reason };
  }
  const boards: GameBoards = { ...base, [record.gameId]: result.entries };
  const persisted = saveGameBoards(store, boards);
  return { ok: true, persisted, boards, unsaved: persisted ? [] : flattenBoards(boards) };
}

export interface ResetOutcome {
  persisted: boolean;
  boards: GameBoards;
  unsaved: ScoreRecord[];
}

/**
 * Clear exactly one game's board. Other games, stored or session-only, are
 * carried over unchanged.
 */
export function resetGameBoard(
  store: ScoreStoreLike | null | undefined,
  gameId: GameId,
  pending: ScoreRecord[] = [],
): ResetOutcome {
  const base = withSessionRecords(loadGameBoards(store).boards, pending.filter((r) => r.gameId !== gameId));
  const boards: GameBoards = { ...base, [gameId]: [] };
  const persisted = saveGameBoards(store, boards);
  return { persisted, boards, unsaved: persisted ? [] : flattenBoards(boards) };
}
