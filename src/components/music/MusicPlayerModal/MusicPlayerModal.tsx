'use client';

import React, { useMemo, useState } from 'react';
import Modal from '../../ui/Modal';
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
  onSelectTrack: (track: (typeof USER_PLAYLIST)[number], index: number) => void;
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

const SCROLLBAR = '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.14)_transparent]';

/** Range input styling: filled track up to `pct`, using the accent gradient. */
const rangeClass =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 ' +
  '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(16,185,129,0.25)] ' +
  '[&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-white';

const rangeStyle = (pct: number): React.CSSProperties => ({
  background: `linear-gradient(90deg, #10b981 0%, #34d399 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
});

const iconBtnClass = (active = false) =>
  `relative grid h-11 w-11 cursor-pointer place-items-center rounded-xl border text-[15px] transition-all duration-150 hover:bg-white/10 hover:text-white ${
    active ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'border-white/[0.08] bg-white/[0.04] text-zinc-300'
  }`;

const labelClass = 'flex flex-col gap-2 text-xs font-semibold text-zinc-300';
const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500/60 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] transition';

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
  // Local scrub position while the user drags; null = follow the audio engine.
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
  const isPlaying = status === 'playing';
  const isBusy = status === 'loading' || status === 'buffering';

  const statusInfo: { text: string; tone: 'ok' | 'warn' | 'err' | 'idle' } =
    status === 'playing'
      ? { text: '● Sedang diputar', tone: 'ok' }
      : isBusy
        ? { text: audioState.ready ? 'Memuat audio…' : 'Menyiapkan YouTube player…', tone: 'warn' }
        : status === 'error'
          ? { text: `⚠ ${audioState.error || 'Video tidak dapat diputar'}`, tone: 'err' }
          : { text: 'Dijeda — tekan ▶ untuk memutar', tone: 'idle' };

  const statusToneClass = {
    ok: 'bg-emerald-500/10 text-emerald-300',
    warn: 'bg-amber-500/10 text-amber-300',
    err: 'bg-red-500/10 text-red-300',
    idle: 'bg-white/5 text-zinc-400',
  }[statusInfo.tone];

  const commitScrub = () => {
    if (scrub !== null) onSeek(scrub);
    setScrub(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      maxWidth="1160px"
      fixedHeight="min(90vh, 800px)"
      title="YouTube Music Player"
      subtitle={`Playlist Raffa · ${USER_PLAYLIST.length} lagu · Shortcut: P play/pause, M mute`}
      icon={<span>🎧</span>}
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-6 max-[860px]:h-auto min-[861px]:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        {/* ─────────── Now Playing ─────────── */}
        <section
          aria-label="Sedang diputar"
          className="flex flex-col items-center gap-5.5 rounded-3xl border border-white/[0.08] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(16,185,129,0.16),transparent_60%),rgba(255,255,255,0.025)] p-6 md:p-7 max-[860px]:p-5 shadow-sm"
        >
          <div className="relative aspect-square w-[min(100%,240px)] max-[860px]:w-[min(62vw,200px)]">
            <div
              className={`absolute inset-[6%] rounded-full bg-[repeating-radial-gradient(circle,#111_0_2px,#1b1b1f_2px_4px)] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] animate-[spin-vinyl_6s_linear_infinite] ${
                isPlaying ? 'translate-x-[18%]' : 'translate-x-0 [animation-play-state:paused]'
              }`}
            />
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/12 shadow-[0_20px_40px_rgba(0,0,0,0.55)]">
              <img
                className="h-full w-full object-cover"
                src={currentTrack?.cover || `https://i.ytimg.com/vi/${currentTrack?.videoId}/hqdefault.jpg`}
                alt={currentTrack?.title || 'Cover'}
              />
            </div>
          </div>

          <div className="w-full min-w-0 text-center">
            <div title={currentTrack?.title} className="line-clamp-2 text-base font-bold leading-snug text-white">
              {currentTrack?.title || 'Belum ada lagu'}
            </div>
            <div className="mt-1.5 inline-flex items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-red-300">
                YT MUSIC
              </span>
              <span>{currentTrack?.artist || 'YouTube Music'}</span>
            </div>
          </div>

          <div className={`max-w-full rounded-full px-3.5 py-1 text-center text-xs font-semibold ${statusToneClass}`}>
            {statusInfo.text}
          </div>

          <div className="flex w-full flex-col gap-2">
            <input
              type="range"
              aria-label="Posisi lagu"
              min={0}
              max={duration || 1}
              step={0.5}
              value={Math.min(shownTime, duration || 1)}
              disabled={!duration}
              className={rangeClass}
              style={rangeStyle(pct)}
              onChange={(e) => setScrub(Number(e.target.value))}
              onMouseUp={commitScrub}
              onTouchEnd={commitScrub}
              onKeyUp={commitScrub}
            />
            <div className="flex justify-between font-mono text-xs tabular-nums text-zinc-400">
              <span>{formatTime(shownTime)}</span>
              <span>{duration ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3.5">
            <button
              type="button"
              className={iconBtnClass(isShuffle)}
              onClick={onToggleShuffle}
              title={isShuffle ? 'Shuffle: aktif' : 'Shuffle: nonaktif'}
              aria-label="Shuffle"
              aria-pressed={isShuffle}
            >
              <Shuffle size={16} />
            </button>
            <button type="button" className={iconBtnClass()} onClick={onPrevTrack} title="Sebelumnya" aria-label="Lagu sebelumnya">
              <SkipBack size={16} />
            </button>
            <button
              type="button"
              className="grid h-15 w-15 cursor-pointer place-items-center rounded-full border-none bg-gradient-to-br from-emerald-400 to-emerald-500 text-xl text-[#04241a] shadow-[0_10px_26px_rgba(16,185,129,0.45)] transition-transform duration-150 hover:scale-105 active:scale-95"
              onClick={onTogglePlay}
              title={isPlaying ? 'Jeda (P)' : 'Putar (P)'}
              aria-label={isPlaying ? 'Jeda' : 'Putar'}
            >
              {isBusy ? (
                <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-[#04241a]/30 border-t-[#04241a]" />
              ) : isPlaying ? (
                <Pause size={22} />
              ) : (
                <Play size={22} className="ml-0.5" />
              )}
            </button>
            <button type="button" className={iconBtnClass()} onClick={onNextTrack} title="Berikutnya" aria-label="Lagu berikutnya">
              <SkipForward size={16} />
            </button>
            <button
              type="button"
              className={iconBtnClass(repeatMode !== 'off')}
              onClick={onCycleRepeat}
              title={`Repeat: ${repeatMode === 'off' ? 'mati' : repeatMode === 'all' ? 'semua' : 'satu lagu'}`}
              aria-label="Repeat"
            >
              <Repeat size={16} />
              {repeatMode === 'one' && <span className="absolute right-[5px] top-[3px] text-[8px] font-black">1</span>}
            </button>
          </div>

          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              className={`${iconBtnClass(audioState.isMuted)} h-9 w-9`}
              onClick={onToggleMute}
              title={audioState.isMuted ? 'Nyalakan suara (M)' : 'Bisukan (M)'}
              aria-label={audioState.isMuted ? 'Nyalakan suara' : 'Bisukan'}
            >
              {audioState.isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 50 ? <Volume1 size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={100}
              value={volume}
              className={rangeClass}
              style={rangeStyle(volume)}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
            <span className="w-9 text-right text-xs tabular-nums text-zinc-400 font-mono">{volume}%</span>
          </div>
        </section>

        {/* ─────────── Playlist / Custom ─────────── */}
        <section className="flex min-h-0 min-w-0 flex-col gap-3" aria-label="Playlist">
          <div role="tablist" className="flex gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'playlist'}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-none px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                tab === 'playlist' ? 'bg-white/10 text-white shadow-sm' : 'bg-transparent text-zinc-400 hover:text-white'
              }`}
              onClick={() => setTab('playlist')}
            >
              <Music size={15} />
              Playlist ({USER_PLAYLIST.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'custom'}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-none px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                tab === 'custom' ? 'bg-white/10 text-white shadow-sm' : 'bg-transparent text-zinc-400 hover:text-white'
              }`}
              onClick={() => setTab('custom')}
            >
              <Link2 size={15} />
              URL YouTube
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Sparkles size={14} /> Default: Executive Lo-Fi Focus
              </div>
              <div className="truncate text-xs text-zinc-400 mt-0.5">YouTube Music Playlist ({DEFAULT_PLAYLIST_ID})</div>
            </div>
            <button
              type="button"
              onClick={() => onPlayCustomUrl(DEFAULT_PLAYLIST_URL, 'Executive Lo-Fi & Focus Beats', 'YouTube Music')}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border-none bg-emerald-500 px-3.5 py-2 text-xs font-bold text-[#04241a] transition hover:bg-emerald-400"
            >
              <Play size={12} /> Putar Default
            </button>
          </div>

          {tab === 'playlist' ? (
            <>
              <input
                type="search"
                className={inputClass}
                placeholder="Cari judul lagu…"
                aria-label="Cari judul lagu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 max-[860px]:max-h-[46vh] ${SCROLLBAR}`}>
                {filtered.map(({ track, index }) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <button
                      key={track.videoId}
                      type="button"
                      onClick={() => onSelectTrack(track, index)}
                      className={`grid w-full cursor-pointer grid-cols-[28px_48px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 text-left text-inherit transition-all duration-100 hover:bg-white/5 ${
                        active ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'border-transparent bg-transparent'
                      }`}
                    >
                      <span className="text-right font-mono text-xs text-zinc-500">
                        {active && isPlaying ? (
                          <span className="inline-flex h-3.5 items-end gap-0.5">
                            <i className="block h-full w-[3px] origin-bottom rounded-[1px] bg-emerald-500 animate-[eq-bounce_0.9s_ease-in-out_infinite]" />
                            <i className="block h-full w-[3px] origin-bottom rounded-[1px] bg-emerald-500 animate-[eq-bounce_0.9s_ease-in-out_infinite_0.2s]" />
                            <i className="block h-full w-[3px] origin-bottom rounded-[1px] bg-emerald-500 animate-[eq-bounce_0.9s_ease-in-out_infinite_0.4s]" />
                          </span>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <img className="h-9 w-12 rounded-xl bg-zinc-900 object-cover shadow-sm" src={track.cover} alt="" loading="lazy" />
                      <span className="min-w-0">
                        <div className={`truncate text-sm font-semibold ${active ? 'text-emerald-300' : 'text-zinc-100'}`}>{track.title}</div>
                        <div className="truncate text-xs text-zinc-500 mt-0.5">{track.artist}</div>
                      </span>
                      <span className={`text-xs font-semibold ${active ? 'text-emerald-300 font-bold' : 'text-zinc-600'}`}>{active ? 'Diputar' : '▶'}</span>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="p-10 text-center text-xs text-zinc-500">Tidak ada lagu yang cocok dengan “{query}”.</div>
                )}
              </div>
            </>
          ) : (
            <form
              className="flex flex-col gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-4"
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
              <label className={labelClass}>
                URL YouTube / YouTube Music
                <input
                  className={inputClass}
                  placeholder="https://music.youtube.com/watch?v=… atau https://youtu.be/…"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
                {customUrl && (
                  <small className={`text-[11px] font-medium ${customValid ? 'text-emerald-300' : 'text-red-300'}`}>
                    {customValid
                      ? `✓ Terdeteksi ${parsedCustom.playlistId ? `playlist ${parsedCustom.playlistId}` : `video ${parsedCustom.videoId}`}`
                      : '✕ URL tidak dikenali sebagai link YouTube'}
                  </small>
                )}
              </label>
              <div className="grid grid-cols-1 gap-2.5 min-[521px]:grid-cols-2">
                <label className={labelClass}>
                  Judul (opsional)
                  <input className={inputClass} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                </label>
                <label className={labelClass}>
                  Artis (opsional)
                  <input className={inputClass} value={customArtist} onChange={(e) => setCustomArtist(e.target.value)} />
                </label>
              </div>
              <button
                type="submit"
                disabled={!customValid}
                className="cursor-pointer rounded-[11px] border-none bg-gradient-to-br from-emerald-400 to-emerald-500 px-4 py-[11px] text-[13px] font-extrabold text-[#04241a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ▶ Putar Sekarang
              </button>
            </form>
          )}
        </section>
      </div>
    </Modal>
  );
}
