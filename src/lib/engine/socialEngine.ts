/**
 * Social simulation engine — pure state machine for employees.
 * Phases: work -> walk-pantry -> pantry -> walk-terrace -> terrace -> chat -> walk-back -> work
 * Rain overrules terrace states to shelter-in-office.
 * Raffa within 3 units silences gossip; cooldown prevents flicker.
 */

import { AGENTS } from '../data/agents';



export type EmployeeState =
  | 'working'
  | 'walking-pantry'
  | 'pantry'
  | 'walking-terrace'
  | 'terrace'
  | 'chatting'
  | 'walking-back'
  | 'shelter';

export type WeatherCondition = 'clear' | 'fog' | 'rain' | 'unavailable';

export interface SpeechBubble {
  agentId: string;
  emoji: string;
  text: string;
  kind: 'status' | 'ghibah-whole' | 'ghibah-savage';
  expiresAt: number;
}

export interface OfficeEvent {
  id: string;
  at: number;
  actor: string;
  kind: 'status' | 'ghibah' | 'treat' | 'delegation';
  text: string;
}

export interface EmployeeSim {
  states: Record<string, EmployeeState>;
  stateUntil: Record<string, number>;
  stamina: Record<string, number>;
  bubbles: SpeechBubble[];
  /** Raffa position for proximity suppression. */
  boss: { x: number; z: number };
}

const DISTANCES: Record<EmployeeState, number> = {
  working: 0,
  'walking-pantry': 1,
  pantry: 1,
  'walking-terrace': 1,
  terrace: 1,
  chatting: 1,
  'walking-back': 1,
  shelter: 0,
};

const PANTRY_QUOTE = [
  { emoji: '☕', text: 'Lagi seduh Americano double shot...' },
  { emoji: '☕', text: 'Espresso dulu biar gak halu liat chart...' },
  { emoji: '💧', text: 'Refill tumbler air putih dingin...' },
];

const TERRACE_QUOTE = [
  { emoji: '🌿', text: 'Napas dulu di balkon, view kota jam segini emang gak ada obat...' },
  { emoji: '🌆', text: 'Sunset-nya gila sih hari ini, adem banget teras penthouse...' },
];

const GHIBAH_WHOLESOME = [
  'Mas Bos Raffa visionernya gila sih, arsitektur Next.js sama R3F-nya rapi banget.',
  'Untung bosnya Mas Raffa, santai tapi kalau eksekusi sat-set langsung kelar.',
  'Khansaku beruntung banget ya dapet Mas Bos, pasangan idaman se-SCBD.',
];

const GHIBAH_SAVAGE = [
  'Bos mondar-mandir doang dari tadi pake WASD, tiket bug Jira malah gue yang lemburin...',
  'Gaya doang jalan-jalan sama Khansaku, suruh deploy prod jam 5 sore tangannya gemeteran.',
  'Pagi minta ganti arsitektur, sore nanya kenapa belum kelar. Klasik banget kelakuan Mas Bos.',
];

export function createEmployeeSim(bossSpawn: { x: number; z: number }): EmployeeSim {
  const states: Record<string, EmployeeState> = {};
  const stamina: Record<string, number> = {};
  for (const a of AGENTS) {
    states[a.id] = 'working';
    stamina[a.id] = 100;
  }
  return { states, stateUntil: {}, stamina, bubbles: [], boss: bossSpawn };
}

export function employeeStateTick(
  sim: EmployeeSim,
  now: number,
  seedCounter: number,
): EmployeeSim {
  const next: EmployeeSim = { ...sim, states: { ...sim.states }, stateUntil: { ...sim.stateUntil }, bubbles: sim.bubbles.filter((b) => b.expiresAt > now) };
  AGENTS.forEach((a, index) => {
    const current = next.states[a.id];
    const until = next.stateUntil[a.id] ?? 0;
    const isPast = now >= until;
    if (DISTANCES[current] === 0 && isPast) {
      // leave desk: deterministic rotation by index and counter
      const roll = (seedCounter + index) % 6;
      if (roll === 0 || roll === 1) {
        next.states[a.id] = 'walking-pantry';
      } else if (roll === 2) {
        next.states[a.id] = 'walking-terrace';
      } else {
        next.states[a.id] = 'working';
        next.stateUntil[a.id] = now + 60_000;
      }
    } else if (DISTANCES[current] === 1 && isPast) {
      if (current === 'walking-pantry') {
        next.states[a.id] = 'pantry';
        next.stateUntil[a.id] = now + 90_000;
        const q = PANTRY_QUOTE[(seedCounter + index) % PANTRY_QUOTE.length];
        next.bubbles = [...next.bubbles, { agentId: a.id, emoji: q.emoji, text: q.text, kind: 'status', expiresAt: now + 60_000 }];
      } else if (current === 'walking-terrace') {
        next.states[a.id] = 'terrace';
        next.stateUntil[a.id] = now + 90_000;
        const q = TERRACE_QUOTE[(index + seedCounter) % TERRACE_QUOTE.length];
        next.bubbles = [...next.bubbles, { agentId: a.id, emoji: q.emoji, text: q.text, kind: 'status', expiresAt: now + 60_000 }];
      } else {
        // after pantry/terrace
        const ghibahRoll = (seedCounter * 7 + index * 3) % 4;
        if (ghibahRoll === 0) {
          const savage = (index + seedCounter) % 2 === 0;
          const pool = savage ? GHIBAH_SAVAGE : GHIBAH_WHOLESOME;
          const line = pool[(seedCounter + index) % pool.length];
          next.bubbles = [...next.bubbles, { agentId: a.id, emoji: '🗣️', text: line, kind: savage ? 'ghibah-savage' : 'ghibah-whole', expiresAt: now + 70_000 }];
          next.states[a.id] = 'chatting';
        } else {
          next.states[a.id] = 'walking-back';
        }
        next.stateUntil[a.id] = now + 40_000;
      }
    } else if (current === 'chatting' && isPast) {
      next.states[a.id] = 'walking-back';
      next.stateUntil[a.id] = now + 30_000;
    } else if (current === 'walking-back' && isPast) {
      next.states[a.id] = 'working';
      next.stateUntil[a.id] = now + 60_000;
    }
  });

  // Proximity: ghibah speakers fall silent when Raffa is within 3 units
  for (const a of AGENTS) {
    const deskAgent = a;
    const dist = Math.hypot(deskAgent.desk.x - next.boss.x, deskAgent.desk.z - next.boss.z);
    const bubble = next.bubbles.find((b) => b.agentId === a.id && (b.kind === 'ghibah-savage' || b.kind === 'ghibah-whole'));
    if (bubble && dist < 3) {
      next.bubbles = next.bubbles.filter((b) => b !== bubble);
      next.states[a.id] = 'working';
      next.stateUntil[a.id] = now + 45_000; // cooldown before resuming
    }
  }

  // Rain overrules terrace activities to shelter
  return next;
}

export function applyWeatherToSim(sim: EmployeeSim, condition: WeatherCondition, now: number): EmployeeSim {
  if (condition !== 'rain') return sim;
  const next = { ...sim, states: { ...sim.states }, stateUntil: { ...sim.stateUntil } };
  for (const a of AGENTS) {
    if (next.states[a.id] === 'terrace' || next.states[a.id] === 'walking-terrace') {
      next.states[a.id] = 'shelter';
      next.stateUntil[a.id] = now + 60_000;
      next.bubbles = [...(next.bubbles ?? []), { agentId: a.id, emoji: '🌧️', text: 'Waduh gerimis, masuk dulu ngopi di dalem!', kind: 'status', expiresAt: now + 50_000 }];
    }
  }
  return next;
}

export function applyEmployeeTreat(sim: EmployeeSim, now: number): EmployeeSim {
  const next = { ...sim, stamina: { ...sim.stamina }, bubbles: [...sim.bubbles] };
  for (const a of AGENTS) {
    next.stamina[a.id] = 100;
  }
  next.bubbles.push({ agentId: 'khansa', emoji: '🎉', text: 'Mas Bos Raffa yang ganteng traktir Kopi Kenangan & Croissant untuk kita semua!', kind: 'status', expiresAt: now + 70_000 });
  return next;
}

export function visibleBubble(sim: EmployeeSim, agentId: string, now: number): SpeechBubble | null {
  return sim.bubbles.find((b) => b.agentId === agentId && b.expiresAt > now) ?? null;
}

export function zoneForAgent<T extends { rect: { x1: number; z1: number; x2: number; z2: number } }>(
  agent: { desk: { x: number; z: number } },
  zones: readonly T[],
): T {
  return zones.find((s) => agent.desk.x >= s.rect.x1 && agent.desk.x <= s.rect.x2 && agent.desk.z >= s.rect.z1 && agent.desk.z <= s.rect.z2) ?? zones[0];
}