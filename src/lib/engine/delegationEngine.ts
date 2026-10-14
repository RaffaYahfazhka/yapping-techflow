/**
 * Delegation engine — pure state machine for Khansaku's one-door command flow.
 * Flow: idle -> queued -> walking -> delivered (or failed) -> back to follow/stay.
 */

export type CompanionMode = 'follow' | 'stay';

export type DelegateCommand =
  | { kind: 'set-mode'; mode: CompanionMode }
  | { kind: 'delegate'; targetAgentId: string; task: string; targetDesk: { x: number; z: number }; now: number }
  | { kind: 'mark-delivered'; now: number }
  | { kind: 'mark-failed'; reason: string; now: number };

export interface DelegateEvent {
  kind: 'queued' | 'walking' | 'delivered' | 'failed' | 'mode-change';
  actor: 'khansaku';
  targetAgentId?: string;
  task?: string;
  reason?: string;
  mode?: CompanionMode;
}

export interface CompanionState {
  mode: CompanionMode;
  action: 'idle' | 'queued' | 'walking' | 'delivered' | 'failed';
  targetAgentId?: string;
  task?: string;
  stayAnchor?: { x: number; z: number };
  lastIdleAnchor?: { x: number; z: number };
  targetDesk?: { x: number; z: number };
}

export function initialCompanionState(spawn: { x: number; z: number }): CompanionState {
  return { mode: 'follow', action: 'idle', lastIdleAnchor: { ...spawn } };
}

export function reduceCompanion(
  state: CompanionState,
  command: DelegateCommand,
): { state: CompanionState; events: DelegateEvent[] } {
  switch (command.kind) {
    case 'set-mode': {
      const events: DelegateEvent[] = [{ kind: 'mode-change', actor: 'khansaku', mode: command.mode }];
      // Switching to stay while delegating is deferred until delivery completes.
      const nextAction = state.action === 'walking' || state.action === 'queued' ? { actionAfterMode: state.action } : null;
      void nextAction;
      if (command.mode === 'stay' && state.action !== 'walking' && state.action !== 'queued') {
        return { state: { ...state, mode: 'stay', stayAnchor: state.lastIdleAnchor ?? state.stayAnchor }, events };
      }
      return { state: { ...state, mode: command.mode }, events };
    }
    case 'delegate': {
      if (state.action === 'walking' || state.action === 'queued') {
        return {
          state,
          events: [{ kind: 'failed', actor: 'khansaku', reason: 'Delegasi sebelumnya masih berjalan' }],
        };
      }
      const anchor = state.stayAnchor ?? state.lastIdleAnchor ?? { x: 0, z: 0 };
      return {
        state: { ...state, action: 'walking', targetAgentId: command.targetAgentId, task: command.task, targetDesk: command.targetDesk, lastIdleAnchor: anchor },
        events: [{ kind: 'queued', actor: 'khansaku', targetAgentId: command.targetAgentId, task: command.task }],
      };
    }
    case 'mark-delivered': {
      if (state.action !== 'walking') {
        return { state, events: [] };
      }
      return {
        state: { ...state, action: 'delivered', targetAgentId: undefined, task: undefined },
        events: [{ kind: 'delivered', actor: 'khansaku', targetAgentId: state.targetAgentId, task: state.task }],
      };
    }
    case 'mark-failed': {
      if (state.action !== 'walking') {
        return { state, events: [] };
      }
      return {
        state: { ...state, action: 'failed', targetAgentId: undefined, task: undefined },
        events: [{ kind: 'failed', actor: 'khansaku', reason: command.reason }],
      };
    }
  }
}

// CompanionState has an optional field not present in the initial shape; declared here for clarity.
export type CompanionStateWithDesk = CompanionState & { targetDesk?: { x: number; z: number } };

declare module './delegationEngine' {
  interface CompanionState {
    targetDesk?: { x: number; z: number };
  }
}