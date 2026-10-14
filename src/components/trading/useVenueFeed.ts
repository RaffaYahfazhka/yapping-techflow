'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MARKET_FEED_ENDPOINTS,
  type MarketFeedEnvelope,
  type MarketVenue,
} from '../../lib/data/markets';

/**
 * Konsumen kontrak feed /api/markets/*.
 *
 * Kontrak yang dijaga hook ini:
 *   - Tidak pernah membuat data: `envelope` hanya diisi bila route mengembalikan
 *     bentuk yang dikenali. Bentuk tak dikenal → `status: 'failed'`.
 *   - Setiap request dibatalkan saat parameter berubah / komponen unmount,
 *     sehingga tidak ada respons basi yang menimpa state baru.
 *   - `enabled: false` (mis. modal tertutup / tab tidak aktif) menghentikan
 *     polling tanpa menghapus data terakhir — UI tetap menampilkan stempel waktu.
 */

export type VenueFeedStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface VenueFeedState<T> {
  status: VenueFeedStatus;
  envelope: MarketFeedEnvelope<T> | null;
  error: string | null;
  lastLoadedAt: string | null;
  /** Jumlah pemuatan sukses — dipakai UI untuk menampilkan "diperbarui N×". */
  loadCount: number;
}

export type VenueFeedParams = Record<string, string | number | null | undefined>;

export interface VenueFeed<T> extends VenueFeedState<T> {
  refresh: () => void;
  /** true saat ada request in-flight (loading awal maupun refresh). */
  loading: boolean;
}

function buildQuery(params?: VenueFeedParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

function isRecognizedEnvelope<T>(value: unknown, venue: MarketVenue): value is MarketFeedEnvelope<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MarketFeedEnvelope<T>>;
  return (
    candidate.venue === venue &&
    typeof candidate.status === 'string' &&
    typeof candidate.readOnly === 'boolean' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  );
}

export function useVenueFeed<T>(
  venue: MarketVenue,
  params?: VenueFeedParams,
  options: { enabled?: boolean; auto?: boolean } = {}
): VenueFeed<T> {
  const enabled = options.enabled ?? true;
  const auto = options.auto ?? false;
  const [state, setState] = useState<VenueFeedState<T>>({
    status: 'idle',
    envelope: null,
    error: null,
    lastLoadedAt: null,
    loadCount: 0,
  });
  const [tick, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const query = buildQuery(params);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || (!auto && tick === 0)) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    (async () => {
      try {
        const res = await fetch(`${MARKET_FEED_ENDPOINTS[venue]}${query}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: `HTTP ${res.status} dari ${MARKET_FEED_ENDPOINTS[venue]}`,
          }));
          return;
        }
        if (!isRecognizedEnvelope<T>(payload, venue)) {
          setState((prev) => ({
            ...prev,
            status: 'failed',
            error: `Bentuk respons feed ${venue} tidak dikenali — data diabaikan.`,
          }));
          return;
        }

        setState((prev) => ({
          status: 'ready',
          envelope: payload,
          error: null,
          lastLoadedAt: new Date().toISOString(),
          loadCount: prev.loadCount + 1,
        }));
      } catch (err) {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Gagal memuat feed pasar.',
        }));
      }
    })();

    return () => controller.abort();
  }, [venue, query, enabled, auto, tick]);

  return { ...state, refresh, loading: state.status === 'loading' };
}
