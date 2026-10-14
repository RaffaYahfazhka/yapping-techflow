/**
 * Konstanta engine. Murni angka (tanpa import three) supaya bisa dites di Node.
 */

/** Offset kamera isometrik dari titik fokus. */
export const CAMERA_OFFSET = { x: 18, y: 20, z: 18 };

/**
 * Yaw (heading) kamera = Math.atan2(18, 18) = Math.PI / 4 (45°).
 * Catatan: jangan baca dari camera.rotation.y — untuk kamera miring hasil lookAt,
 * Euler XYZ memberi ~33.8°, bukan 45°. Heading harus dihitung dari offset.
 */
export const CAMERA_YAW = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);

/** Tinggi area yang terlihat (world units) pada zoom 1 untuk OrthographicCamera. */
export const VIEW_SIZE = 26;

export const ROOM = { minX: -16, maxX: 16, minZ: -12, maxZ: 28, wallH: 4.4, terraceZ: 12 };

export const PLAYER = { radius: 0.36, speed: 4.4, sprint: 1.75 };

export const PALETTE = {
  floor: '#171920', // Luxury dark graphite interior penthouse floor
  floorTerrace: '#714424', // Warm teak wood rooftop terrace deck
  slab: '#0e0f12',
  wall: '#1e212b',
  wallTrim: '#343846',
  glass: '#a5f3fc',
  desk: '#2d313d',
  deskLeg: '#16171d',
  chair: '#1f2129',
  wood: '#96633b',
  emerald: '#10b981',
  violet: '#8b5cf6',
  gold: '#f59e0b',
  rose: '#f43f5e',
};

