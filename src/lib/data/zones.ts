/**
 * Penthouse zone definitions — pure data shared by the R3F canvas and the DOM minimap.
 * No three.js import: safe for Node scripts and the minimap bundle.
 */

export interface ZoneDef {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  /** Top-down rect for minimap projection. */
  rect: { x1: number; z1: number; x2: number; z2: number };
  /** Camera focus point in the 3D world. */
  focus: [number, number, number];
  description?: string;
}

export const ZONES: ZoneDef[] = [
  {
    id: 'executive',
    label: 'Executive Suite',
    shortLabel: 'Executive',
    color: '#f43f5e',
    rect: { x1: -16, z1: -12, x2: -5.2, z2: -0.5 },
    focus: [-8, 0, -6.5],
    description: 'Meja Komando Bos Raffa & Royal Command Khansaku',
  },
  {
    id: 'engineering',
    label: 'Engineering Open Space',
    shortLabel: 'Engineering',
    color: '#38bdf8',
    rect: { x1: -5.2, z1: -12, x2: 5.5, z2: 11.8 },
    focus: [-2.5, 0, 3],
    description: 'Workstation 5 Senior Dev & QA (Arga, Jajang, Kian, Vani, Reno)',
  },
  {
    id: 'war-room',
    label: 'War Room Central Table',
    shortLabel: 'War Room',
    color: '#10b981',
    rect: { x1: 5.5, z1: -5, x2: 11.8, z2: 5 },
    focus: [9.5, 0, 0],
    description: 'Holotable Diskusi & Giant Wallboard Hologram',
  },
  {
    id: 'skyline',
    label: 'The Skyline Glass Room',
    shortLabel: 'Skyline Suite',
    color: '#8b5cf6',
    rect: { x1: 11.8, z1: -12, x2: 16, z2: 11.8 },
    focus: [13.5, 0, 0],
    description: 'Trading Bots & Quant Division (Altair, Kenzo, Damian)',
  },
  {
    id: 'pantry',
    label: 'Pantry Break Area',
    shortLabel: 'Pantry',
    color: '#f97316',
    rect: { x1: 5.5, z1: 5.5, x2: 11.8, z2: 11.8 },
    focus: [8.5, 0, 8.5],
    description: 'Espresso Bar, Water Dispenser, & Tempat Ghibah',
  },
  {
    id: 'terrace',
    label: 'The Penthouse Sky Terrace',
    shortLabel: 'Sky Terrace',
    color: '#f59e0b',
    rect: { x1: -16, z1: 12, x2: 16, z2: 28 },
    focus: [0, 0, 20],
    description: 'Rooftop Dek Kayu Teak, Sofa Lounge, Darts & Retro Arcade',
  },
];

/**
 * Determine which zone contains the coordinate (x, z).
 */
export function detectZone(x: number, z: number): ZoneDef {
  if (z >= 12) return ZONES[5]; // terrace
  if (x >= 11.8) return ZONES[3]; // skyline
  if (x >= 5.5 && z >= 5.5) return ZONES[4]; // pantry
  if (x >= 5.5 && z >= -5 && z < 5.5) return ZONES[2]; // war-room
  if (x < -5.2 && z < -0.5) return ZONES[0]; // executive
  return ZONES[1]; // engineering
}

