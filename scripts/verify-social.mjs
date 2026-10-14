import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const {
  createEmployeeSim, employeeStateTick, employeeArrived, applyWeatherToSim,
  applyEmployeeTreat, visibleBubble, recordPositions, agentWaypoint, SOCIAL_ZONES, TARA_ID,
  MAX_BUBBLES, MAX_EVENTS,
} = await import('../src/lib/engine/socialEngine');
const { AGENTS } = await import('../src/lib/data/agents');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

const FAR = { x: 100, z: 100 };

// Advance the sim through its own deadlines, acknowledging every walk arrival like R3F would.
function drive(sim, startNow, seed, steps) {
  let now = startNow;
  let s = sim;
  const trace = [];
  for (let i = 0; i < steps; i++) {
    s = employeeStateTick(s, now, seed);
    trace.push(s.states.tara);
    const deadline = s.stateUntil.tara;
    now = Math.max(now + 1, deadline);
    if (s.states.tara === 'walking-pantry' || s.states.tara === 'walking-terrace' || s.states.tara === 'walking-back') {
      s = employeeArrived(s, 'tara', now, seed);
    }
  }
  return { sim: s, trace, now };
}

ok('initial sim: every employee working with full stamina, focus and no events', () => {
  const sim = createEmployeeSim({ x: 0, z: 0 });
  assert.equal(Object.keys(sim.states).length, AGENTS.length);
  for (const a of Object.values(sim.states)) assert.equal(a, 'working');
  for (const v of Object.values(sim.stamina)) assert.equal(v, 100);
  assert.deepEqual(sim.events, []);
});

ok('complete roundtrip: tara goes pantry -> back to working via arrivals, no stuck state', () => {
  const { trace } = drive(createEmployeeSim(FAR), 0, 0, 12);
  const seen = new Set(trace);
  assert.ok(seen.has('walking-pantry'), 'walks to pantry');
  assert.ok(seen.has('pantry'), 'arrives and idles in pantry');
  assert.ok(seen.has('walking-back'), 'walks back');
  const backIdx = trace.indexOf('walking-back');
  assert.ok(backIdx >= 0 && trace.slice(backIdx).includes('working'), 'returns to working after walking back');
});

ok('walk legs have deterministic deadlines derived from geometry, not random rolls', () => {
  const a = drive(createEmployeeSim(FAR), 0, 4, 10);
  const b = drive(createEmployeeSim(FAR), 0, 4, 10);
  assert.deepEqual(a.trace, b.trace);
  assert.deepEqual(a.sim.stateUntil, b.sim.stateUntil);
});

ok('live position drives the waypoint: walking agents head to pantry/terrace, not their desk', () => {
  let sim = createEmployeeSim(FAR);
  sim.states.tara = 'walking-pantry';
  sim.stateUntil.tara = 9_999_999;
  const tara = AGENTS.find((a) => a.id === 'tara');
  assert.deepEqual(agentWaypoint(sim, 'tara', tara.desk), SOCIAL_ZONES.pantry);
  sim.states.tara = 'working';
  assert.deepEqual(agentWaypoint(sim, 'tara', tara.desk), { x: tara.desk.x, z: tara.desk.z });
  sim = recordPositions(sim, { tara: { x: 11, z: 9 } });
  assert.deepEqual(sim.positions.tara, { x: 11, z: 9 });
});

ok('rain interruption: terrace agent is sheltered and stays sheltered while it rains', () => {
  let sim = createEmployeeSim(FAR);
  sim.states.tara = 'terrace';
  sim.stateUntil.tara = 500_000;
  const rained = applyWeatherToSim(sim, 'rain', 0);
  assert.equal(rained.states.tara, 'shelter');
  assert.ok(rained.bubbles.some((b) => b.agentId === 'tara' && b.text.includes('gerimis')));
  let s = rained;
  for (let now = 1_000; now < 600_000; now += 65_000) s = employeeStateTick(s, now, 2);
  assert.equal(s.states.tara, 'shelter', 'still sheltered while raining past its deadline');
  assert.ok(!Object.values(s.states).includes('terrace'), 'nobody on the terrace during rain');
  assert.ok(!Object.values(s.states).includes('walking-terrace'), 'nobody walking to terrace during rain');
});

ok('rain ends: sheltered agent walks back to work only after the weather clears', () => {
  let sim = createEmployeeSim(FAR);
  sim.states.tara = 'terrace';
  sim.stateUntil.tara = 0;
  sim = applyWeatherToSim(sim, 'rain', 0);
  sim = employeeStateTick(sim, 120_000, 1);
  assert.equal(sim.states.tara, 'shelter');
  sim = applyWeatherToSim(sim, 'clear', 130_000);
  sim = employeeStateTick(sim, 200_000, 1);
  assert.equal(sim.states.tara, 'working');
});

ok('boss proximity uses the live position, not the desk', () => {
  const vani = AGENTS.find((a) => a.id === 'vani');
  // Boss standing ON Vani's desk: a gossip bubble must be silenced.
  let sim = createEmployeeSim({ x: vani.desk.x, z: vani.desk.z });
  sim.states.vani = 'chatting';
  sim.stateUntil.vani = 500_000;
  sim.bubbles = [{ agentId: 'vani', emoji: '🗣️', text: 'Bos gaya bener...', kind: 'ghibah-savage', expiresAt: 600_000, state: 'chatting' }];
  const near = employeeStateTick(sim, 1_000, 8);
  assert.equal(visibleBubble(near, 'vani', 1_000), null, 'bubble silenced when boss is within range');
  assert.notEqual(near.states.vani, 'chatting', 'gossip ends when boss is close');

  // Vani has walked to the pantry, away from her desk, and Raffa is standing beside her live position.
  let away = createEmployeeSim({ x: 11, z: 9.5 });
  away = recordPositions(away, { vani: { x: 11, z: 9 } });
  away.states.vani = 'chatting';
  away.stateUntil.vani = 500_000;
  away.bubbles = [{ agentId: 'vani', emoji: '🗣️', text: 'Bos gaya bener...', kind: 'ghibah-savage', expiresAt: 600_000, state: 'chatting' }];
  const awayTick = employeeStateTick(away, 1_000, 8);
  assert.equal(visibleBubble(awayTick, 'vani', 1_000), null, 'proximity is judged at the live pantry position');

  // Same bubble with Raffa far away from her live position: it must survive.
  let far = createEmployeeSim(FAR);
  far = recordPositions(far, { vani: { x: 11, z: 9 } });
  far.states.vani = 'chatting';
  far.stateUntil.vani = 500_000;
  far.bubbles = [{ agentId: 'vani', emoji: '🗣️', text: 'Bos gaya bener...', kind: 'ghibah-savage', expiresAt: 600_000, state: 'chatting' }];
  const farTick = employeeStateTick(far, 1_000, 8);
  assert.ok(visibleBubble(farTick, 'vani', 1_000), 'bubble kept while boss is out of range');
});

ok('no contradictory bubbles: a bubble from a state the agent already left is dropped', () => {
  let sim = createEmployeeSim(FAR);
  sim.states.reno = 'working';
  sim.bubbles = [{ agentId: 'reno', emoji: '☕', text: 'Espresso', kind: 'status', expiresAt: 999_999, state: 'pantry' }];
  const next = employeeStateTick(sim, 1_000, 0);
  assert.equal(visibleBubble(next, 'reno', 1_000), null);
});

ok('treat restores stamina and focus for everyone and is attributed to canonical tara', () => {
  let sim = createEmployeeSim({ x: 0, z: 0 });
  sim.stamina.vani = 20;
  sim.focus.vani = 30;
  sim = applyEmployeeTreat(sim, 0, 'treat-1');
  for (const v of Object.values(sim.stamina)) assert.equal(v, 100);
  for (const v of Object.values(sim.focus)) assert.equal(v, 100);
  assert.equal(TARA_ID, 'tara');
  assert.equal(sim.events.at(-1).actor, TARA_ID);
  assert.equal(sim.events.at(-1).kind, 'treat');
  assert.ok(sim.bubbles.some((b) => b.agentId === TARA_ID && b.text.includes('traktir')));
});

ok('duplicate treat action ID is rejected: no second bubble, event or top-up', () => {
  const first = applyEmployeeTreat(createEmployeeSim({ x: 0, z: 0 }), 0, 'same');
  const replay = applyEmployeeTreat(first, 5_000, 'same');
  assert.equal(replay, first, 'replay returns the same sim reference');
  assert.equal(replay.events.filter((e) => e.kind === 'treat').length, 1);
  assert.equal(replay.bubbles.filter((b) => b.text.includes('traktir')).length, 1);
});

ok('events and bubbles stay bounded under repeated treats and rain', () => {
  let sim = createEmployeeSim(FAR);
  for (let i = 0; i < 60; i++) sim = applyEmployeeTreat(sim, i * 10, `t-${i}`);
  assert.ok(sim.events.length <= MAX_EVENTS, `events bounded (${sim.events.length})`);
  assert.ok(sim.bubbles.length <= MAX_BUBBLES, `bubbles bounded (${sim.bubbles.length})`);
  assert.ok(sim.treatActionIds.length <= 8, 'treat id memory bounded');
});

ok('bubbles expire: visibleBubble returns null after expiresAt', () => {
  let sim = createEmployeeSim({ x: 0, z: 0 });
  sim = { ...sim, bubbles: [{ agentId: 'vani', emoji: '☕', text: 'Seduh espresso', kind: 'status', expiresAt: 10_000 }] };
  assert.ok(visibleBubble(sim, 'vani', 5_000));
  assert.equal(visibleBubble(sim, 'vani', 11_000), null);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
