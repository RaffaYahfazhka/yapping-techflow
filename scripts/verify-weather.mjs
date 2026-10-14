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

ok('live fetch sets live status with the real condition and source', () => {
  const w = reduceWeather(INITIAL_WEATHER, live);
  assert.equal(w.status, 'live');
  assert.equal(w.condition, 'rain');
  assert.equal(w.source, 'open-meteo');
  assert.equal(rainIntensity(w), 1);
  assert.ok(fogIntensity(w) >= 0);
});

ok('success -> start -> fail keeps last-known condition, source and timestamp', () => {
  const w1 = reduceWeather(INITIAL_WEATHER, live);
  const started = reduceWeather(w1, { kind: 'fetch-start' });
  assert.equal(started.status, 'loading');
  assert.equal(started.condition, 'rain');
  assert.equal(started.fetchedAt, '2026-10-15T03:00:00Z');
  const failed = reduceWeather(started, { kind: 'fetch-fail', reason: 'provider 503' });
  assert.equal(failed.status, 'stale');
  assert.equal(failed.condition, 'rain');
  assert.equal(failed.source, 'open-meteo');
  assert.equal(failed.fetchedAt, '2026-10-15T03:00:00Z');
  assert.equal(failed.reason, 'provider 503');
  assert.equal(rainIntensity(failed), 1);
});

ok('repeated fail keeps the same last-known metadata', () => {
  let w = reduceWeather(INITIAL_WEATHER, live);
  for (let i = 0; i < 4; i++) {
    w = reduceWeather(reduceWeather(w, { kind: 'fetch-start' }), { kind: 'fetch-fail', reason: `timeout ${i}` });
  }
  assert.equal(w.status, 'stale');
  assert.equal(w.condition, 'rain');
  assert.equal(w.fetchedAt, '2026-10-15T03:00:00Z');
  assert.equal(w.source, 'open-meteo');
  assert.equal(w.reason, 'timeout 3');
});

ok('fetch fail with no prior data is unavailable/clear (never invented)', () => {
  const w = reduceWeather(INITIAL_WEATHER, { kind: 'fetch-fail', reason: 'timeout' });
  assert.equal(w.status, 'unavailable');
  assert.equal(w.condition, 'clear');
  assert.equal(rainIntensity(w), 0);
  assert.ok(w.reason.includes('timeout'));
});

ok('manual override wins and is not silently overwritten by in-flight live results', () => {
  let w = reduceWeather(INITIAL_WEATHER, { kind: 'manual-set', condition: 'fog' });
  assert.equal(w.status, 'manual');
  assert.equal(w.condition, 'fog');
  assert.equal(fogIntensity(w), 1);
  w = reduceWeather(w, live);
  assert.equal(w.status, 'manual', 'live success must not replace manual');
  assert.equal(w.condition, 'fog');
  w = reduceWeather(w, { kind: 'fetch-fail', reason: 'down' });
  assert.equal(w.condition, 'fog', 'failure must not replace manual');
  assert.equal(w.status, 'manual');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
