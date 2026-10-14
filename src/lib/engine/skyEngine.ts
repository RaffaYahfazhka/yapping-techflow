/**
 * WIB (Asia/Jakarta) sky phase engine — pure functions, no React/Three deps.
 *
 * Phases (WIB, minutes since midnight):
 *   morning  05:30 (330)  – 09:30 (569.99)
 *   day      09:30 (570)  – 15:30 (929.99)
 *   sunset   15:30 (930)  – 18:15 (1094.99)
 *   night    18:15 (1095) – 05:29.99 (wrap 0..329.99)
 */

export type SkyPhase = 'morning' | 'day' | 'sunset' | 'night';

export const WIB_PHASE_BOUNDARIES = {
  morning: 330,
  day: 570,
  sunset: 930,
  night: 1095,
} as const;

export interface SkyPalette {
  /** Scene background / fog color for this phase. */
  background: string;
  /** Main directional light color. */
  keyColor: string;
  /** Key light intensity. */
  keyIntensity: number;
  /** Key light position XYZ (sun elevation/azimuth encoded). */
  keyPosition: [number, number, number];
  /** Ambient light color. */
  ambientColor: string;
  /** Ambient intensity. */
  ambientIntensity: number;
  /** City window glow emissive intensity (0 = daytime). */
  cityGlow: number;
  /** Penthouse neon strip intensity. */
  neonIntensity: number;
  /** Fog density. */
  fogDensity: number;
}

const PALETTES: Record<SkyPhase, SkyPalette> = {
  morning: {
    background: '#b8c9e8',
    keyColor: '#fed7aa',
    keyIntensity: 1.6,
    keyPosition: [-10, 6, 8],
    ambientColor: '#e8f0ff',
    ambientIntensity: 0.7,
    cityGlow: 0.15,
    neonIntensity: 0.2,
    fogDensity: 0.018,
  },
  day: {
    background: '#cfe8ff',
    keyColor: '#ffffff',
    keyIntensity: 2.0,
    keyPosition: [4, 20, 16],
    ambientColor: '#ffffff',
    ambientIntensity: 0.85,
    cityGlow: 0,
    neonIntensity: 0,
    fogDensity: 0.008,
  },
  sunset: {
    background: '#2b1a3e',
    keyColor: '#f97316',
    keyIntensity: 1.4,
    keyPosition: [14, 3, -8],
    ambientColor: '#c084fc',
    ambientIntensity: 0.55,
    cityGlow: 0.7,
    neonIntensity: 0.6,
    fogDensity: 0.012,
  },
  night: {
    background: '#0c0c0e',
    keyColor: '#93c5fd',
    keyIntensity: 0.7,
    keyPosition: [-8, 14, -12],
    ambientColor: '#334155',
    ambientIntensity: 0.45,
    cityGlow: 1.0,
    neonIntensity: 1.0,
    fogDensity: 0.015,
  },
};

/** Minutes since midnight in WIB computed via Intl.DateTimeFormat (not browser local). */
export function wibMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get('hour');
  const m = get('minute');
  const s = get('second');
  const total = h * 60 + m + s / 60;
  // Guard against Intl producing '24' hour for boundary; h23 prevents it but be safe
  return h === 24 ? total - 1440 : total;
}

export function phaseFromMinutes(m: number): SkyPhase {
  if (m < WIB_PHASE_BOUNDARIES.morning) return 'night';
  if (m < WIB_PHASE_BOUNDARIES.day) return 'morning';
  if (m < WIB_PHASE_BOUNDARIES.sunset) return 'day';
  if (m < WIB_PHASE_BOUNDARIES.night) return 'sunset';
  return 'night';
}

export function skyPaletteFor(phase: SkyPhase): SkyPalette {
  return PALETTES[phase];
}

export function clockWibString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
}