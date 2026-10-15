'use client';

import React from 'react';
import { Play, Pause, SkipForward, Maximize2 } from 'lucide-react';

export interface AudioTimeState {
  currentTime: number;
  duration: number;
}

export type AudioStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface AudioState {
  ready?: boolean;
  status?: AudioStatus;
  isPlaying: boolean;
  isLoading?: boolean;
  isMuted: boolean;
  volume?: number;
  error?: string | null;
}

export interface TrackMeta {
  id?: string;
  title?: string;
  artist?: string;
  cover?: string;
  videoId?: string;
}

export interface MusicPlayerWidgetProps {
  audioState?: AudioState;
  audioTime?: AudioTimeState;
  currentTrack?: TrackMeta | null;
  onTogglePlay?: () => void;
  onNextTrack?: () => void;
  onOpenPlayer?: () => void;
  className?: string;
}

const fmt = (s: number) => {
  if (!s || Number.isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

const DEFAULT_COVER = 'https://i.ytimg.com/vi/NA7hmTexZ0E/mqdefault.jpg';

const iconBtn =
  'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-zinc-300 transition hover:-translate-y-px hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

/**
 * Mini player (pill) di pojok kiri bawah. Kontrol lengkap ada di MusicPlayerModal.
 */
export default function MusicPlayerWidget({
  audioState = { isPlaying: false, isMuted: false, volume: 60 },
  audioTime = { currentTime: 0, duration: 0 },
  currentTrack,
  onTogglePlay,
  onNextTrack,
  onOpenPlayer,
  className = '',
}: MusicPlayerWidgetProps) {
  const status = audioState.status || (audioState.isPlaying ? 'playing' : 'paused');
  const playing = status === 'playing';
  const busy = status === 'loading' || status === 'buffering';
  const pct = audioTime.duration > 0 ? Math.min(100, Math.max(0, (audioTime.currentTime / audioTime.duration) * 100)) : 0;

  let subText = `${fmt(audioTime.currentTime)} / ${audioTime.duration ? fmt(audioTime.duration) : '--:--'}`;
  let tone = 'text-zinc-400';
  if (status === 'error') {
    subText = `⚠ ${audioState.error || 'Tidak dapat diputar'}`;
    tone = 'text-red-300';
  } else if (busy) {
    subText = 'Memuat…';
    tone = 'text-amber-300';
  } else if (playing) {
    tone = 'text-emerald-300';
  }

  return (
    <section
      className={`fixed bottom-6 left-6 z-[70] grid w-[min(340px,calc(100vw-48px))] max-[1366px]:w-[310px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 overflow-hidden rounded-2xl border bg-[#0d0e13]/95 p-3 text-zinc-100 shadow-[0_20px_45px_rgba(0,0,0,0.7)] backdrop-blur-[20px] transition-[border-color,box-shadow] duration-200 max-[480px]:bottom-3 max-[480px]:left-3 max-[480px]:w-[calc(100vw-24px)] ${
        playing ? 'border-emerald-500/40 shadow-[0_0_28px_rgba(16,185,129,0.25)]' : 'border-white/15'
      } ${className}`}
      aria-label="Mini music player"
    >
      <button
        type="button"
        onClick={onOpenPlayer}
        title="Buka Music Player"
        aria-label="Buka Music Player"
        className={`h-11 w-11 overflow-hidden rounded-full border-2 bg-zinc-900 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shrink-0 shadow-sm ${
          playing ? 'animate-[spin_8s_linear_infinite] border-emerald-500' : 'border-white/20'
        } ${playing ? '' : '[animation-play-state:paused]'}`}
      >
        <img className="block h-full w-full object-cover" src={currentTrack?.cover || DEFAULT_COVER} alt="" />
      </button>

      <button
        type="button"
        className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        onClick={onOpenPlayer}
        title={currentTrack?.title}
      >
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-bold tracking-tight text-white">
          {currentTrack?.title || 'YouTube Music'}
        </div>
        <div className={`mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs tabular-nums font-medium ${tone}`}>{subText}</div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Jeda' : 'Putar'}
          title={playing ? 'Jeda' : 'Putar'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-[#04241a] transition hover:-translate-y-px hover:from-emerald-300 hover:to-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 shadow-sm"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#04241a]/30 border-t-[#04241a]" />
          ) : playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </button>
        <button type="button" className={iconBtn} onClick={onNextTrack} aria-label="Lagu berikutnya" title="Berikutnya">
          <SkipForward size={15} />
        </button>
        <button type="button" className={iconBtn} onClick={onOpenPlayer} aria-label="Buka player" title="Buka player">
          <Maximize2 size={14} />
        </button>
      </div>

      <span
        className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-300 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </section>
  );
}
