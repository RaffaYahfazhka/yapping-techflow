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
  { id: 'executive', label: 'Executive Suite', rect: { x1: -16, z1: -12, x2: -3, z2: -2 }, focus: [-8, 0, -6.5] },
  { id: 'war-room', label: 'War Room & Hologram', rect: { x1: 2, z1: -6, x2: 10, z2: 4 }, focus: [8, 0, 0] },
  { id: 'skyline', label: 'Skyline Quant Suite', rect: { x1: 10, z1: -12, x2: 16, z2: 6 }, focus: [13.5, 0, 0] },
  { id: 'engineering', label: 'Engineering Wing', rect: { x1: -16, z1: 2, x2: 5, z2: 12 }, focus: [-2.5, 0, 6.5] },
  { id: 'pantry', label: 'Espresso Lounge', rect: { x1: 7, z1: 6, x2: 16, z2: 12 }, focus: [11.5, 0, 9] },
  { id: 'terrace', label: 'Sky Terrace Rooftop', rect: { x1: -16, z1: 12, x2: 16, z2: 28 }, focus: [0, 0, 20] },
];

