/**
 * Weather engine — pure reducer for Jakarta/SCBD weather state.
 * Provider fetches only replace the visible condition when a result arrives; a manual
 * override is sticky and cannot be silently overwritten by an in-flight live response.
 * Last successful live metadata survives every loading, repeated-failure and manual state.
 */

export type WeatherCondition = 'clear' | 'fog' | 'rain';
export type WeatherStatus = 'loading' | 'live' | 'stale' | 'unavailable' | 'manual';

export interface WeatherState {
  status: WeatherStatus;
  condition: WeatherCondition;
  /** Last successful live fetch, ISO timestamp. Kept through all failures and overrides. */
  fetchedAt: string | null;
  /** Last successful live source, e.g. "open-meteo"; retained through failures/override. */
  source: string | null;
  reason: string | null;
  /** Sticky marker: fetch-start/success/fail cannot replace an explicit manual choice. */
  manualOverride: boolean;
}

export const INITIAL_WEATHER: WeatherState = {
  status: 'unavailable',
  condition: 'clear',
  fetchedAt: null,
  source: null,
  reason: 'Manual simulation (no live provider configured). Rain can be toggled explicitly.',
  manualOverride: false,
};

export type WeatherAction =
  | { kind: 'fetch-start' }
  | { kind: 'fetch-success'; condition: WeatherCondition; fetchedAt: string; source: string }
  | { kind: 'fetch-fail'; reason: string }
  | { kind: 'manual-set'; condition: WeatherCondition };

export function reduceWeather(state: WeatherState, action: WeatherAction): WeatherState {
  switch (action.kind) {
    case 'fetch-start':
      if (state.manualOverride) return state;
      return { ...state, status: 'loading' };
    case 'fetch-success':
      if (state.manualOverride) return state;
      return {
        status: 'live',
        condition: action.condition,
        fetchedAt: action.fetchedAt,
        source: action.source,
        reason: null,
        manualOverride: false,
      };
    case 'fetch-fail':
      if (state.manualOverride) return state;
      if (state.fetchedAt !== null) {
        return {
          ...state,
          status: 'stale',
          reason: action.reason,
          // Keep last-known condition/source/timestamp for repeated fail and start -> fail.
          condition: state.condition,
          fetchedAt: state.fetchedAt,
          source: state.source,
          manualOverride: false,
        };
      }
      return {
        ...state,
        status: 'unavailable',
        condition: 'clear',
        reason: action.reason,
        fetchedAt: null,
        source: null,
        manualOverride: false,
      };
    case 'manual-set':
      return {
        ...state,
        status: 'manual',
        condition: action.condition,
        reason: `Manual override: ${action.condition}`,
        manualOverride: true,
      };
  }
}

/** Rain intensity helper for the 3D weather layer. */
export function rainIntensity(state: WeatherState): number {
  return state.condition === 'rain' ? 1 : 0;
}

export function fogIntensity(state: WeatherState): number {
  return state.condition === 'fog' ? 1 : state.condition === 'rain' ? 0.3 : 0;
}
