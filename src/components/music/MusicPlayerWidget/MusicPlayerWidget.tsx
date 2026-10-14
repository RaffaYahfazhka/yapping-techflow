'use client';

import React from 'react';
import { Play, Pause, SkipForward, Maximize2 } from 'lucide-react';
import { css, keyframes } from '@emotion/css';

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

const spin = keyframes`to { transform: rotate(360deg); }`;

const styles = {
  pill: (playing: boolean) => css`
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 70;
    width: min(300px, calc(100vw - 40px));
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 8px;
    border-radius: 16px;
    background: rgba(13, 14, 19, 0.88);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid ${playing ? 'rgba(16,185,129,.4)' : 'rgba(255,255,255,.1)'};
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55)${playing ? ', 0 0 22px rgba(16,185,129,.18)' : ''};
    color: #f4f4f5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    transition: border-color 0.25s ease, box-shadow 0.25s ease;

    @media (max-width: 480px) {
      left: 12px;
      bottom: 12px;
      width: calc(100vw - 24px);
    }
  `,

  cover: (playing: boolean) => css`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid ${playing ? '#10b981' : 'rgba(255,255,255,.15)'};
    padding: 0;
    cursor: pointer;
    background: #1a1b20;
    animation: ${spin} 8s linear infinite;
    animation-play-state: ${playing ? 'running' : 'paused'};

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,

  info: css`
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    color: inherit;
    cursor: pointer;
  `,

  title: css`
    font-size: 12.5px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  sub: (tone: string) => css`
    margin-top: 2px;
    font-size: 10.5px;
    color: ${tone};
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  btns: css`
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  btn: (primary = false) => css`
    width: ${primary ? 34 : 30}px;
    height: ${primary ? 34 : 30}px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: ${primary ? 13 : 12}px;
    color: ${primary ? '#04241a' : '#d4d4d8'};
    background: ${primary ? 'linear-gradient(135deg,#34d399,#10b981)' : 'rgba(255,255,255,.06)'};
    transition: transform 0.12s ease, background 0.12s ease;

    &:hover {
      transform: translateY(-1px);
      background: ${primary ? 'linear-gradient(135deg,#6ee7b7,#34d399)' : 'rgba(255,255,255,.12)'};
    }
  `,

  spinner: css`
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(4, 36, 26, 0.3);
    border-top-color: #04241a;
    animation: ${spin} 0.8s linear infinite;
  `,

  progress: (pct: number) => css`
    position: absolute;
    left: 0;
    bottom: 0;
    height: 2px;
    width: ${pct}%;
    background: linear-gradient(90deg, #10b981, #34d399);
    transition: width 0.4s linear;
  `,
};

const fmt = (s: number) => {
  if (!s || Number.isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

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
  const pct = audioTime.duration > 0 ? (audioTime.currentTime / audioTime.duration) * 100 : 0;

  let subText = `${fmt(audioTime.currentTime)} / ${audioTime.duration ? fmt(audioTime.duration) : '--:--'}`;
  let tone = '#a1a1aa';
  if (status === 'error') {
    subText = `⚠ ${audioState.error || 'Tidak dapat diputar'}`;
    tone = '#fca5a5';
  } else if (busy) {
    subText = 'Memuat…';
    tone = '#fcd34d';
  } else if (playing) {
    tone = '#6ee7b7';
  }

  return (
    <section className={`${styles.pill(playing)} ${className}`} aria-label="Mini music player">
      <button type="button" className={styles.cover(playing)} onClick={onOpenPlayer} title="Buka Music Player">
        <img src={currentTrack?.cover || 'https://i.ytimg.com/vi/NA7hmTexZ0E/mqdefault.jpg'} alt="" />
      </button>

      <button type="button" className={styles.info} onClick={onOpenPlayer} title={currentTrack?.title}>
        <div className={styles.title}>{currentTrack?.title || 'YouTube Music'}</div>
        <div className={styles.sub(tone)}>{subText}</div>
      </button>

      <div className={styles.btns}>
        <button
          type="button"
          className={styles.btn(true)}
          onClick={onTogglePlay}
          aria-label={playing ? 'Jeda' : 'Putar'}
          title={playing ? 'Jeda' : 'Putar'}
        >
          {busy ? <span className={styles.spinner} /> : playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button type="button" className={styles.btn()} onClick={onNextTrack} aria-label="Lagu berikutnya" title="Berikutnya">
          <SkipForward size={14} />
        </button>
        <button type="button" className={styles.btn()} onClick={onOpenPlayer} aria-label="Buka player" title="Buka player">
          <Maximize2 size={13} />
        </button>
      </div>

      <span className={styles.progress(pct)} />
    </section>
  );
}
