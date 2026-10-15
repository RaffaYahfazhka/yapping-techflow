'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipForward, Maximize2, Music2 } from 'lucide-react';

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

/**
 * High-aesthetic floating mini-player (pill) at bottom left.
 * Featuring spinning vinyl disk, dynamic audio equalizer bars, glowing neon borders,
 * and Framer Motion micro-interactions.
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
    subText = `⚠ ${audioState.error || 'Gagal memutar'}`;
    tone = 'text-rose-400';
  } else if (busy) {
    subText = 'Buffering stream…';
    tone = 'text-amber-300';
  } else if (playing) {
    tone = 'text-emerald-400';
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`fixed bottom-20 min-[1360px]:bottom-5 left-4 sm:left-6 z-30 grid w-[min(300px,calc(100vw-32px))] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border bg-[#0b0c11]/[0.96] p-2.5 sm:p-3 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl transition-all duration-300 ${
        playing
          ? 'border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.2),0_20px_50px_rgba(0,0,0,0.8)]'
          : 'border-white/[0.1] hover:border-white/[0.18]'
      } ${className}`}
      aria-label="Mini music player"
    >
      {/* Ambient background glow when playing */}
      {playing && (
        <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-emerald-500/10 blur-[30px]" />
      )}

      {/* Album Vinyl Disc */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onOpenPlayer}
        title="Buka Music Player Studio"
        aria-label="Buka Music Player Studio"
        className={`relative h-11 w-11 overflow-hidden rounded-full border-2 bg-zinc-900 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shrink-0 shadow-md ${
          playing ? 'animate-[spin_8s_linear_infinite] border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'border-white/20'
        } ${playing ? '' : '[animation-play-state:paused]'}`}
      >
        <img
          className="block h-full w-full object-cover"
          src={currentTrack?.cover || DEFAULT_COVER}
          alt={currentTrack?.title || 'Album Art'}
        />
        {/* Center Vinyl Hole */}
        <div className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full border border-black/50 bg-[#0b0c11] shadow-inner" />
      </motion.button>

      {/* Track Info & Equalizer */}
      <button
        type="button"
        className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 group"
        onClick={onOpenPlayer}
        title={currentTrack?.title}
      >
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
          {currentTrack?.title || 'TechFlow Lo-Fi Beats'}
        </div>
        <div className="mt-0.5 flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
          {/* Animated Equalizer Bars */}
          {playing && (
            <span className="flex items-end gap-0.5 h-2.5 shrink-0" aria-hidden="true">
              <span className="w-0.5 bg-emerald-400 rounded-full animate-[equalizer_0.8s_ease-in-out_infinite_alternate] h-full" />
              <span className="w-0.5 bg-emerald-300 rounded-full animate-[equalizer_0.6s_ease-in-out_0.2s_infinite_alternate] h-2/3" />
              <span className="w-0.5 bg-emerald-500 rounded-full animate-[equalizer_0.7s_ease-in-out_0.4s_infinite_alternate] h-4/5" />
            </span>
          )}
          <span className={`text-[11px] tabular-nums font-mono font-medium ${tone}`}>{subText}</span>
        </div>
      </button>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Jeda' : 'Putar'}
          title={playing ? 'Jeda' : 'Putar'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-zinc-950 transition hover:from-emerald-300 hover:to-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.3)] font-bold"
        >
          {busy ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
          ) : playing ? (
            <Pause size={15} strokeWidth={2.5} />
          ) : (
            <Play size={15} strokeWidth={2.5} className="ml-0.5" />
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.1] hover:text-white border border-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          onClick={onNextTrack}
          aria-label="Lagu berikutnya"
          title="Berikutnya"
        >
          <SkipForward size={14} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-zinc-300 transition hover:bg-white/[0.1] hover:text-white border border-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          onClick={onOpenPlayer}
          aria-label="Buka player"
          title="Buka player"
        >
          <Maximize2 size={13} />
        </motion.button>
      </div>

      {/* Progress Track at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/[0.06]">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </motion.section>
  );
}
