/**
 * Weather engine — pure reducer for the Jakarta/SCBD weather state that the
 * office visual + social systems consume. Live provider only when configured;
 * manual override always available; never invents values as "live".
 */

export type WeatherCondition = 'clear' | 'fog' | 'rain';
export type WeatherStatus = 'loading' | 'live' | 'stale' | 'unavailable' | 'manual';

export interface WeatherState {
  status: WeatherStatus;
  condition: WeatherCondition;
  /** Last successful live fetch, ISO timestamp. */
  fetchedAt: string | null;
  /** Where the data came from (e.g. "open-meteo") - null for manual or unavailable. */
  source: string | null;
  reason: string | null;
}

export const INITIAL_WEATHER: WeatherState = {
  status: 'unavailable',
  condition: 'clear',
  fetchedAt: null,
  source: null,
  reason: 'Manual simulation (no live provider configured). Rain can be toggled explicitly.',
};

export type WeatherAction =
  | { kind: 'fetch-start' }
  | { kind: 'fetch-success'; condition: WeatherCondition; fetchedAt: string; source: string }
  | { kind: 'fetch-fail'; reason: string }
  | { kind: 'manual-set'; condition: WeatherCondition };

export function reduceWeather(state: WeatherState, action: WeatherAction): WeatherState {
  switch (action.kind) {
    case 'fetch-start':
      return { ...state, status: 'loading' };
    case 'fetch-success':
      return { status: 'live', condition: action.condition, fetchedAt: action.fetchedAt, source: action.source, reason: null };
    case 'fetch-fail':
      // stale = keep last-known condition and timestamp honestly labelled;
      // unavailable = never had live data, fall back to clear simulation
      if ((state.status === 'live' || state.status === 'stale') && state.fetchedAt && state.condition) {
        return { status: 'stale', condition: state.condition, fetchedAt: state.fetchedAt, source: state.source, reason: action.reason };
      }
      return { status: 'unavailable', condition: 'clear', fetchedAt: null, source: null, reason: action.reason };
    case 'manual-set':
      return { status: 'manual', condition: action.condition, fetchedAt: null, source: null, reason: `Manual override: ${action.condition}` };
  }
}

/** Rain intensity helper for the 3D weather layer. */
export function rainIntensity(state: WeatherState): number {
  return state.condition === 'rain' ? 1 : 0;
}

export function fogIntensity(state: WeatherState): number {
  return state.condition === 'fog' ? 1 : state.condition === 'rain' ? 0.3 : 0;
}