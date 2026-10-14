/**
 * Delegation engine — pure state machine for Khansaku's one-door command flow.
 *
 * Flow (no dead ends, no unused states):
 *   idle --delegate(validated)--> walking --mark-arrived--> delivering
 *        --mark-delivered--> returning --mark-returned--> idle (saved mode + anchor)
 *   walking|delivering|returning --mark-failed(reason)--> returning --> idle
 *
 * Contract for the R3F layer:
 *   - positions are plain `{x, z}`; feed Khansaku's live position back with `set-position`.
 *   - `delegateWaypoint(state)` is where she must walk right now (null when at rest).
 *   - acknowledge legs with `mark-arrived` / `mark-delivered` / `mark-returned`; abort with `mark-failed`.
 *   - the mode selected before an errand is held; a mode change mid-errand is deferred and applied on return.
 */

import { AGENTS } from '../data/agents';

export type CompanionMode = 'follow' | 'stay';

export type DelegateAction = 'idle' | 'walking' | 'delivering' | 'returning';

export interface WorldPosition {
  x: number;
  z: number;
}

export type DelegateCommand =
  | { kind: 'set-mode'; mode: CompanionMode; now: number }
  | { kind: 'set-position'; position: WorldPosition }
  | { kind: 'delegate'; targetAgentId: string; task: string; targetDesk: WorldPosition; now: number }
  | { kind: 'mark-arrived'; now: number }
  | { kind: 'mark-delivered'; now: number }
  | { kind: 'mark-returned'; now: number }
  | { kind: 'mark-failed'; reason: string; now: number };

export interface DelegateEvent {
  kind: 'delegated' | 'arrived' | 'delivered' | 'returned' | 'failed' | 'mode-change';
  actor: 'khansaku';
  at: number;
  targetAgentId?: string;
  task?: string;
  reason?: string;
  mode?: CompanionMode;
  /** Walking destination for this event, when relevant. */
  target?: WorldPosition;
}

export interface CompanionState {
  /** Mode currently in force. */
  mode: CompanionMode;
  action: DelegateAction;
  position: WorldPosition;
  /** Where she was last idle: follow anchor and default return point. */
  lastIdleAnchor: WorldPosition;
  /** Anchor held while mode === 'stay'. */
  stayAnchor?: WorldPosition;
  targetAgentId?: string;
  task?: string;
  targetDesk?: WorldPosition;
  /** Saved spot to walk back to once the errand ends. */
  returnTarget?: WorldPosition;
  /** Mode requested mid-errand; applied when the errand ends. */
  deferredMode?: CompanionMode;
  lastFailure?: { reason: string; at: number };
}

/** Roster ids Khansaku may be sent to; anything else is rejected. */
export const KNOWN_DELEGATE_TARGETS: readonly string[] = AGENTS.map((a) => a.id);

function isFinitePosition(p: WorldPosition | undefined): p is WorldPosition {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
}

/** Returns a rejection reason, or null when the order is well-formed. */
export function validateDelegation(targetAgentId: string, task: string, targetDesk: WorldPosition): string | null {
  if (task.trim().length === 0) return 'Task delegasi kosong — tidak ada yang bisa dikerjakan.';
  if (!KNOWN_DELEGATE_TARGETS.includes(targetAgentId)) return `Target tidak dikenal: ${targetAgentId}.`;
  if (!isFinitePosition(targetDesk)) return 'Titik tujuan delegasi tidak valid.';
  return null;
}

export function initialCompanionState(spawn: WorldPosition): CompanionState {
  return { mode: 'follow', action: 'idle', position: { x: spawn.x, z: spawn.z }, lastIdleAnchor: { x: spawn.x, z: spawn.z } };
}

/** Where Khansaku should walk right now, or null when she is at rest. */
export function delegateWaypoint(state: CompanionState): WorldPosition | null {
  if (state.action === 'walking') return state.targetDesk ?? null;
  if (state.action === 'returning') return state.returnTarget ?? null;
  return null;
}

type Step = { state: CompanionState; events: DelegateEvent[] };

export function reduceCompanion(state: CompanionState, command: DelegateCommand): Step {
  switch (command.kind) {
    case 'set-mode': {
      if (state.action !== 'idle') {
        // Held: the selected mode is applied when the errand ends, never dropped.
        return {
          state: { ...state, deferredMode: command.mode },
          events: [{ kind: 'mode-change', actor: 'khansaku', at: command.now, mode: command.mode, reason: 'Diterapkan setelah errand selesai.' }],
        };
      }
      const stayAnchor = command.mode === 'stay' ? { ...state.position } : state.stayAnchor;
      return {
        state: { ...state, mode: command.mode, deferredMode: undefined, ...(stayAnchor ? { stayAnchor } : {}) },
        events: [{ kind: 'mode-change', actor: 'khansaku', at: command.now, mode: command.mode }],
      };
    }
    case 'set-position': {
      if (!isFinitePosition(command.position)) return { state, events: [] };
      const position = { x: command.position.x, z: command.position.z };
      return {
        state: { ...state, position, ...(state.action === 'idle' ? { lastIdleAnchor: { ...position } } : {}) },
        events: [],
      };
    }
    case 'delegate': {
      if (state.action !== 'idle') {
        return {
          state,
          events: [{ kind: 'failed', actor: 'khansaku', at: command.now, reason: 'Delegasi sebelumnya masih berjalan.' }],
        };
      }
      const invalid = validateDelegation(command.targetAgentId, command.task, command.targetDesk);
      if (invalid) {
        return { state, events: [{ kind: 'failed', actor: 'khansaku', at: command.now, reason: invalid }] };
      }
      const task = command.task.trim();
      const returnTarget = { ...(state.stayAnchor ?? state.position) };
      return {
        state: {
          ...state,
          action: 'walking',
          targetAgentId: command.targetAgentId,
          task,
          targetDesk: { x: command.targetDesk.x, z: command.targetDesk.z },
          returnTarget,
        },
        events: [
          {
            kind: 'delegated',
            actor: 'khansaku',
            at: command.now,
            targetAgentId: command.targetAgentId,
            task,
            mode: state.mode,
            target: { ...command.targetDesk },
          },
        ],
      };
    }
    case 'mark-arrived': {
      if (state.action !== 'walking' || !state.targetDesk) return { state, events: [] };
      return {
        state: { ...state, action: 'delivering', position: { ...state.targetDesk } },
        events: [{ kind: 'arrived', actor: 'khansaku', at: command.now, targetAgentId: state.targetAgentId, task: state.task, target: state.targetDesk }],
      };
    }
    case 'mark-delivered': {
      if (state.action !== 'walking' && state.action !== 'delivering') return { state, events: [] };
      return {
        state: { ...state, action: 'returning', ...(state.targetDesk ? { position: { ...state.targetDesk } } : {}) },
        events: [{ kind: 'delivered', actor: 'khansaku', at: command.now, targetAgentId: state.targetAgentId, task: state.task }],
      };
    }
    case 'mark-returned': {
      if (state.action !== 'returning') return { state, events: [] };
      const landed = state.returnTarget ?? state.stayAnchor ?? state.position;
      const mode = state.deferredMode ?? state.mode;
      const events: DelegateEvent[] = [{ kind: 'returned', actor: 'khansaku', at: command.now, targetAgentId: state.targetAgentId, task: state.task }];
      if (state.deferredMode && state.deferredMode !== state.mode) {
        events.push({ kind: 'mode-change', actor: 'khansaku', at: command.now, mode });
      }
      const anchor = { x: landed.x, z: landed.z };
      return {
        state: {
          mode,
          action: 'idle',
          position: { ...anchor },
          lastIdleAnchor: { ...anchor },
          ...(mode === 'stay' ? { stayAnchor: { ...anchor } } : {}),
          ...(state.lastFailure ? { lastFailure: state.lastFailure } : {}),
        },
        events,
      };
    }
    case 'mark-failed': {
      if (state.action === 'idle') return { state, events: [] };
      return {
        state: { ...state, action: 'returning', lastFailure: { reason: command.reason, at: command.now } },
        events: [{ kind: 'failed', actor: 'khansaku', at: command.now, targetAgentId: state.targetAgentId, task: state.task, reason: command.reason }],
      };
    }
  }
}
