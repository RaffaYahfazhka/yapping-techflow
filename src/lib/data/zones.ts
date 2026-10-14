/**
 * Penthouse zone definitions — pure data shared by the R3F canvas and the DOM minimap.
 * No three.js import: safe for Node scripts and the minimap bundle.
 */

export interface ZoneDef {
  id: string;
  label: string;
  /** Top-down rect for minimap projection. */
  rect: { x1: number; z1: number; x2: number; z2: number };
  /** Camera focus point in the 3D world. */
  focus: [number, number, number];
}

export const ZONES: ZoneDef[] = [
  { id: 'executive', label: 'Executive Suite', rect: { x1: -16, z1: -12, x2: -2, z2: -4 }, focus: [-8, 0, -8] },
  { id: 'engineering', label: 'Engineering', rect: { x1: -16, z1: 0, x2: 6, z2: 12 }, focus: [-4, 0, 6] },
  { id: 'skyline', label: 'Skyline Suite', rect: { x1: 10, z1: -10, x2: 16, z2: 10 }, focus: [13.5, 0, 0] },
  { id: 'war-room', label: 'War Room', rect: { x1: 2, z1: -6, x2: 10, z2: 4 }, focus: [8, 0, 0] },
  { id: 'pantry', label: 'Pantry', rect: { x1: 8, z1: 6, x2: 14, z2: 12 }, focus: [11, 0, 9] },
  { id: 'terrace', label: 'Sky Terrace', rect: { x1: -4, z1: 20, x2: 16, z2: 30 }, focus: [6, 0, 24] },
];
