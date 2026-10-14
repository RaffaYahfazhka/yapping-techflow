import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { reduceWeather, INITIAL_WEATHER, rainIntensity, fogIntensity } = await import('../src/lib/engine/weatherEngine');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };
const live = { kind: 'fetch-success', condition: 'rain', fetchedAt: '2026-10-15T03:00:00Z', source: 'open-meteo' };

ok('initial is honest unavailable/clear with a labeled reason', () => {
  assert.equal(INITIAL_WEATHER.status, 'unavailable');
  assert.ok(INITIAL_WEATHER.reason.includes('Manual'));
});

ok('live fetch sets live status with the real condition', () => {
  const w = reduceWeather(INITIAL_WEATHER, live);
  assert.equal(w.status, 'live');
  assert.equal(w.condition, 'rain');
  assert.ok(fogIntensity(w) >= 0);
});

ok('fetch fail after a prior success is stale, keeping last condition and timestamp', () => {
  const w1 = reduceWeather(INITIAL_WEATHER, live);
  const w2 = reduceWeather(w1, { kind: 'fetch-fail', reason: 'provider 503' });
  assert.equal(w2.status, 'stale');
  assert.equal(w2.condition, 'rain');
  assert.equal(w2.fetchedAt, '2026-10-15T03:00:00Z');
  assert.equal(rainIntensity(w2), 1);
});

ok('fetch fail with no prior data is unavailable/clear (never invented)', () => {
  const w = reduceWeather(INITIAL_WEATHER, { kind: 'fetch-fail', reason: 'timeout' });
  assert.equal(w.status, 'unavailable');
  assert.equal(w.condition, 'clear');
  assert.equal(rainIntensity(w), 0);
  assert.ok(w.reason.includes('timeout'));
});

ok('manual override always wins and labels itself manual', () => {
  const w = reduceWeather(INITIAL_WEATHER, { kind: 'manual-set', condition: 'fog' });
  assert.equal(w.status, 'manual');
  assert.equal(w.condition, 'fog');
  assert.equal(fogIntensity(w), 1);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
