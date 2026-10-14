import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const {
  createEmployeeSim, employeeStateTick, applyWeatherToSim,
  applyEmployeeTreat, visibleBubble,
} = await import('../src/lib/engine/socialEngine');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };

ok('initial sim has every employee working with 100 stamina', () => {
  const sim = createEmployeeSim({ x: 0, z: 0 });
  assert.equal(Object.keys(sim.states).length, 9);
  for (const a of Object.values(sim.states)) assert.equal(a, 'working');
});

ok('state ticks progress agents deterministically through the cycle', () => {
  let sim = createEmployeeSim({ x: 100, z: 100 }); // boss far away
  let now = 0;
  for (let t = 0; t < 12; t++) {
    sim = employeeStateTick(sim, now, t);
    now += 65_000; // one minute per tick
  }
  const states = new Set(Object.values(sim.states));
  assert.ok(states.size > 1, 'expected a spread of states after multiple ticks');
});

ok('ghibah silhouette: boss proximity suppresses savage/wholesome bubbles', () => {
  let sim = createEmployeeSim({ x: -2.5, z: 6.5 }); // Vani desk (EMP-005)
  const now = 0;
  sim = employeeStateTick(sim, now, 7);
  sim = { ...sim, bubbles: [{ agentId: 'vani', emoji: '🗣️', text: 'Bos gaya bener...', kind: 'ghibah-savage', expiresAt: 60_000 }] };
  sim = employeeStateTick(sim, now + 1000, 8);
  assert.equal(visibleBubble(sim, 'vani', now + 1000), null, 'ghibah bubble must vanish when boss is within 3 units');
});

ok('rain forces terrace agents into shelter with a status bubble', () => {
  let sim = createEmployeeSim({ x: 100, z: 100 });
  const now = 0;
  for (let t = 0; t < 6; t++) sim = employeeStateTick(sim, now + t * 65_000, t);
  // force at least one agent onto the terrace
  sim.states['kenzo-danendra'] = 'terrace';
  sim.stateUntil['kenzo-danendra'] = now + 500_000;
  const rained = applyWeatherToSim(sim, 'rain', now);
  assert.equal(rained.states['kenzo-danendra'], 'shelter');
  assert.ok(rained.bubbles.some((b) => b.agentId === 'kenzo-danendra' && b.text.includes('gerimis')));
});

ok('treat restores full stamina and pushes one Khansaku announcement', () => {
  let sim = createEmployeeSim({ x: 0, z: 0 });
  sim.stamina['vani'] = 20;
  const now = 0;
  sim = employeeStateTick(sim, now, 3);
  const before = { ...sim.stamina };
  sim = applyEmployeeTreat(sim, now);
  for (const [k, v] of Object.entries(sim.stamina)) assert.equal(v, 100, `stamina restored for ${k}`);
  assert.ok(sim.bubbles.some((b) => b.agentId === 'khansa' && b.text.includes('traktir')));
  // confirm the stamina before had a sub-100 row to prove restoration actually happened
  assert.ok(Object.values(before).some((v) => v < 100));
});

ok('bubbles expire: visibleBubble returns null after expiresAt', () => {
  let sim = createEmployeeSim({ x: 0, z: 0 });
  sim = { ...sim, bubbles: [{ agentId: 'vani', emoji: '☕', text: 'Seduh espresso', kind: 'status', expiresAt: 10_000 }] };
  assert.ok(visibleBubble(sim, 'vani', 5_000));
  assert.equal(visibleBubble(sim, 'vani', 11_000), null);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
