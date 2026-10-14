/**
 * Verifikasi gerakan screen-relative: proyeksikan arah W/A/S/D ke layar
 * memakai kamera isometrik three.js yang sama dengan runtime.
 *   yarn test:movement
 */
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

import * as THREE from 'three';
const { CAMERA_OFFSET } = await import('../src/lib/engine/constants.ts');
const { screenToWorld, facingFromDirection } = await import('../src/lib/engine/movement.ts');
const cam = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 200);
cam.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

const toScreen = (x, z) => {
  const v = new THREE.Vector3(x, 0, z).project(cam);
  return { sx: v.x, sy: -v.y }; // sy positif = ke bawah layar
};

const cases = [
  ['W', 0, -1, (d) => d.sy < -0.01 && Math.abs(d.sx) < 1e-6],
  ['S', 0, 1, (d) => d.sy > 0.01 && Math.abs(d.sx) < 1e-6],
  ['A', -1, 0, (d) => d.sx < -0.01 && Math.abs(d.sy) < 1e-6],
  ['D', 1, 0, (d) => d.sx > 0.01 && Math.abs(d.sy) < 1e-6],
];

let failed = 0;
const o = toScreen(0, 0);
for (const [key, mx, mz, ok] of cases) {
  const w = screenToWorld(mx, mz);
  const p = toScreen(w.x, w.z);
  const d = { sx: p.sx - o.sx, sy: p.sy - o.sy };
  const pass = ok(d);
  if (!pass) failed++;
  const yaw = ((facingFromDirection(w.x, w.z) * 180) / Math.PI).toFixed(0);
  console.log(
    `${pass ? '✓' : '✗'} ${key}: world(${w.x.toFixed(3)}, ${w.z.toFixed(3)})  screenΔ(${d.sx.toFixed(3)}, ${d.sy.toFixed(3)})  facing ${yaw}°`,
  );
}
console.log(`camera rotation.y = ${((cam.rotation.y * 180) / Math.PI).toFixed(1)}°`);
if (failed) {
  console.error(`\n${failed} arah gagal — gerakan ter-invert!`);
  process.exit(1);
}
console.log('\nSemua arah WASD sesuai layar ✔');
