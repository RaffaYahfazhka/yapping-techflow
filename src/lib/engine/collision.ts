import { ROOM } from './constants';
import { AGENTS } from '../data/agents';

/**
 * Obstacle definitions and 2D collision resolution for Kantor Raffa.
 * Ensures the character cannot walk through desks, chairs, holotable, plants, or walls.
 */

// 1. Desk + Chair Obstacle Bounding Boxes (AABB)
export const DESK_OBSTACLES = AGENTS.map((agent) => {
  // Desk size: W=2.4, D=1.3, Chair offset Z=+0.65 (when rot=0) or -0.65 (when rot=PI)
  const isRotated = Math.abs(agent.desk.rot - Math.PI) < 0.1;
  const halfW = 1.35; // slightly padded for comfortable feel
  const minZ = isRotated ? agent.desk.z - 1.4 : agent.desk.z - 0.75;
  const maxZ = isRotated ? agent.desk.z + 0.75 : agent.desk.z + 1.4;

  return {
    id: `desk_${agent.id}`,
    name: `${agent.name}'s Workstation`,
    minX: agent.desk.x - halfW,
    maxX: agent.desk.x + halfW,
    minZ: minZ,
    maxZ: maxZ,
  };
});

// 2. War-Room Holographic Table (Circle)
export const HOLOTABLE_OBSTACLE = {
  id: 'holotable',
  name: 'Holographic Planning Table',
  x: 8.5,
  z: 0.0,
  radius: 1.9,
};

// 3. Indoor Potted Plants (Circles)
export const PLANT_OBSTACLES = [
  { id: 'plant_nw', x: -14.5, z: -10.5, radius: 0.75 },
  { id: 'plant_ne', x: 14.5, z: -10.5, radius: 0.75 },
  { id: 'plant_sw', x: -14.5, z: 10.5, radius: 0.75 },
  { id: 'plant_se', x: 14.5, z: 10.5, radius: 0.75 },
  { id: 'plant_mid_n', x: -0.5, z: -10.8, radius: 0.75 },
  { id: 'plant_terrace_w', x: -14.5, z: 14.0, radius: 0.75 },
  { id: 'plant_terrace_e', x: 14.5, z: 14.0, radius: 0.75 },
];

// 4. Penthouse Acoustic Glass Partitions & Terrace Features
export const PENTHOUSE_OBSTACLES = [
  // Glass partition West of sliding door (opening is x: -3.2 to 3.2)
  { id: 'glass_wall_w', minX: -16.0, maxX: -3.2, minZ: 11.75, maxZ: 12.25 },
  // Glass partition East of sliding door
  { id: 'glass_wall_e', minX: 3.2, maxX: 16.0, minZ: 11.75, maxZ: 12.25 },
  // Skyline Suite Acoustic Glass Walls (Doorway at z: -1.5 to 1.5)
  { id: 'skyline_wall_n', minX: 11.35, maxX: 11.65, minZ: -12.0, maxZ: -1.5 },
  { id: 'skyline_wall_s', minX: 11.35, maxX: 11.65, minZ: 1.5, maxZ: 11.8 },
  // Pantry Espresso & Island Bar
  { id: 'pantry_bar', minX: 6.8, maxX: 10.2, minZ: 7.8, maxZ: 9.2 },
  // Terrace Outdoor L-Sofa Lounge
  { id: 'terrace_sofa', minX: -11.5, maxX: -6.5, minZ: 16.5, maxZ: 20.5 },
  // Retro Arcade Machine
  { id: 'terrace_arcade', minX: 8.2, maxX: 10.8, minZ: 16.5, maxZ: 18.5 },
  // Sky Darts Stand
  { id: 'terrace_darts', minX: 10.5, maxX: 13.5, minZ: 21.5, maxZ: 24.5 },
];

export const TELESCOPE_OBSTACLE = {
  id: 'terrace_telescope',
  x: -12.5,
  z: 25.0,
  radius: 0.9,
};

/**
 * Test whether point (x, z) with given player radius collides with any obstacle or room wall.
 */
export function isColliding(x, z, playerRadius = 0.38) {
  // A. Room boundaries (Outer Penthouse Balustrade & Walls)
  const margin = playerRadius + 0.3;
  if (
    x < ROOM.minX + margin ||
    x > ROOM.maxX - margin ||
    z < ROOM.minZ + margin ||
    z > ROOM.maxZ - margin
  ) {
    return true;
  }

  // B. Workstation desks (AABB vs Circle)
  for (const box of DESK_OBSTACLES) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < playerRadius * playerRadius) {
      return true;
    }
  }

  // C. Penthouse Partitions & Terrace AABBs
  for (const box of PENTHOUSE_OBSTACLES) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < playerRadius * playerRadius) {
      return true;
    }
  }

  // D. War-Room Holotable (Circle vs Circle)
  const hdx = x - HOLOTABLE_OBSTACLE.x;
  const hdz = z - HOLOTABLE_OBSTACLE.z;
  const minHoloDist = playerRadius + HOLOTABLE_OBSTACLE.radius;
  if (hdx * hdx + hdz * hdz < minHoloDist * minHoloDist) {
    return true;
  }

  // E. Plants (Circle vs Circle)
  for (const plant of PLANT_OBSTACLES) {
    const pdx = x - plant.x;
    const pdz = z - plant.z;
    const minPlantDist = playerRadius + plant.radius;
    if (pdx * pdx + pdz * pdz < minPlantDist * minPlantDist) {
      return true;
    }
  }

  // F. Observation Telescope
  const tdx = x - TELESCOPE_OBSTACLE.x;
  const tdz = z - TELESCOPE_OBSTACLE.z;
  const minTeleDist = playerRadius + TELESCOPE_OBSTACLE.radius;
  if (tdx * tdx + tdz * tdz < minTeleDist * minTeleDist) {
    return true;
  }

  return false;
}


/**
 * Resolves movement from current (currX, currZ) to desired (nextX, nextZ).
 * Supports obstacle wall-sliding so player moves smoothly along edges rather than halting.
 */
export function resolveMovement(currX, currZ, nextX, nextZ, playerRadius = 0.38) {
  // 1. If direct target is free of obstacles, accept full movement
  if (!isColliding(nextX, nextZ, playerRadius)) {
    return { x: nextX, z: nextZ };
  }

  // 2. Try sliding along X only
  if (!isColliding(nextX, currZ, playerRadius)) {
    return { x: nextX, z: currZ };
  }

  // 3. Try sliding along Z only
  if (!isColliding(currX, nextZ, playerRadius)) {
    return { x: currX, z: nextZ };
  }

  // 4. Fully blocked in both directions: stay at current position
  return { x: currX, z: currZ };
}
