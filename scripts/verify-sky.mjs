import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);
const { phaseFromMinutes, wibMinutesNow, skyPaletteFor, WIB_PHASE_BOUNDARIES, clockWibString } = await import('../src/lib/engine/skyEngine');

let passed = 0;
const ok = (n, f) => { f(); passed += 1; console.log(`✓ ${n}`); };
const at = (h, m) => { const d = new Date('2026-10-14T00:00:00Z'); d.setTime(d.getTime() + (h*60+m)*60000 - 7*3600000); return d; };
// at(h,m) constructs a UTC time that is h:m WIB (WIB = UTC+7, no DST)

ok('phase boundaries: exactly at 05:30/09:30/15:30/18:15 WIB map correctly', () => {
  assert.equal(phaseFromMinutes(330), 'morning');           // 05:30
  assert.equal(phaseFromMinutes(329.99), 'night');
  assert.equal(phaseFromMinutes(570), 'day');               // 09:30
  assert.equal(phaseFromMinutes(930), 'sunset');            // 15:30
  assert.equal(phaseFromMinutes(1095), 'night');            // 18:15
  assert.equal(phaseFromMinutes(1094.99), 'sunset');
  assert.equal(phaseFromMinutes(60), 'night');              // 01:00
  assert.equal(phaseFromMinutes(1440 - 0.01), 'night');
});

ok('wibMinutesNow reads Asia/Jakarta regardless of host timezone', () => {
  // 2026-10-14T00:00:00Z is 07:00 WIB
  const d = new Date('2026-10-14T00:00:00Z');
  const m = wibMinutesNow(d);
  assert.equal(m, 7 * 60);
});

ok('palettes differ per phase and night has max city glow', () => {
  const morning = skyPaletteFor('morning'), night = skyPaletteFor('night'), day = skyPaletteFor('day');
  assert.ok(night.cityGlow > day.cityGlow);
  assert.ok(night.neonIntensity > day.neonIntensity);
  assert.notEqual(morning.background, night.background);
});

ok('clock string formats in WIB (id-ID, h23)', () => {
  const d = new Date('2026-10-14T00:30:15Z'); // 07:30:15 WIB
  const s = clockWibString(d);
  assert.match(s, /07\.30\.15|07:30:15/);
});

console.log(`\nResults: ${passed} passed, 0 failed`);
