import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const engine = await import('../src/lib/engine/minigames.ts');
const store = await import('../src/lib/storage/gameScores.ts');

const {
  rankEntries, submitScore, LEADERBOARD_CAP, SCORE_STORAGE_KEY,
  scoreDartThrow, resolveDartLanding, resolveDartThrow, scoreDartRound, isDartRoundComplete,
  DART_THROWS_PER_ROUND, DART_POWER_DRIFT,
  scoreRunner, scoreWhack,
  createRunnerState, stepRunner, runnerCollides, runnerScore, runnerSpeed,
  RUNNER_WIDTH, RUNNER_PLAYER_X, RUNNER_ROUND_MS,
  WHACK_ROUND_MS,
  createWhackState, stepWhack, whackAt, whackScore, bugAtPoint,
  sanitizeScoreRecords, groupBoards, isValidScoreRecord,
} = engine;
const {
  loadGameBoards, saveGameBoards, submitCompletedScore, resetGameBoard, emptyBoards,
} = store;

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

const memStore = (init = {}) => {
  const d = new Map(Object.entries(init));
  return {
    d,
    getItem: (k) => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => { d.set(k, v); },
    removeItem: (k) => { d.delete(k); },
  };
};
const failingStore = () => ({
  getItem: () => null,
  setItem: () => { throw new Error('quota'); },
});
const rec = (gameId, recordId, score, completedAt = 1, playerId = 'p') => ({
  gameId, recordId, playerId, score, completedAt, ruleset: 'v1',
});

// ─── Ranking and submission contracts ─────────────────────────────────────────

ok('leaderboard ranking: score desc, time asc, recordId asc (stable ties)', () => {
  const entries = [
    rec('darts', 'c', 100, 30, 'a'),
    rec('darts', 'b', 100, 20, 'b'),
    rec('darts', 'a', 200, 99, 'c'),
  ];
  assert.deepEqual(rankEntries(entries).map((e) => e.recordId), ['a', 'b', 'c']);
});

ok('submitScore rejects negative, fractional, non-finite and unknown-game scores', () => {
  for (const s of [-1, 1.5, NaN, Infinity]) {
    assert.equal(submitScore([], rec('darts', 'x', s)).ok, false);
  }
  assert.equal(submitScore([], rec('bogus', 'x', 5)).ok, false);
});

ok('submitScore caps each game at 10 and is idempotent by recordId', () => {
  let entries = [];
  for (let i = 0; i < 15; i++) {
    entries = submitScore(entries, rec('darts', `r${i}`, 100 - i, i, `p${i}`)).entries;
  }
  assert.equal(entries.length, LEADERBOARD_CAP);
  const dup = submitScore(entries, rec('darts', 'r0', 999, 1));
  assert.equal(dup.entries.length, LEADERBOARD_CAP);
  assert.equal(dup.entries.find((e) => e.recordId === 'r0')?.score, 100);
});

// ─── Scoring formulas ─────────────────────────────────────────────────────────

ok('darts ring scoring: bullseye, miss, sector, ring (deterministic)', () => {
  assert.deepEqual(scoreDartThrow({ radial: 0.03, angle: 0, power: 0.75 }), { points: 50, label: 'Bullseye' });
  assert.deepEqual(scoreDartThrow({ radial: 1.1, angle: 0, power: 0.75 }), { points: 0, label: 'Miss' });
  assert.deepEqual(scoreDartThrow({ radial: 0.35, angle: 1.2, power: 0.75 }), { points: 30, label: 'Sector 13' });
  assert.deepEqual(scoreDartThrow({ radial: 0.75, angle: -0.4, power: 0.75 }), { points: 20, label: 'Ring 8' });
});

ok('runner scoring: coins minus 5 per wick, times 10, zero when not completed', () => {
  assert.equal(scoreRunner({ coins: 20, wickHits: 1, completed: true, durationMs: 30000 }), 150);
  assert.equal(scoreRunner({ coins: 999, wickHits: 0, completed: false, durationMs: 1 }), 0);
  assert.equal(scoreRunner({ coins: 2, wickHits: 3, completed: true, durationMs: 100 }), 0);
});

ok('whack scoring: 25 per hit minus 75 friendly fire, floored at zero, zero when not completed', () => {
  assert.equal(scoreWhack({ bugsWhacked: 4, friendlyFire: 0, completed: true }), 100);
  assert.equal(scoreWhack({ bugsWhacked: 4, friendlyFire: 1, completed: true }), 25);
  assert.equal(scoreWhack({ bugsWhacked: 1, friendlyFire: 1, completed: true }), 0);
  assert.equal(scoreWhack({ bugsWhacked: 9, friendlyFire: 0, completed: false }), 0);
});

// ─── Darts: landing coordinates, power, exactly three throws ─────────────────

ok('darts: sweet-spot release lands exactly where aimed', () => {
  const landing = resolveDartLanding(0.75, 0.5, 0.75);
  assert.equal(landing.x, 0.75);
  assert.equal(landing.y, 0.5);
});

ok('darts: power outside the sweet spot pushes the landing outward by the drift formula', () => {
  const aimed = resolveDartLanding(0.75, 0.5, 0.75);
  const weak = resolveDartLanding(0.75, 0.5, 0.2);
  assert.ok(weak.radial > aimed.radial, 'weak throw should overshoot the aim radius');
  const expectedRadial = 0.5 + (0.68 - 0.2) * DART_POWER_DRIFT;
  assert.ok(Math.abs(weak.radial - expectedRadial) < 1e-9);
  assert.equal(weak.angle, 0);
});

ok('darts: centre aim with sweet power is a bullseye; off-board power misses', () => {
  const centre = resolveDartThrow(0.5, 0.5, 0.75);
  assert.deepEqual({ points: centre.points, label: centre.label }, { points: 50, label: 'Bullseye' });
  const wild = resolveDartThrow(1, 0.5, 0);
  assert.equal(wild.label, 'Miss');
  assert.equal(wild.points, 0);
});

ok('darts: round is exactly three throws and scores their sum', () => {
  assert.equal(DART_THROWS_PER_ROUND, 3);
  assert.equal(isDartRoundComplete(2), false);
  assert.equal(isDartRoundComplete(3), true);
  assert.equal(scoreDartRound([{ points: 50 }, { points: 30 }, { points: 0 }]), 80);
});

// ─── Runner: elapsed-time physics and real collisions ─────────────────────────

const runnerObj = (kind, y, extra = {}) => ({
  id: 1, kind, spawnDistance: 0, y, halfW: kind === 'coin' ? 10 : 6, halfH: kind === 'coin' ? 10 : 20, consumed: false, ...extra,
});
const distanceForPlayerX = () => RUNNER_WIDTH + 30 - RUNNER_PLAYER_X;

ok('runner: an object overlapping the player box collides; distant ones do not', () => {
  const o = runnerObj('coin', 130);
  assert.equal(runnerCollides(o, distanceForPlayerX(), 130), true);
  assert.equal(runnerCollides(o, distanceForPlayerX(), 10), false);
  assert.equal(runnerCollides(o, 0, 130), false);
});

ok('runner: a coin under the player is collected once and never double-counted', () => {
  const base = { ...createRunnerState(3), distance: distanceForPlayerX(), playerY: 130, nextSpawnDistance: 1e9, objects: [runnerObj('coin', 130)] };
  const first = stepRunner(base, 0, {});
  assert.equal(first.state.coins, 1);
  assert.equal(first.events[0].type, 'coin');
  const second = stepRunner(first.state, 0, {});
  assert.equal(second.state.coins, 1);
  assert.equal(second.events.length, 0);
});

ok('runner: overlapping wicks bill one life, then invulnerability blocks the next', () => {
  const wickA = runnerObj('wick', 130, { id: 1, halfH: 20, halfW: 6 });
  const wickB = runnerObj('wick', 130, { id: 2, halfH: 20, halfW: 6 });
  const base = { ...createRunnerState(3), distance: distanceForPlayerX(), playerY: 130, nextSpawnDistance: 1e9, objects: [wickA, wickB] };
  const after = stepRunner(base, 0, {});
  assert.equal(after.state.wickHits, 1);
  assert.equal(after.events.filter((e) => e.type === 'wick').length, 1);
});

ok('runner: identical seed and dt sequence produces an identical run', () => {
  const run = (seed) => {
    let s = createRunnerState(seed);
    for (let i = 0; i < 400; i++) s = stepRunner(s, 16.7, { targetY: 130 }).state;
    return s;
  };
  assert.deepEqual(run(42), run(42));
});

ok('runner: scroll distance equals the right-endpoint speed integral over elapsed time', () => {
  // stepRunner advances by speed evaluated at the end of each step.
  let s = createRunnerState(9);
  let expected = 0;
  for (let i = 0; i < 10; i++) {
    s = stepRunner(s, 1000, { targetY: 130 }).state;
    expected += runnerSpeed((i + 1) * 1000) * 1;
  }
  assert.ok(Math.abs(s.distance - expected) < 1e-6, `distance ${s.distance} vs ${expected}`);
});

ok('runner: completing the 60s round sets completed; partial runs score zero', () => {
  const partial = stepRunner(createRunnerState(5), 5000, {}).state;
  assert.equal(partial.runOver, false);
  assert.equal(runnerScore(partial), 0);
  const done = stepRunner(createRunnerState(5), RUNNER_ROUND_MS, {}).state;
  assert.equal(done.runOver, true);
  assert.equal(done.completed, true);
  assert.equal(runnerScore(done), Math.max(0, done.coins - 5 * done.wickHits) * 10);
});

ok('runner: a finished state no longer advances', () => {
  const done = stepRunner(createRunnerState(5), RUNNER_ROUND_MS, {}).state;
  const again = stepRunner(done, 1000, {});
  assert.equal(again.state, done);
  assert.equal(again.events.length, 0);
});

// ─── Whack-A-Bug: pointer hits, friendly fire, misses, expiry ─────────────────

const whackWith = (bugs, elapsedMs = 0) => ({ ...createWhackState(1), bugs, elapsedMs, nextSpawnAtMs: 1e9 });
const bug = (id, x, y, isFriendly = false) => ({ id, x, y, isFriendly, spawnedAtMs: 0, ttlMs: 2000 });

ok('whack: a bug hit counts only once the round completes; friendly hit costs 75', () => {
  let s = whackWith([bug(1, 100, 100), bug(2, 300, 100, true)]);
  s = whackAt(s, 100, 100).state;
  assert.equal(s.hits, 1);
  s = whackAt(s, 300, 100).state;
  assert.equal(s.friendlyFire, 1);
  // Mid-round score is not final: not completed yet.
  assert.equal(whackScore(s), 0);
  s = stepWhack(s, WHACK_ROUND_MS).state;
  assert.equal(s.runOver, true);
  assert.equal(whackScore(s), 0, 'one hit (25) minus one friendly (75) clamps to zero');
});

ok('whack: a clean completed round scores 25 per bug hit', () => {
  let s = whackWith([bug(1, 100, 100), bug(2, 300, 100)]);
  s = whackAt(s, 100, 100).state;
  s = whackAt(s, 300, 100).state;
  s = stepWhack(s, WHACK_ROUND_MS).state;
  assert.equal(whackScore(s), 50);
});

ok('whack: empty swings count as misses and never change the score', () => {
  const s = whackWith([bug(1, 100, 100)]);
  const r = whackAt(s, 400, 240);
  assert.equal(r.event.type, 'miss');
  assert.equal(r.state.misses, 1);
  assert.equal(r.state.hits, 0);
  assert.equal(bugAtPoint(s, 400, 240), null);
});

ok('whack: a bug expires after its ttl and is counted as escaped', () => {
  const s = stepWhack(whackWith([bug(1, 100, 100)]), 2500).state;
  assert.equal(s.bugs.length, 0);
  assert.equal(s.escaped, 1);
});

// ─── Storage: validation, per-game boards, cross-game preservation ─────────────

ok('storage: validation drops malformed, unknown-game and duplicate records', () => {
  const raw = [
    rec('darts', 'a', 10),
    rec('darts', 'a', 99),
    rec('mystery', 'b', 5),
    { ...rec('darts', 'c', 5), score: 1.5 },
    { ...rec('darts', 'd', 5), playerId: '' },
    null,
    rec('whack-a-bug', 'e', 40),
  ];
  const { records, dropped } = sanitizeScoreRecords(raw);
  assert.deepEqual(records.map((r) => r.recordId).sort(), ['a', 'e']);
  assert.equal(dropped, 5);
  assert.equal(isValidScoreRecord(rec('darts', 'z', 0)), true);
});

ok('storage: corrupt JSON loads as empty boards flagged invalid, without throwing', () => {
  const out = loadGameBoards(memStore({ [SCORE_STORAGE_KEY]: '{bad' }));
  assert.equal(out.invalid, true);
  assert.deepEqual(out.boards, emptyBoards());
});

ok('storage: an abandoned round writes nothing; a completed round persists', () => {
  const s = memStore();
  const abandoned = submitCompletedScore(s, rec('darts', 'x1', 80), false);
  assert.equal(abandoned.ok, false);
  assert.equal(s.d.has(SCORE_STORAGE_KEY), false);
  const done = submitCompletedScore(s, rec('darts', 'x2', 80), true);
  assert.equal(done.ok, true);
  assert.equal(done.persisted, true);
  assert.equal(loadGameBoards(s).boards.darts[0].recordId, 'x2');
});

ok('storage: each game keeps its own top 10; writes to one board preserve the others', () => {
  const s = memStore();
  submitCompletedScore(s, rec('crypto-runner', 'cr-1', 500), true);
  submitCompletedScore(s, rec('whack-a-bug', 'wb-1', 250), true);
  for (let i = 0; i < 12; i++) submitCompletedScore(s, rec('darts', `d-${i}`, i * 10, i), true);
  const boards = loadGameBoards(s).boards;
  assert.equal(boards.darts.length, LEADERBOARD_CAP);
  assert.equal(boards['crypto-runner'].length, 1);
  assert.equal(boards['whack-a-bug'].length, 1);
  assert.equal(boards.darts[0].score, 110);
});

ok('storage: resetting one board clears only that board, stored or pending', () => {
  const s = memStore();
  submitCompletedScore(s, rec('darts', 'd1', 10), true);
  submitCompletedScore(s, rec('crypto-runner', 'cr1', 20), true);
  submitCompletedScore(s, rec('whack-a-bug', 'wb1', 30), true);
  const out = resetGameBoard(s, 'crypto-runner');
  assert.equal(out.persisted, true);
  assert.deepEqual(out.boards['crypto-runner'], []);
  const reloaded = loadGameBoards(s).boards;
  assert.equal(reloaded.darts.length, 1);
  assert.equal(reloaded['whack-a-bug'].length, 1);
  assert.equal(reloaded['crypto-runner'].length, 0);
});

ok('storage: a duplicate completion persists once', () => {
  const s = memStore();
  submitCompletedScore(s, rec('darts', 'same', 40), true);
  submitCompletedScore(s, rec('darts', 'same', 40), true);
  assert.equal(loadGameBoards(s).boards.darts.length, 1);
});

ok('storage: a failed write keeps the score as pending and it is saved once storage recovers', () => {
  const failed = submitCompletedScore(failingStore(), rec('darts', 'f1', 60), true);
  assert.equal(failed.ok, true);
  assert.equal(failed.persisted, false);
  assert.equal(failed.unsaved.length, 1);
  assert.equal(failed.boards.darts[0].recordId, 'f1');

  const recovered = memStore();
  const later = submitCompletedScore(recovered, rec('whack-a-bug', 'w1', 25), true, failed.unsaved);
  assert.equal(later.persisted, true);
  assert.deepEqual(later.unsaved, []);
  const boards = loadGameBoards(recovered).boards;
  assert.equal(boards.darts[0].recordId, 'f1');
  assert.equal(boards['whack-a-bug'][0].recordId, 'w1');
  assert.equal(saveGameBoards(failingStore(), emptyBoards()), false);
});

ok('storage: tie ordering survives a reload (score, time, record id)', () => {
  const s = memStore();
  submitCompletedScore(s, rec('darts', 'b', 50, 5), true);
  submitCompletedScore(s, rec('darts', 'a', 50, 5), true);
  submitCompletedScore(s, rec('darts', 'c', 50, 1), true);
  assert.deepEqual(loadGameBoards(s).boards.darts.map((r) => r.recordId), ['c', 'a', 'b']);
});

ok('storage: groupBoards keeps games isolated and ranked', () => {
  const boards = groupBoards([rec('darts', 'x', 1), rec('whack-a-bug', 'y', 9), rec('darts', 'z', 5)]);
  assert.deepEqual(boards.darts.map((r) => r.recordId), ['z', 'x']);
  assert.deepEqual(boards['whack-a-bug'].map((r) => r.recordId), ['y']);
  assert.deepEqual(boards['crypto-runner'], []);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
