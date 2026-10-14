/**
 * Spatial audio engine — pure Web Audio graph for local ambience.
 * One AudioContext + one THREE.AudioListener coordinate; gain/filter buses
 * owned here, NOT by React or the R3F reducer. Unlock must come from a user
 * gesture (activation coordinator in the runtime).
 */

import * as THREE from 'three';

/** Decoded ambience buffers (max 4 resident, per System-Wide bounds; dynamic eviction by key). */
export interface SpatialGraphBuffers extends Map<string, AudioBuffer> {}

export interface SpatialGraph {
  ctx: AudioContext;
  listener: THREE.AudioListener;
  masterGain: GainNode;
  rainGain: GainNode;
  officeGain: GainNode;
  buffers: SpatialGraphBuffers;
}

export const MAX_RESIDENT_BUFFERS = 4;

export function createSpatialGraph(camera: THREE.Camera): SpatialGraph | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  // DOM-global contract; narrowing with explicit boundary shape (one-off, not user data)
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const ctx = listener.context;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.8;
  masterGain.connect(ctx.destination);
  const rainGain = ctx.createGain();
  rainGain.gain.value = 0;
  rainGain.connect(masterGain);
  const officeGain = ctx.createGain();
  officeGain.gain.value = 0.5;
  officeGain.connect(masterGain);
  return { ctx, listener, masterGain, rainGain, officeGain, buffers: new Map() };
}

/** Resume after user gesture; safe to call repeatedly. */
export async function unlockSpatial(graph: SpatialGraph): Promise<boolean> {
  if (graph.ctx.state === 'suspended') {
    try {
      await graph.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }
  return graph.ctx.state === 'running';
}

/** Decode-once ambience buffer with the four-resident cap; reuse or evict oldest. */
export async function loadAmbienceBuffer(graph: SpatialGraph, key: string, url: string): Promise<AudioBuffer | null> {
  if (graph.buffers.has(key)) return graph.buffers.get(key) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    const buf = await graph.ctx.decodeAudioData(bytes);
    if (graph.buffers.size >= MAX_RESIDENT_BUFFERS) {
      const oldest = graph.buffers.keys().next().value;
      if (oldest) graph.buffers.delete(oldest);
    }
    graph.buffers.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Play an ambience buffer on the given bus once or looped; disconnected on end. */
export function playAmbience(graph: SpatialGraph, bus: GainNode, buffer: AudioBuffer, loop = true): AudioBufferSourceNode {
  const src = graph.ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  src.connect(bus);
  src.onended = () => {
    src.disconnect();
  };
  src.start();
  return src;
}

/** Acoustic occlusion: glass-door close drops terrace ambience by 80% (linear gain 0.2). */
export function setOcclusion(graph: SpatialGraph, openFraction: number): void {
  const clamped = Math.max(0, Math.min(1, openFraction));
  graph.officeGain.gain.value = 0.2 + 0.8 * clamped;
}

export function disposeSpatial(graph: SpatialGraph, camera: THREE.Camera): void {
  try {
    camera.remove(graph.listener);
  } catch {
    /* noop */
  }
  try {
    graph.ctx.close();
  } catch {
    /* noop */
  }
  graph.buffers.clear();
}