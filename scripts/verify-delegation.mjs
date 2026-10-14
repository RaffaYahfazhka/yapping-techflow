import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { initialCompanionState, reduceCompanion } = await import('../src/lib/engine/delegationEngine');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

ok('initial state follows boss at his spawn', () => {
  const st = initialCompanionState({ x: -2.5, z: 2.6 });
  assert.equal(st.mode, 'follow');
  assert.equal(st.action, 'idle');
});

ok('delegation transitions follow -> walking -> delivered and returns to follow', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  const r1 = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'altair-raditya', task: 'Scrape pool Solana', targetDesk: { x: 13.5, z: -6.5 }, now: 1 });
  assert.equal(r1.events[0].kind, 'queued');
  st = r1.state;
  assert.equal(st.action, 'walking');
  const r2 = reduceCompanion(st, { kind: 'mark-delivered', now: 2 });
  assert.equal(r2.events[0].kind, 'delivered');
  assert.equal(r2.state.action, 'delivered');
  assert.equal(r2.state.mode, 'follow'); // returns to follow
});

ok('stay mode: delegation returns the stay anchor (never auto-follows)', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  const r0 = reduceCompanion(st, { kind: 'set-mode', mode: 'stay' });
  st = r0.state;
  st.lastIdleAnchor = { x: 3, z: 4 };
  const r1 = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'kenzo-danendra', task: 'Check spread', targetDesk: { x: 13.5, z: 0 }, now: 1 });
  st = r1.state;
  const r2 = reduceCompanion(st, { kind: 'mark-delivered', now: 2 });
  assert.equal(r2.state.mode, 'stay');
  assert.deepEqual(r2.state.stayAnchor, { x: 0, z: 0 });
});

ok('double delegation while walking is rejected (no overlapping errands)', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'a', task: 't1', targetDesk: { x: 1, z: 1 }, now: 1 }).state;
  const r = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'b', task: 't2', targetDesk: { x: 2, z: 2 }, now: 2 });
  assert.equal(r.state.targetAgentId, 'a', 'first delegation must win');
  assert.equal(r.events[0].kind, 'failed');
});

ok('fail clears the walking state and preserves companion mode', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'a', task: 't', targetDesk: { x: 1, z: 1 }, now: 1 }).state;
  const r = reduceCompanion(st, { kind: 'mark-failed', reason: 'Route unreachable', now: 2 });
  assert.equal(r.state.action, 'failed');
  assert.equal(r.events[0].reason, 'Route unreachable');
  assert.equal(r.state.mode, 'follow');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
