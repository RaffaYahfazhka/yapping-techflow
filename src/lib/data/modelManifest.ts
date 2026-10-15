export type ModelCategory = 'character' | 'architecture' | 'prop';

export interface ModelManifestEntry {
  id: string;
  category: ModelCategory;
  name: string;
  path: string;
  scale: [number, number, number];
  boundingBox: [number, number, number];
  fallbackAriaLabel: string;
}

export const MODEL_MANIFEST: Record<string, ModelManifestEntry> = {
  // Characters
  raffa: {
    id: 'raffa',
    category: 'character',
    name: 'Bos Raffa',
    path: '/models/characters/raffa.glb',
    scale: [1, 1, 1],
    boundingBox: [0.6, 1.8, 0.4],
    fallbackAriaLabel: 'Karakter 3D Bos Raffa',
  },
  khansaku: {
    id: 'khansaku',
    category: 'character',
    name: 'Khansaku',
    path: '/models/characters/khansaku.glb',
    scale: [1, 1, 1],
    boundingBox: [0.5, 1.65, 0.35],
    fallbackAriaLabel: 'Karakter 3D Khansaku Companion',
  },
  arga: {
    id: 'arga',
    category: 'character',
    name: 'Arga',
    path: '/models/characters/arga.glb',
    scale: [1, 1, 1],
    boundingBox: [0.55, 1.75, 0.4],
    fallbackAriaLabel: 'Karakter 3D Arga (Tech Lead)',
  },
  vani: {
    id: 'vani',
    category: 'character',
    name: 'Vani Aryasetya',
    path: '/models/characters/vani.glb',
    scale: [1, 1, 1],
    boundingBox: [0.55, 1.72, 0.4],
    fallbackAriaLabel: 'Karakter 3D Vani Aryasetya (QA Engineer)',
  },
  tara: {
    id: 'tara',
    category: 'character',
    name: 'Tara',
    path: '/models/characters/tara.glb',
    scale: [1, 1, 1],
    boundingBox: [0.5, 1.62, 0.35],
    fallbackAriaLabel: 'Karakter 3D Tara (Operations & Treats)',
  },
  reno: {
    id: 'reno',
    category: 'character',
    name: 'Reno',
    path: '/models/characters/reno.glb',
    scale: [1, 1, 1],
    boundingBox: [0.58, 1.78, 0.42],
    fallbackAriaLabel: 'Karakter 3D Reno (DevOps)',
  },
  kian: {
    id: 'kian',
    category: 'character',
    name: 'Kian',
    path: '/models/characters/kian.glb',
    scale: [1, 1, 1],
    boundingBox: [0.55, 1.74, 0.4],
    fallbackAriaLabel: 'Karakter 3D Kian (Backend Architect)',
  },
  jajang: {
    id: 'jajang',
    category: 'character',
    name: 'Jajang',
    path: '/models/characters/jajang.glb',
    scale: [1, 1, 1],
    boundingBox: [0.55, 1.7, 0.38],
    fallbackAriaLabel: 'Karakter 3D Jajang (Frontend Specialist)',
  },
  altair: {
    id: 'altair',
    category: 'character',
    name: 'Altair Raditya',
    path: '/models/characters/altair.glb',
    scale: [1, 1, 1],
    boundingBox: [0.56, 1.76, 0.4],
    fallbackAriaLabel: 'Karakter 3D Altair Raditya (Meteora Quant)',
  },
  kenzo: {
    id: 'kenzo',
    category: 'character',
    name: 'Kenzo Danendra',
    path: '/models/characters/kenzo.glb',
    scale: [1, 1, 1],
    boundingBox: [0.55, 1.73, 0.4],
    fallbackAriaLabel: 'Karakter 3D Kenzo Danendra (Prediction Bot)',
  },
  damian: {
    id: 'damian',
    category: 'character',
    name: 'Damian Prasetya',
    path: '/models/characters/damian.glb',
    scale: [1, 1, 1],
    boundingBox: [0.57, 1.77, 0.4],
    fallbackAriaLabel: 'Karakter 3D Damian Prasetya (XAUUSD EA)',
  },

  // Architecture
  penthouse_structure: {
    id: 'penthouse_structure',
    category: 'architecture',
    name: 'Penthouse Office Structure',
    path: '/models/architecture/penthouse_structure.glb',
    scale: [1, 1, 1],
    boundingBox: [28, 4, 32],
    fallbackAriaLabel: 'Struktur Arsitektur Penthouse Office',
  },
  rooftop_terrace: {
    id: 'rooftop_terrace',
    category: 'architecture',
    name: 'Rooftop Terrace Zone',
    path: '/models/architecture/rooftop_terrace.glb',
    scale: [1, 1, 1],
    boundingBox: [16, 1, 14],
    fallbackAriaLabel: 'Zona Rooftop Terrace Penthouse',
  },
  skyline_windows: {
    id: 'skyline_windows',
    category: 'architecture',
    name: 'Skyline Windows View',
    path: '/models/architecture/skyline_windows.glb',
    scale: [1, 1, 1],
    boundingBox: [24, 3.5, 0.1],
    fallbackAriaLabel: 'Jendela Kaca Skyline Panorama Jakarta',
  },

  // Props & Furniture
  desk_workstation: {
    id: 'desk_workstation',
    category: 'prop',
    name: 'Workstation Desk & Setup',
    path: '/models/props/desk_workstation.glb',
    scale: [1, 1, 1],
    boundingBox: [1.8, 0.75, 0.9],
    fallbackAriaLabel: 'Meja Kerja Engineering Workstation',
  },
  boss_executive_desk: {
    id: 'boss_executive_desk',
    category: 'prop',
    name: 'Executive Boss Desk',
    path: '/models/props/boss_executive_desk.glb',
    scale: [1, 1, 1],
    boundingBox: [2.4, 0.8, 1.2],
    fallbackAriaLabel: 'Meja Eksekutif Bos Raffa',
  },
  pantry_coffee_bar: {
    id: 'pantry_coffee_bar',
    category: 'prop',
    name: 'Pantry Coffee Bar',
    path: '/models/props/pantry_coffee_bar.glb',
    scale: [1, 1, 1],
    boundingBox: [3.5, 1.0, 1.2],
    fallbackAriaLabel: 'Bar Kopi & Croissant Pantry',
  },
  terrace_lounge: {
    id: 'terrace_lounge',
    category: 'prop',
    name: 'Terrace Lounge Sofa',
    path: '/models/props/terrace_lounge.glb',
    scale: [1, 1, 1],
    boundingBox: [3.0, 0.65, 1.5],
    fallbackAriaLabel: 'Sofa Santai Rooftop Terrace',
  },
  wallboard_frame: {
    id: 'wallboard_frame',
    category: 'prop',
    name: 'Wallboard Hologram Frame',
    path: '/models/props/wallboard_frame.glb',
    scale: [1, 1, 1],
    boundingBox: [4.5, 2.5, 0.15],
    fallbackAriaLabel: 'Bingkai Wallboard Finansial Hologram',
  },
  arcade_cabinet: {
    id: 'arcade_cabinet',
    category: 'prop',
    name: 'Retro Arcade Cabinet',
    path: '/models/props/arcade_cabinet.glb',
    scale: [1, 1, 1],
    boundingBox: [0.8, 1.8, 0.9],
    fallbackAriaLabel: 'Mesin Retro Arcade Gaming',
  },
  dart_board: {
    id: 'dart_board',
    category: 'prop',
    name: 'Sky Darts Target Board',
    path: '/models/props/dart_board.glb',
    scale: [1, 1, 1],
    boundingBox: [0.6, 0.6, 0.08],
    fallbackAriaLabel: 'Papan Sasaran Sky Darts',
  },
};

export function getModelManifestEntry(id: string): ModelManifestEntry | null {
  return MODEL_MANIFEST[id] ?? null;
}

export function getModelEntriesByCategory(category: ModelCategory): ModelManifestEntry[] {
  return Object.values(MODEL_MANIFEST).filter((entry) => entry.category === category);
}
