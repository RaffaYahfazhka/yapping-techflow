/**
 * Social simulation engine — pure state machine for employees.
 *
 * Roundtrip (every state has a reachable exit back to `working`):
 *   working -> walking-pantry -> pantry -> (chatting ->) walking-back -> working
 *           -> walking-terrace -> terrace -> (chatting ->) walking-back -> working
 *   shelter -> working (only once the rain has stopped)
 *
 * Contract for the R3F layer:
 *   - `positions[agentId]` is the live {x,z}; feed it back via `recordPositions` before ticking.
 *   - `stateDestination(state, desk)` (and `agentWaypoint`) is where the agent should walk now.
 *   - `employeeArrived(sim, agentId, now, seed)` acknowledges an arrival and finishes the leg early.
 *   - `stateUntil[agentId]` is a deterministic deadline: identical inputs give identical timelines.
 * Rain keeps sheltered agents inside; proximity reactions use live positions, never desk guesses.
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

export interface WorldPosition {
  x: number;
  z: number;
}

export interface SpeechBubble {
  agentId: string;
  emoji: string;
  text: string;
  kind: 'status' | 'ghibah-whole' | 'ghibah-savage';
  expiresAt: number;
  /** State the bubble belongs to; used to drop bubbles the agent already left. */
  state?: EmployeeState;
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
  focus: Record<string, number>;
  bubbles: SpeechBubble[];
  events: OfficeEvent[];
  /** Current live positions — update from the scene before each tick. */
  positions: Record<string, WorldPosition>;
  /** Raffa position for proximity suppression. */
  boss: WorldPosition;
  /** Last weather the sim was told about; 'rain' keeps everyone sheltered. */
  weather: WeatherCondition;
  /** Zone an agent is gossiping in while `chatting` (pantry or terrace). */
  chatZone: Record<string, 'pantry' | 'terrace'>;
  /** Treat action IDs already applied (bounded) so a replay cannot pay twice. */
  treatActionIds: string[];
}

// Zones match the penthouse layout: pantry bar area, terrace lounge area.
export const SOCIAL_ZONES: Record<'pantry' | 'terrace', WorldPosition> = {
  pantry: { x: 8.5, z: 7.2 },
  terrace: { x: -6.0, z: 19.5 },
};

/** Deterministic phase lengths in ms. */
export const SOCIAL_DURATIONS: Record<
  'working' | 'pantry' | 'terrace' | 'chatting' | 'shelter',
  number
> = {
  working: 60_000,
  pantry: 90_000,
  terrace: 90_000,
  chatting: 40_000,
  shelter: 60_000,
};

/** Walking legs are derived from geometry, never from a random roll. */
export const WALK_SPEED = 2.5; // world units per second
export const WALK_MIN_MS = 4_000;
export const PROXIMITY_SILENCE = 3;
export const GHIBAH_GRACE_MS = 30_000;
export const MAX_BUBBLES = 12;
export const MAX_EVENTS = 40;
export const TREAT_WINDOW = 8;
export const WALK_STAMINA_COST = 5;
export const WORK_FOCUS_DRAIN = 10;
export const MIN_STAMINA = 20;
export const MIN_FOCUS = 30;
export const MAX_ENERGY = 100;

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

const TARA = AGENTS.find((a) => a.name === 'Khansaku');

/** Canonical identity of Khansaku; every treat broadcast is attributed here. */
export const TARA_ID = TARA ? TARA.id : 'tara';

export type ZoneKind = 'home' | 'pantry' | 'terrace' | 'shelter';

interface AgentRef {
  id: string;
  name: string;
  desk: WorldPosition;
}

/** Destination the agent walks toward for a given state (home == own desk). */
export function stateDestination(state: EmployeeState, desk: WorldPosition): WorldPosition {
  switch (state) {
    case 'walking-pantry':
    case 'pantry':
      return { ...SOCIAL_ZONES.pantry };
    case 'walking-terrace':
    case 'terrace':
      return { ...SOCIAL_ZONES.terrace };
    default:
      return { x: desk.x, z: desk.z };
  }
}

export function zoneKindForState(state: EmployeeState): ZoneKind {
  switch (state) {
    case 'walking-pantry':
    case 'pantry':
      return 'pantry';
    case 'walking-terrace':
    case 'terrace':
      return 'terrace';
    case 'shelter':
      return 'shelter';
    default:
      return 'home';
  }
}

/** Deterministic walking leg length derived from geometry. */
export function travelMs(from: WorldPosition, to: WorldPosition): number {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  return Math.max(WALK_MIN_MS, Math.round((distance / WALK_SPEED) * 1000));
}

/** Position the R3F layer should drive this agent toward right now. */
export function agentWaypoint(sim: EmployeeSim, agentId: string, desk: WorldPosition): WorldPosition {
  const state = sim.states[agentId] ?? 'working';
  if (state === 'chatting') return { ...SOCIAL_ZONES[sim.chatZone[agentId] ?? 'pantry'] };
  return stateDestination(state, desk);
}

export function createEmployeeSim(bossSpawn: WorldPosition): EmployeeSim {
  const states: Record<string, EmployeeState> = {};
  const stateUntil: Record<string, number> = {};
  const stamina: Record<string, number> = {};
  const focus: Record<string, number> = {};
  const positions: Record<string, WorldPosition> = {};
  for (const a of AGENTS) {
    states[a.id] = 'working';
    stateUntil[a.id] = 0;
    stamina[a.id] = MAX_ENERGY;
    focus[a.id] = MAX_ENERGY;
    positions[a.id] = { x: a.desk.x, z: a.desk.z };
  }
  return {
    states,
    stateUntil,
    stamina,
    focus,
    bubbles: [],
    events: [],
    positions,
    chatZone: {},
    boss: { x: bossSpawn.x, z: bossSpawn.z },
    weather: 'unavailable',
    treatActionIds: [],
  };
}

function cloneSim(sim: EmployeeSim): EmployeeSim {
  return {
    ...sim,
    states: { ...sim.states },
    stateUntil: { ...sim.stateUntil },
    stamina: { ...sim.stamina },
    focus: { ...sim.focus },
    bubbles: [...sim.bubbles],
    events: [...sim.events],
    positions: { ...sim.positions },
    chatZone: { ...sim.chatZone },
    treatActionIds: [...sim.treatActionIds],
  };
}

function addEvent(next: EmployeeSim, now: number, actor: string, kind: OfficeEvent['kind'], text: string): void {
  const id = `${kind}:${actor}:${now}`;
  if (next.events.some((e) => e.id === id)) return; // one event per (kind, actor, instant)
  next.events = [...next.events, { id, at: now, actor, kind, text }].slice(-MAX_EVENTS);
}

function addBubble(next: EmployeeSim, bubble: SpeechBubble): void {
  const rest = next.bubbles.filter(
    (b) => !(b.agentId === bubble.agentId && b.kind === bubble.kind && b.text === bubble.text),
  );
  next.bubbles = [...rest, bubble].slice(-MAX_BUBBLES);
}

function enterState(next: EmployeeSim, agent: AgentRef, state: EmployeeState, now: number): void {
  const origin = next.positions[agent.id] ?? agent.desk;
  const destination = stateDestination(state, agent.desk);
  if (state === 'walking-pantry' || state === 'walking-terrace' || state === 'walking-back') {
    next.stateUntil[agent.id] = now + travelMs(origin, destination);
    next.stamina[agent.id] = Math.max(MIN_STAMINA, (next.stamina[agent.id] ?? MAX_ENERGY) - WALK_STAMINA_COST);
  } else {
    next.stateUntil[agent.id] = now + (SOCIAL_DURATIONS[state] ?? SOCIAL_DURATIONS.working);
    if (state === 'working') {
      next.focus[agent.id] = Math.max(MIN_FOCUS, (next.focus[agent.id] ?? MAX_ENERGY) - WORK_FOCUS_DRAIN);
    }
  }
  next.states[agent.id] = state;
}

/** Leave pantry/terrace: deterministic gossip roll, otherwise walk home. */
function leaveLeisureState(next: EmployeeSim, agent: AgentRef, index: number, now: number, seedCounter: number): void {
  const zone: 'pantry' | 'terrace' = next.states[agent.id] === 'terrace' ? 'terrace' : 'pantry';
  const gossips = (((seedCounter * 7 + index * 3) % 4) + 4) % 4 === 0;
  if (!gossips) {
    enterState(next, agent, 'walking-back', now);
    return;
  }
  const savage = (((index + seedCounter) % 2) + 2) % 2 === 0;
  const pool = savage ? GHIBAH_SAVAGE : GHIBAH_WHOLESOME;
  const line = pool[(((seedCounter + index) % pool.length) + pool.length) % pool.length];
  enterState(next, agent, 'chatting', now);
  next.chatZone[agent.id] = zone;
  addBubble(next, {
    agentId: agent.id,
    emoji: '🗣️',
    text: line,
    kind: savage ? 'ghibah-savage' : 'ghibah-whole',
    expiresAt: now + 70_000,
    state: 'chatting',
  });
  addEvent(next, now, agent.id, 'ghibah', `${agent.name} kongkow di ${zone === 'terrace' ? 'sky terrace' : 'pantry'}.`);
}

function advanceAgent(
  next: EmployeeSim,
  agent: AgentRef,
  index: number,
  now: number,
  seedCounter: number,
  forced: boolean,
): void {
  const current = next.states[agent.id] ?? 'working';
  if (!forced && now < (next.stateUntil[agent.id] ?? 0)) return;

  const raining = next.weather === 'rain';
  if (raining && (current === 'terrace' || current === 'walking-terrace')) {
    enterState(next, agent, 'shelter', now);
    return;
  }

  switch (current) {
    case 'working': {
      const roll = (((seedCounter * 31 + index * 17) % 6) + 6) % 6;
      if (roll < 2) enterState(next, agent, 'walking-pantry', now);
      else if (roll === 2) enterState(next, agent, raining ? 'walking-pantry' : 'walking-terrace', now);
      else enterState(next, agent, 'working', now);
      return;
    }
    case 'walking-pantry': {
      enterState(next, agent, 'pantry', now);
      const quote = PANTRY_QUOTE[(((seedCounter + index) % PANTRY_QUOTE.length) + PANTRY_QUOTE.length) % PANTRY_QUOTE.length];
      addBubble(next, {
        agentId: agent.id,
        emoji: quote.emoji,
        text: quote.text,
        kind: 'status',
        expiresAt: now + 60_000,
        state: 'pantry',
      });
      addEvent(next, now, agent.id, 'status', `${agent.name} mampir pantry.`);
      return;
    }
    case 'walking-terrace': {
      enterState(next, agent, 'terrace', now);
      const quote = TERRACE_QUOTE[(((seedCounter + index) % TERRACE_QUOTE.length) + TERRACE_QUOTE.length) % TERRACE_QUOTE.length];
      addBubble(next, {
        agentId: agent.id,
        emoji: quote.emoji,
        text: quote.text,
        kind: 'status',
        expiresAt: now + 60_000,
        state: 'terrace',
      });
      addEvent(next, now, agent.id, 'status', `${agent.name} mampir sky terrace.`);
      return;
    }
    case 'pantry':
    case 'terrace':
      leaveLeisureState(next, agent, index, now, seedCounter);
      return;
    case 'chatting':
      enterState(next, agent, 'walking-back', now);
      return;
    case 'walking-back':
      enterState(next, agent, 'working', now);
      return;
    case 'shelter': {
      if (raining) {
        // Still pouring: stay put, just push the deterministic deadline forward.
        next.states[agent.id] = 'shelter';
        next.stateUntil[agent.id] = now + SOCIAL_DURATIONS.shelter;
        return;
      }
      enterState(next, agent, 'working', now);
      return;
    }
  }
}

export function employeeStateTick(sim: EmployeeSim, now: number, seedCounter: number): EmployeeSim {
  const next = cloneSim(sim);
  next.bubbles = next.bubbles.filter((b) => b.expiresAt > now);

  AGENTS.forEach((a, index) => {
    advanceAgent(next, a as AgentRef, index, now, seedCounter, false);
  });

  // Rain is authoritative: nobody may sit on the terrace while it pours.
  if (next.weather === 'rain') {
    AGENTS.forEach((a) => {
      const state = next.states[a.id];
      if (state === 'terrace' || state === 'walking-terrace') enterState(next, a as AgentRef, 'shelter', now);
    });
  }

  // Proximity suppression uses live positions, not desk assumptions.
  AGENTS.forEach((a) => {
    const pos = next.positions[a.id] ?? { x: a.desk.x, z: a.desk.z };
    const near = Math.hypot(pos.x - next.boss.x, pos.z - next.boss.z) < PROXIMITY_SILENCE;
    if (!near) return;
    const ghibah = next.bubbles.filter((b) => b.agentId === a.id && (b.kind === 'ghibah-whole' || b.kind === 'ghibah-savage'));
    if (ghibah.length === 0 && next.states[a.id] !== 'chatting') return;
    next.bubbles = next.bubbles.filter((b) => !ghibah.includes(b));
    if (next.states[a.id] === 'chatting') {
      enterState(next, a as AgentRef, 'walking-back', now);
      next.stateUntil[a.id] = Math.max(next.stateUntil[a.id], now + GHIBAH_GRACE_MS);
      addEvent(next, now, a.id, 'ghibah', `${a.name} langsung bungkam karena Mas Bos mendekat.`);
    }
  });

  // Bounded, deduplicated, non-contradictory bubbles.
  next.bubbles = next.bubbles
    .filter((b) => b.expiresAt > now && (!b.state || b.state === next.states[b.agentId]))
    .slice(-MAX_BUBBLES);

  return next;
}

/** Arrival acknowledgement from the R3F layer: finish the current walking leg now. */
export function employeeArrived(sim: EmployeeSim, agentId: string, now: number, seedCounter: number): EmployeeSim {
  const index = AGENTS.findIndex((a) => a.id === agentId);
  if (index < 0) return sim;
  const state = sim.states[agentId];
  if (state !== 'walking-pantry' && state !== 'walking-terrace' && state !== 'walking-back') return sim;
  const next = cloneSim(sim);
  const agent = AGENTS[index] as AgentRef;
  next.positions[agentId] = stateDestination(state, agent.desk);
  advanceAgent(next, agent, index, now, seedCounter, true);
  return next;
}

/** Snapshot live scene positions back into the sim before ticking. */
export function recordPositions(sim: EmployeeSim, positions: Record<string, WorldPosition>): EmployeeSim {
  return { ...sim, positions: { ...sim.positions, ...positions } };
}

export function applyWeatherToSim(sim: EmployeeSim, condition: WeatherCondition, now: number): EmployeeSim {
  const next = cloneSim(sim);
  next.weather = condition;
  if (condition !== 'rain') return next;
  for (const a of AGENTS) {
    const state: EmployeeState = next.states[a.id];
    if (state !== 'terrace' && state !== 'walking-terrace') continue;
    enterState(next, a as AgentRef, 'shelter', now);
    addBubble(next, {
      agentId: a.id,
      emoji: '🌧️',
      text: 'Waduh gerimis, masuk dulu ngopi di dalem!',
      kind: 'status',
      expiresAt: now + 50_000,
      state: 'shelter',
    });
  }
  return next;
}

/**
 * Treat round: restores stamina AND focus for everyone, once per actionId.
 * Replaying the same actionId is a no-op — no second bubble, event or top-up.
 */
export function applyEmployeeTreat(sim: EmployeeSim, now: number, actionId?: string): EmployeeSim {
  const id = actionId ?? `treat:${now}`;
  if (sim.treatActionIds.includes(id)) return sim;
  const next = cloneSim(sim);
  next.treatActionIds = [...next.treatActionIds, id].slice(-TREAT_WINDOW);
  for (const a of AGENTS) {
    next.stamina[a.id] = MAX_ENERGY;
    next.focus[a.id] = MAX_ENERGY;
  }
  const text = 'Mas Bos Raffa yang ganteng traktir Kopi Kenangan & Croissant untuk kita semua!';
  addBubble(next, { agentId: TARA_ID, emoji: '🎉', text, kind: 'status', expiresAt: now + 70_000 });
  addEvent(next, now, TARA_ID, 'treat', text);
  return next;
}

export function visibleBubble(sim: EmployeeSim, agentId: string, now: number): SpeechBubble | null {
  return sim.bubbles.find((b) => b.agentId === agentId && b.expiresAt > now) ?? null;
}

export function zoneForAgent<T extends { rect: { x1: number; z1: number; x2: number; z2: number } }>(
  agent: { desk: WorldPosition },
  zones: readonly T[],
  livePosition?: WorldPosition,
): T {
  const p = livePosition ?? agent.desk;
  return zones.find((s) => p.x >= s.rect.x1 && p.x <= s.rect.x2 && p.z >= s.rect.z1 && p.z <= s.rect.z2) ?? zones[0];
}
