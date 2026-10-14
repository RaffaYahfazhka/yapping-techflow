import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const {
  initialCompanionState, reduceCompanion, delegateWaypoint, validateDelegation,
} = await import('../src/lib/engine/delegationEngine');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

const DESK = { x: 13.5, z: -6.5 };
const step = (st, command) => reduceCompanion(st, command).state;

ok('initial state: follow mode, idle, at spawn', () => {
  const st = initialCompanionState({ x: -2.5, z: 2.6 });
  assert.equal(st.mode, 'follow');
  assert.equal(st.action, 'idle');
  assert.deepEqual(st.position, { x: -2.5, z: 2.6 });
  assert.equal(delegateWaypoint(st), null);
});

ok('validation rejects empty task and unknown target', () => {
  assert.ok(validateDelegation('altair-raditya', '   ', DESK));
  assert.ok(validateDelegation('nobody-here', 'Scrape', DESK));
  assert.ok(validateDelegation('altair-raditya', 'Scrape', { x: NaN, z: 0 }));
  assert.equal(validateDelegation('altair-raditya', 'Scrape', DESK), null);
});

ok('invalid order is rejected without leaving idle', () => {
  const st = initialCompanionState({ x: 0, z: 0 });
  const r = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'nobody-here', task: 'x', targetDesk: DESK, now: 1 });
  assert.equal(r.state.action, 'idle');
  assert.equal(r.events[0].kind, 'failed');
});

ok('full roundtrip: walk -> arrive -> deliver -> return to saved follow anchor', () => {
  let st = initialCompanionState({ x: 1, z: 1 });
  st = step(st, { kind: 'set-position', position: { x: 5, z: 5 } });
  const d = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'altair-raditya', task: 'Scrape pool', targetDesk: DESK, now: 1 });
  assert.equal(d.events[0].kind, 'delegated');
  st = d.state;
  assert.equal(st.action, 'walking');
  assert.deepEqual(delegateWaypoint(st), DESK);
  st = step(st, { kind: 'mark-arrived', now: 2 });
  assert.equal(st.action, 'delivering');
  assert.deepEqual(st.position, DESK);
  const delivered = reduceCompanion(st, { kind: 'mark-delivered', now: 3 });
  assert.equal(delivered.events[0].kind, 'delivered');
  st = delivered.state;
  assert.equal(st.action, 'returning');
  assert.deepEqual(delegateWaypoint(st), { x: 5, z: 5 }, 'walks back to saved anchor');
  const returned = reduceCompanion(st, { kind: 'mark-returned', now: 4 });
  assert.equal(returned.state.action, 'idle');
  assert.equal(returned.state.mode, 'follow');
  assert.deepEqual(returned.state.position, { x: 5, z: 5 });
  assert.equal(returned.events[0].kind, 'returned');
});

ok('stay mode is held through the errand and restored at the stay anchor', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = step(st, { kind: 'set-position', position: { x: 3, z: 4 } });
  st = step(st, { kind: 'set-mode', mode: 'stay', now: 0 });
  assert.deepEqual(st.stayAnchor, { x: 3, z: 4 });
  st = step(st, { kind: 'delegate', targetAgentId: 'kenzo-danendra', task: 'Check spread', targetDesk: { x: 13, z: 0 }, now: 1 });
  st = step(st, { kind: 'mark-arrived', now: 2 });
  st = step(st, { kind: 'mark-delivered', now: 3 });
  const back = reduceCompanion(st, { kind: 'mark-returned', now: 4 }).state;
  assert.equal(back.mode, 'stay', 'mode preserved');
  assert.deepEqual(back.position, { x: 3, z: 4 }, 'returns to stay anchor, not the delivery desk');
});

ok('mode change mid-errand is deferred and applied on return', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = step(st, { kind: 'delegate', targetAgentId: 'kenzo-danendra', task: 'Check', targetDesk: DESK, now: 1 });
  const mid = reduceCompanion(st, { kind: 'set-mode', mode: 'stay', now: 2 });
  assert.equal(mid.state.mode, 'follow', 'mode unchanged while errand runs');
  assert.equal(mid.state.deferredMode, 'stay');
  st = step(mid.state, { kind: 'mark-arrived', now: 3 });
  st = step(st, { kind: 'mark-delivered', now: 4 });
  const back = reduceCompanion(st, { kind: 'mark-returned', now: 5 });
  assert.equal(back.state.mode, 'stay');
  assert.ok(back.events.some((e) => e.kind === 'mode-change' && e.mode === 'stay'));
});

ok('overlapping delegation is rejected and the first errand wins', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = step(st, { kind: 'delegate', targetAgentId: 'altair-raditya', task: 't1', targetDesk: { x: 1, z: 1 }, now: 1 });
  const r = reduceCompanion(st, { kind: 'delegate', targetAgentId: 'altair-raditya', task: 't2', targetDesk: { x: 2, z: 2 }, now: 2 });
  assert.equal(r.state.targetAgentId, 'altair-raditya', 'first delegation must win');
  assert.equal(r.events[0].kind, 'failed');
});

ok('unreachable route fails, returns to saved mode/anchor, and is never stuck', () => {
  let st = initialCompanionState({ x: 0, z: 0 });
  st = step(st, { kind: 'set-mode', mode: 'stay', now: 0 });
  st = step(st, { kind: 'delegate', targetAgentId: 'altair-raditya', task: 't', targetDesk: DESK, now: 1 });
  const failed = reduceCompanion(st, { kind: 'mark-failed', reason: 'Route unreachable', now: 2 });
  assert.equal(failed.events[0].kind, 'failed');
  assert.equal(failed.events[0].reason, 'Route unreachable');
  assert.equal(failed.state.action, 'returning');
  const back = reduceCompanion(failed.state, { kind: 'mark-returned', now: 3 });
  assert.equal(back.state.action, 'idle');
  assert.equal(back.state.mode, 'stay');
  assert.deepEqual(back.state.position, { x: 0, z: 0 });
  assert.equal(back.state.lastFailure.reason, 'Route unreachable');
});

ok('invalid arrival/return/failed commands while idle are harmless', () => {
  const st = initialCompanionState({ x: 2, z: 3 });
  assert.equal(reduceCompanion(st, { kind: 'mark-arrived', now: 0 }).state, st);
  assert.equal(reduceCompanion(st, { kind: 'mark-delivered', now: 0 }).state, st);
  assert.equal(reduceCompanion(st, { kind: 'mark-returned', now: 0 }).state, st);
  assert.equal(reduceCompanion(st, { kind: 'mark-failed', reason: 'x', now: 0 }).state, st);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
