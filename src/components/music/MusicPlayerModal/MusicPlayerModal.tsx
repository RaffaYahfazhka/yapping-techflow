'use client';

import React, { useMemo, useState } from 'react';
import { css, keyframes } from '@emotion/css';
import Modal, { scrollbar } from '../../ui/Modal';
import { USER_PLAYLIST, DEFAULT_PLAYLIST_ID, DEFAULT_PLAYLIST_URL } from '../../../lib/data/userPlaylist';
import { Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, Shuffle, Repeat, Music, Link2, Sparkles } from 'lucide-react';
import type { AudioState, AudioTimeState, TrackMeta } from '../MusicPlayerWidget/MusicPlayerWidget';

export type RepeatMode = 'off' | 'all' | 'one';

export interface MusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioState: AudioState;
  audioTime: AudioTimeState;
  currentTrack?: TrackMeta | null;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleMute: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onSelectTrack: (track: any, index: number) => void;
  onPlayCustomUrl: (url: string, title?: string, artist?: string) => void;
}

export const formatTime = (secs: number) => {
  if (!secs || Number.isNaN(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const spin = keyframes`to { transform: rotate(360deg); }`;
const bounce = keyframes`
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
`;

const ACCENT = '#10b981';

const styles = {
  layout: css`
    display: grid;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 20px;
    min-height: 0;
    height: 100%;

    @media (max-width: 860px) {
      grid-template-columns: 1fr;
      height: auto;
    }
  `,

  nowPlaying: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 22px 20px;
    border-radius: 18px;
    background: radial-gradient(120% 80% at 50% 0%, rgba(16, 185, 129, 0.16), transparent 60%),
      rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);

    @media (max-width: 860px) {
      padding: 18px 16px;
    }
  `,

  artWrap: css`
    position: relative;
    width: min(100%, 240px);
    aspect-ratio: 1;

    @media (max-width: 860px) {
      width: min(62vw, 200px);
    }
  `,

  vinyl: (playing: boolean) => css`
    position: absolute;
    inset: 6%;
    border-radius: 50%;
    background: repeating-radial-gradient(circle, #111 0 2px, #1b1b1f 2px 4px);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
    transform: translateX(${playing ? '18%' : '0'});
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    animation: ${spin} 6s linear infinite;
    animation-play-state: ${playing ? 'running' : 'paused'};
  `,

  art: css`
    position: absolute;
    inset: 0;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  meta: css`
    width: 100%;
    text-align: center;
    min-width: 0;
  `,

  title: css`
    font-size: 15px;
    font-weight: 750;
    line-height: 1.35;
    color: #fff;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  artist: css`
    margin-top: 4px;
    font-size: 12px;
    color: #a1a1aa;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,

  ytBadge: css`
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(239, 68, 68, 0.16);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  `,

  statusLine: (tone: 'ok' | 'warn' | 'err' | 'idle') => css`
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    color: ${tone === 'ok' ? '#6ee7b7' : tone === 'warn' ? '#fcd34d' : tone === 'err' ? '#fca5a5' : '#a1a1aa'};
    background: ${tone === 'ok'
      ? 'rgba(16,185,129,.12)'
      : tone === 'warn'
        ? 'rgba(245,158,11,.12)'
        : tone === 'err'
          ? 'rgba(239,68,68,.12)'
          : 'rgba(255,255,255,.05)'};
    text-align: center;
    max-width: 100%;
  `,

  progressWrap: css`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  range: (pct: number) => css`
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    cursor: pointer;
    outline: none;
    background: linear-gradient(90deg, ${ACCENT} 0%, #34d399 ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%);

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.25);
      cursor: pointer;
    }
    &::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border: none;
      border-radius: 50%;
      background: #fff;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `,

  timeRow: css`
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #a1a1aa;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  `,

  controls: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  `,

  iconBtn: (active = false) => css`
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 15px;
    cursor: pointer;
    border: 1px solid ${active ? 'rgba(16,185,129,.45)' : 'rgba(255,255,255,.08)'};
    background: ${active ? 'rgba(16,185,129,.16)' : 'rgba(255,255,255,.04)'};
    color: ${active ? '#6ee7b7' : '#d4d4d8'};
    position: relative;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
  `,

  playBtn: css`
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 20px;
    cursor: pointer;
    border: none;
    color: #04241a;
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 10px 26px rgba(16, 185, 129, 0.45);
    transition: transform 0.15s ease;

    &:hover { transform: scale(1.05); }
    &:active { transform: scale(0.96); }
  `,

  spinner: css`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2.5px solid rgba(4, 36, 26, 0.3);
    border-top-color: #04241a;
    animation: ${spin} 0.8s linear infinite;
  `,

  repeatOne: css`
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 8px;
    font-weight: 900;
  `,

  volumeRow: css`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  `,

  volLabel: css`
    width: 34px;
    text-align: right;
    font-size: 11px;
    color: #a1a1aa;
    font-variant-numeric: tabular-nums;
  `,

  /* playlist side */
  side: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    min-width: 0;
  `,

  tabs: css`
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  `,

  tab: (active: boolean) => css`
    flex: 1;
    padding: 8px 10px;
    border-radius: 9px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: ${active ? '#fff' : '#a1a1aa'};
    background: ${active ? 'rgba(255,255,255,.1)' : 'transparent'};
    transition: all 0.15s ease;
  `,

  input: css`
    width: 100%;
    padding: 10px 12px;
    border-radius: 11px;
    font-size: 13px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    outline: none;

    &::placeholder { color: #71717a; }
    &:focus {
      border-color: rgba(16, 185, 129, 0.6);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }
  `,

  list: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
    ${scrollbar}

    @media (max-width: 860px) {
      max-height: 46vh;
    }
  `,

  row: (active: boolean) => css`
    display: grid;
    grid-template-columns: 26px 44px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 11px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    border: 1px solid ${active ? 'rgba(16,185,129,.35)' : 'transparent'};
    background: ${active ? 'rgba(16,185,129,.1)' : 'transparent'};
    color: inherit;
    transition: background 0.12s ease;

    &:hover { background: rgba(255, 255, 255, 0.05); }
  `,

  idx: css`
    font-size: 11px;
    color: #71717a;
    font-family: ui-monospace, monospace;
    text-align: right;
  `,

  thumb: css`
    width: 44px;
    height: 32px;
    border-radius: 6px;
    object-fit: cover;
    background: #1a1b20;
  `,

  rowTitle: (active: boolean) => css`
    font-size: 12.5px;
    font-weight: 650;
    color: ${active ? '#6ee7b7' : '#f4f4f5'};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  rowSub: css`
    font-size: 11px;
    color: #71717a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  eq: css`
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;

    i {
      width: 3px;
      height: 100%;
      background: ${ACCENT};
      border-radius: 1px;
      transform-origin: bottom;
      animation: ${bounce} 0.9s ease-in-out infinite;
    }
    i:nth-child(2) { animation-delay: 0.2s; }
    i:nth-child(3) { animation-delay: 0.4s; }
  `,

  form: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
  `,

  label: css`
    font-size: 12px;
    font-weight: 600;
    color: #d4d4d8;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,

  twoCol: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    @media (max-width: 520px) {
      grid-template-columns: 1fr;
    }
  `,

  submit: css`
    padding: 11px 16px;
    border-radius: 11px;
    border: none;
    cursor: pointer;
    font-weight: 800;
    font-size: 13px;
    color: #04241a;
    background: linear-gradient(135deg, #34d399, #10b981);

    &:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
};

export function parseYouTubeUrl(url: string): { videoId: string | null; playlistId: string | null } {
  let videoId: string | null = null;
  let playlistId: string | null = null;
  const u = url.trim();
  const list = u.match(/[?&]list=([\w-]+)/);
  if (list) playlistId = list[1];
  const short = u.match(/youtu\.be\/([\w-]{11})/);
  const watch = u.match(/[?&]v=([\w-]{11})/);
  const embed = u.match(/(?:embed|shorts|live)\/([\w-]{11})/);
  if (short) videoId = short[1];
  else if (watch) videoId = watch[1];
  else if (embed) videoId = embed[1];
  else if (/^[\w-]{11}$/.test(u)) videoId = u;
  return { videoId, playlistId };
}

export default function MusicPlayerModal({
  isOpen,
  onClose,
  audioState,
  audioTime,
  currentTrack,
  isShuffle,
  repeatMode,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onToggleMute,
  onSeek,
  onVolumeChange,
  onToggleShuffle,
  onCycleRepeat,
  onSelectTrack,
  onPlayCustomUrl,
}: MusicPlayerModalProps) {
  const [tab, setTab] = useState<'playlist' | 'custom'>('playlist');
  const [query, setQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [scrub, setScrub] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USER_PLAYLIST.map((t, i) => ({ track: t, index: i })).filter(
      ({ track }) => !q || track.title.toLowerCase().includes(q) || track.artist.toLowerCase().includes(q)
    );
  }, [query]);

  const parsedCustom = useMemo(() => parseYouTubeUrl(customUrl), [customUrl]);
  const customValid = Boolean(parsedCustom.videoId || parsedCustom.playlistId);

  const duration = audioTime.duration || 0;
  const shownTime = scrub ?? audioTime.currentTime;
  const pct = duration > 0 ? Math.min(100, (shownTime / duration) * 100) : 0;
  const volume = audioState.isMuted ? 0 : audioState.volume ?? 60;
  const status = audioState.status || (audioState.isPlaying ? 'playing' : 'paused');

  const statusInfo: { text: string; tone: 'ok' | 'warn' | 'err' | 'idle' } =
    status === 'playing'
      ? { text: '● Sedang diputar', tone: 'ok' }
      : status === 'buffering' || status === 'loading'
        ? { text: audioState.ready ? 'Memuat audio…' : 'Menyiapkan YouTube player…', tone: 'warn' }
        : status === 'error'
          ? { text: `⚠ ${audioState.error || 'Video tidak dapat diputar'}`, tone: 'err' }
          : { text: 'Dijeda — tekan ▶ untuk memutar', tone: 'idle' };

  const isBusy = status === 'loading' || status === 'buffering';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      maxWidth="1040px"
      fixedHeight="min(86vh, 760px)"
      title="YouTube Music Player"
      subtitle={`Playlist Raffa · ${USER_PLAYLIST.length} lagu · Shortcut: P play/pause, M mute`}
      icon={<span>🎧</span>}
    >
      <div className={styles.layout}>
        {/* ─────────── Now Playing ─────────── */}
        <section className={styles.nowPlaying} aria-label="Sedang diputar">
          <div className={styles.artWrap}>
            <div className={styles.vinyl(status === 'playing')} />
            <div className={styles.art}>
              <img
                src={currentTrack?.cover || `https://i.ytimg.com/vi/${currentTrack?.videoId}/hqdefault.jpg`}
                alt={currentTrack?.title || 'Cover'}
              />
            </div>
          </div>

          <div className={styles.meta}>
            <div className={styles.title} title={currentTrack?.title}>
              {currentTrack?.title || 'Belum ada lagu'}
            </div>
            <div className={styles.artist}>
              <span className={styles.ytBadge}>YT MUSIC</span>
              <span>{currentTrack?.artist || 'YouTube Music'}</span>
            </div>
          </div>

          <div className={styles.statusLine(statusInfo.tone)}>{statusInfo.text}</div>

          <div className={styles.progressWrap}>
            <input
              type="range"
              aria-label="Posisi lagu"
              min={0}
              max={duration || 1}
              step={0.5}
              value={Math.min(shownTime, duration || 1)}
              disabled={!duration}
              className={styles.range(pct)}
              onChange={(e) => setScrub(Number(e.target.value))}
              onMouseUp={() => {
                if (scrub !== null) onSeek(scrub);
                setScrub(null);
              }}
              onTouchEnd={() => {
                if (scrub !== null) onSeek(scrub);
                setScrub(null);
              }}
              onKeyUp={() => {
                if (scrub !== null) onSeek(scrub);
                setScrub(null);
              }}
            />
            <div className={styles.timeRow}>
              <span>{formatTime(shownTime)}</span>
              <span>{duration ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.iconBtn(isShuffle)}
              onClick={onToggleShuffle}
              title={isShuffle ? 'Shuffle: aktif' : 'Shuffle: nonaktif'}
              aria-pressed={isShuffle}
            >
              <Shuffle size={16} />
            </button>
            <button type="button" className={styles.iconBtn()} onClick={onPrevTrack} title="Sebelumnya">
              <SkipBack size={16} />
            </button>
            <button
              type="button"
              className={styles.playBtn}
              onClick={onTogglePlay}
              title={status === 'playing' ? 'Jeda (P)' : 'Putar (P)'}
              aria-label={status === 'playing' ? 'Jeda' : 'Putar'}
            >
              {isBusy ? <span className={styles.spinner} /> : status === 'playing' ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button type="button" className={styles.iconBtn()} onClick={onNextTrack} title="Berikutnya">
              <SkipForward size={16} />
            </button>
            <button

              type="button"
              className={styles.iconBtn(repeatMode !== 'off')}
              onClick={onCycleRepeat}
              title={`Repeat: ${repeatMode === 'off' ? 'mati' : repeatMode === 'all' ? 'semua' : 'satu lagu'}`}
            >
              <Repeat size={16} />
              {repeatMode === 'one' && <span className={styles.repeatOne}>1</span>}
            </button>
          </div>

          <div className={styles.volumeRow}>
            <button
              type="button"
              className={styles.iconBtn(audioState.isMuted)}
              onClick={onToggleMute}
              title={audioState.isMuted ? 'Nyalakan suara (M)' : 'Bisukan (M)'}
              style={{ width: 34, height: 34 }}
            >
              {audioState.isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 50 ? <Volume1 size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={100}
              value={volume}
              className={styles.range(volume)}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
            <span className={styles.volLabel}>{volume}%</span>
          </div>
        </section>

        {/* ─────────── Playlist / Custom ─────────── */}
        <section className={styles.side} aria-label="Playlist">
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" className={styles.tab(tab === 'playlist')} onClick={() => setTab('playlist')}>
              <Music size={14} style={{ display: 'inline', marginRight: 6 }} />
              Playlist ({USER_PLAYLIST.length})
            </button>
            <button type="button" role="tab" className={styles.tab(tab === 'custom')} onClick={() => setTab('custom')}>
              <Link2 size={14} style={{ display: 'inline', marginRight: 6 }} />
              URL YouTube
            </button>
          </div>
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} /> Default: Executive Lo-Fi Focus
              </div>
              <div style={{ fontSize: 11, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                YouTube Music Playlist ({DEFAULT_PLAYLIST_ID})
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPlayCustomUrl(DEFAULT_PLAYLIST_URL, 'Executive Lo-Fi & Focus Beats', 'YouTube Music')}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: '#10b981', color: '#04241a', border: 'none', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Play size={11} /> Putar Default
            </button>
          </div>

          {tab === 'playlist' ? (
            <>
              <input
                type="search"
                className={styles.input}
                placeholder="Cari judul lagu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className={styles.list}>
                {filtered.map(({ track, index }) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <button
                      key={track.videoId}
                      type="button"
                      className={styles.row(active)}
                      onClick={() => onSelectTrack(track, index)}
                    >
                      <span className={styles.idx}>
                        {active && status === 'playing' ? (
                          <span className={styles.eq}>
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <img className={styles.thumb} src={track.cover} alt="" loading="lazy" />
                      <span style={{ minWidth: 0 }}>
                        <div className={styles.rowTitle(active)}>{track.title}</div>
                        <div className={styles.rowSub}>{track.artist}</div>
                      </span>
                      <span style={{ fontSize: 11, color: active ? '#6ee7b7' : '#52525b' }}>{active ? 'Diputar' : '▶'}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 12 }}>
                    Tidak ada lagu yang cocok dengan “{query}”.
                  </div>
                )}
              </div>
            </>
          ) : (
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                if (!customValid) return;
                onPlayCustomUrl(customUrl.trim(), customTitle.trim(), customArtist.trim());
                setCustomUrl('');
                setCustomTitle('');
                setCustomArtist('');
                setTab('playlist');
              }}
            >
              <label className={styles.label}>
                URL YouTube / YouTube Music
                <input
                  className={styles.input}
                  placeholder="https://music.youtube.com/watch?v=… atau https://youtu.be/…"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
                {customUrl && (
                  <small style={{ fontSize: 11, color: customValid ? '#6ee7b7' : '#fca5a5', fontWeight: 500 }}>
                    {customValid
                      ? `✓ Terdeteksi ${parsedCustom.playlistId ? `playlist ${parsedCustom.playlistId}` : `video ${parsedCustom.videoId}`}`
                      : '✕ URL tidak dikenali sebagai link YouTube'}
                  </small>
                )}
              </label>
              <div className={styles.twoCol}>
                <label className={styles.label}>
                  Judul (opsional)
                  <input className={styles.input} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Artis (opsional)
                  <input className={styles.input} value={customArtist} onChange={(e) => setCustomArtist(e.target.value)} />
                </label>
              </div>
              <button type="submit" className={styles.submit} disabled={!customValid}>
                ▶ Putar Sekarang
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}
