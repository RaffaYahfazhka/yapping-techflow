import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const {
  rankEntries, submitScore, LEADERBOARD_CAP, scoreDartThrow, scoreRunner, scoreWhack,
} = await import('../src/lib/engine/minigames');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

ok('darts scoring: bullseye, miss, sector, ring (deterministic)', () => {
  assert.deepEqual(scoreDartThrow({ radial: 0.03, angle: 0, power: 0.75 }), { points: 50, label: 'Bullseye' });
  assert.deepEqual(scoreDartThrow({ radial: 1.1, angle: 0, power: 0.75 }), { points: 0, label: 'Miss' });
  assert.deepEqual(scoreDartThrow({ radial: 0.35, angle: 1.2, power: 0.75 }), { points: 30, label: 'Sector 13' });
  assert.deepEqual(scoreDartThrow({ radial: 0.75, angle: -0.4, power: 0.75 }), { points: 20, label: 'Ring 8' });
});

ok('leaderboard ranking: score desc, time asc, recordId asc (stable ties)', () => {
  const entries = [
    { gameId: 'darts', recordId: 'c', playerId: 'a', score: 100, completedAt: 30, ruleset: 'v1' },
    { gameId: 'darts', recordId: 'b', playerId: 'b', score: 100, completedAt: 20, ruleset: 'v1' },
    { gameId: 'darts', recordId: 'a', playerId: 'c', score: 200, completedAt: 99, ruleset: 'v1' },
  ];
  const ranked = rankEntries(entries);
  assert.deepEqual(ranked.map((e) => e.recordId), ['a', 'b', 'c']);
});

ok('submitScore rejects negative / non-integer scores', () => {
  const base = [];
  for (const s of [-1, 1.5, NaN, Infinity]) {
    assert.equal(submitScore(base, { gameId: 'darts', recordId: 'x', playerId: 'p', score: s, completedAt: 1, ruleset: 'v1' }).ok, false);
  }
});

ok('submitScore caps at 10 and is idempotent by recordId', () => {
  let entries = [];
  for (let i = 0; i < 15; i++) {
    const r = submitScore(entries, { gameId: 'darts', recordId: `r${i}`, playerId: `p${i}`, score: 100 - i, completedAt: i, ruleset: 'v1' });
    entries = r.entries ?? entries;
  }
  assert.equal(entries.length, LEADERBOARD_CAP);
  const dup = submitScore(entries, { gameId: 'darts', recordId: 'r0', playerId: 'p', score: 999, completedAt: 1, ruleset: 'v1' });
  assert.equal((dup.entries ?? []).length, LEADERBOARD_CAP);
  assert.equal((dup.entries ?? []).find((e) => e.recordId === 'r0')?.score, 100);
});

ok('crypto runner scoring: coins minus wick penalty * 10, zero when abandoned', () => {
  assert.equal(scoreRunner({ coins: 20, wickHits: 1, completed: true, durationMs: 30000 }), 150);
  assert.equal(scoreRunner({ coins: 999, wickHits: 0, completed: false, durationMs: 1 }), 0);
  assert.equal(scoreRunner({ coins: 2, wickHits: 3, completed: true, durationMs: 100 }), 0);
});

ok('whack-a-bug scoring: 25 per hit minus 75 friendly fire, zero when abandoned', () => {
  assert.equal(scoreWhack({ bugsWhacked: 4, friendlyFire: 0, completed: true }), 100);
  assert.equal(scoreWhack({ bugsWhacked: 4, friendlyFire: 1, completed: true }), 25);
  assert.equal(scoreWhack({ bugsWhacked: 9, friendlyFire: 0, completed: false }), 0);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
