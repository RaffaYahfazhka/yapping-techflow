/**
 * YouTube IFrame Player API audio engine.
 *
 * - The IFrame API loader is a shared singleton promise. Each engine instance owns
 *   only its own player mount inside the React-managed host element.
 * - Every asynchronous callback re-checks `destroyed`, so React Strict Mode
 *   double-mounts and unmounts cannot leave orphaned players or timers behind.
 * - Public method names and option shape are the UI contract used by page.tsx
 *   and the music player components. Do not rename them.
 */

export type AudioStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

export interface AudioEngineState {
  ready: boolean;
  status: AudioStatus;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  volume: number;
  isMuted: boolean;
}

export interface AudioEngineTime {
  currentTime: number;
  duration: number;
}

export interface AudioEngineOptions {
  videoId?: string;
  containerId?: string;
  onStateChange?: (state: AudioEngineState) => void;
  onTimeUpdate?: (time: AudioEngineTime) => void;
  onEnded?: () => void;
  onTrackChange?: (track: { videoId: string; title: string; artist: string; cover: string }) => void;
}

/** Subset of the YouTube IFrame player instance used by this engine. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  loadPlaylist(options: { list: string; listType: 'playlist' }): void;
  cuePlaylist(options: { list: string; listType: 'playlist' }): void;
  nextVideo(): void;
  previousVideo(): void;
  setShuffle(shuffle: boolean): void;
  setLoop(loop: boolean): void;
  getVideoData(): { video_id?: string; title?: string; author?: string };
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

export interface YTPlayerEvent<T> {
  data: T;
}

export interface YTPlayerOptions {
  height: string;
  width: string;
  videoId: string;
  playerVars: Record<string, number>;
  events: {
    onReady: () => void;
    onStateChange: (event: YTPlayerEvent<number>) => void;
    onError: (event: YTPlayerEvent<number>) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

type YTWindow = Window & {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

const DEFAULT_VIDEO_ID = 'NA7hmTexZ0E';
const DEFAULT_CONTAINER_ID = 'yt-player-host';
const YT_API_SCRIPT_ID = 'yt-iframe-script';
const YT_API_SRC = 'https://www.youtube.com/iframe_api';
const YT_API_TIMEOUT_MS = 15000;
const YT_API_POLL_MS = 250;
const HOST_RETRY_MS = 300;
const PROGRESS_POLL_MS = 250;
const AUTO_SKIP_DELAY_MS = 800;
const AUTO_SKIP_MAX_CONSECUTIVE = 3;
/** YouTube error codes meaning the video itself cannot be played; these are skipped. */
const SKIPPABLE_ERROR_CODES: readonly number[] = [100, 101, 150];

const YT_ERRORS: Readonly<Record<number, string>> = {
  2: 'Video ID tidak valid',
  5: 'Video tidak bisa diputar di player HTML5',
  100: 'Video tidak ditemukan / private',
  101: 'Pemilik video melarang embed',
  150: 'Pemilik video melarang embed',
};

let ytApiPromise: Promise<YTNamespace> | null = null;

function readYouTubeNamespace(): YTNamespace | undefined {
  const YT = (window as YTWindow).YT;
  return YT?.Player ? YT : undefined;
}

/** Loads the IFrame API once per page. Concurrent callers share the same promise. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  const ready = readYouTubeNamespace();
  if (ready) return Promise.resolve(ready);
  if (ytApiPromise) return ytApiPromise;

  const { promise, resolve, reject } = Promise.withResolvers<YTNamespace>();
  ytApiPromise = promise;

  const ytWindow = window as YTWindow;
  let settled = false;
  let poll = 0;

  const succeed = (): void => {
    const YT = readYouTubeNamespace();
    if (settled || !YT) return;
    settled = true;
    window.clearInterval(poll);
    resolve(YT);
  };

  const fail = (error: Error): void => {
    if (settled) return;
    settled = true;
    window.clearInterval(poll);
    ytApiPromise = null;
    reject(error);
  };

  // Chain any ready-callback installed by another script instead of overwriting it.
  const previousReady = ytWindow.onYouTubeIframeAPIReady;
  ytWindow.onYouTubeIframeAPIReady = () => {
    try {
      previousReady?.();
    } catch (error: unknown) {
      console.warn('[AudioEngine] Callback YouTube sebelumnya gagal', error);
    }
    succeed();
  };

  if (!document.getElementById(YT_API_SCRIPT_ID)) {
    const tag = document.createElement('script');
    tag.id = YT_API_SCRIPT_ID;
    tag.src = YT_API_SRC;
    tag.async = true;
    tag.onerror = () => {
      // Remove the failed tag so a later attempt can inject a fresh one.
      tag.remove();
      fail(new Error('Gagal memuat YouTube IFrame API (cek koneksi / adblock).'));
    };
    document.head.appendChild(tag);
  }

  // Safety net: the global callback may be overwritten by another script.
  const started = Date.now();
  poll = window.setInterval(() => {
    if (readYouTubeNamespace()) succeed();
    else if (Date.now() - started > YT_API_TIMEOUT_MS) fail(new Error('Timeout memuat YouTube IFrame API.'));
  }, YT_API_POLL_MS);

  return promise;
}

export class AudioEngine {
  videoId: string;
  playlistId: string | null = null;
  trackTitle: string | null = null;
  trackArtist: string | null = null;

  private readonly containerId: string;
  private readonly onStateChange: (state: AudioEngineState) => void;
  private readonly onTimeUpdate: (time: AudioEngineTime) => void;
  private readonly onEnded: () => void;
  private readonly onTrackChange: NonNullable<AudioEngineOptions['onTrackChange']>;
  private reportedVideoId = '';

  player: YTPlayer | null = null;
  mountEl: HTMLDivElement | null = null;
  isReady = false;
  wantsPlay = false;
  status: AudioStatus = 'idle';
  errorMessage: string | null = null;
  isMuted = false;
  volume = 60;
  duration = 0;
  currentTime = 0;
  destroyed = false;
  initRequested = false;
  /** Video id the live player is currently showing (for ready-time reconciliation). */
  mountedVideoId: string | null = null;
  consecutiveErrors = 0;

  private pollTimer: number | undefined;
  private hostTimer: number | undefined;
  private errorTimer: number | undefined;

  constructor(options: AudioEngineOptions = {}) {
    this.videoId = options.videoId || DEFAULT_VIDEO_ID;
    this.containerId = options.containerId || DEFAULT_CONTAINER_ID;
    this.onStateChange = options.onStateChange || (() => {});
    this.onTimeUpdate = options.onTimeUpdate || (() => {});
    this.onEnded = options.onEnded || (() => {});
    this.onTrackChange = options.onTrackChange ?? (() => {});
  }

  /* ───────────────────────── lifecycle ───────────────────────── */

  init(): void {
    if (typeof window === 'undefined' || this.destroyed || this.initRequested) return;
    this.initRequested = true;
    this.setStatus('loading');
    loadYouTubeApi()
      .then(() => {
        if (!this.destroyed) this.createPlayer();
      })
      .catch((error: unknown) => {
        if (this.destroyed) return;
        this.initRequested = false;
        this.errorMessage = error instanceof Error ? error.message : 'Gagal memuat YouTube player.';
        this.setStatus('error');
      });
  }

  createPlayer(): void {
    const YT = readYouTubeNamespace();
    if (this.destroyed || this.player || !YT) return;

    const host = document.getElementById(this.containerId);
    if (!host) {
      // Host can mount after the API; retry once per pending interval.
      if (this.hostTimer !== undefined) return;
      this.hostTimer = window.setTimeout(() => {
        this.hostTimer = undefined;
        this.createPlayer();
      }, HOST_RETRY_MS);
      return;
    }

    // The engine's own mount node: the React-managed host element is never replaced.
    host.innerHTML = '';
    const mount = document.createElement('div');
    host.appendChild(mount);
    this.mountEl = mount;

    try {
      this.player = new YT.Player(mount, {
        height: '200',
        width: '200',
        videoId: this.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: () => this.handleReady(),
          onStateChange: (event) => this.handleYtState(event.data),
          onError: (event) => this.handleYtError(event.data),
        },
      });
      this.mountedVideoId = this.videoId;
    } catch (error: unknown) {
      this.mountEl = null;
      mount.remove();
      this.initRequested = false;
      this.errorMessage = error instanceof Error ? error.message : 'Gagal membuat YouTube player.';
      this.setStatus('error');
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopPolling();
    window.clearTimeout(this.hostTimer);
    window.clearTimeout(this.errorTimer);
    this.hostTimer = undefined;
    this.errorTimer = undefined;
    try {
      this.player?.destroy();
    } catch (error: unknown) {
      console.warn('[AudioEngine] destroy player gagal', error);
    }
    this.player = null;
    this.isReady = false;
    this.mountEl?.remove();
    this.mountEl = null;
  }

  /* ───────────────────────── YT events ───────────────────────── */

  private handleReady(): void {
    if (this.destroyed) return;
    this.isReady = true;
    this.applyVolume();

    // Reconcile the live player with the latest requested media; requests made before ready are applied here.
    const list = this.playlistId;
    if (list) {
      const options = { list, listType: 'playlist' as const };
      if (this.wantsPlay) this.invoke('loadPlaylist', (p) => p.loadPlaylist(options));
      else this.invoke('cuePlaylist', (p) => p.cuePlaylist(options));
    } else if (this.mountedVideoId !== this.videoId) {
      const target = this.videoId;
      if (this.wantsPlay) this.invoke('loadVideoById', (p) => p.loadVideoById(target));
      else this.invoke('cueVideoById', (p) => p.cueVideoById(target));
      this.mountedVideoId = target;
    }

    if (this.wantsPlay) {
      this.invoke('playVideo', (p) => p.playVideo());
      this.setStatus('buffering');
    } else {
      this.setStatus('paused');
    }
    this.startPolling();
  }

  handleYtState(code: number): void {
    if (this.destroyed) return;
    // -1 UNSTARTED, 0 ENDED, 1 PLAYING, 2 PAUSED, 3 BUFFERING, 5 CUED
    switch (code) {
      case 1:
        this.consecutiveErrors = 0;
        this.errorMessage = null;
        this.wantsPlay = true;
        this.setStatus('playing');
        break;
      case 2:
        // Do not clear wantsPlay: YouTube can emit a brief pause while loading.
        this.setStatus('paused');
        break;
      case 3:
        this.setStatus('buffering');
        break;
      case 0:
        this.setStatus('ended');
        // YouTube owns progression within a loaded playlist; the local DJ queue
        // is advanced by the application only for individually loaded videos.
        if (!this.playlistId && this.wantsPlay) this.onEnded();
        break;
      case 5:
        if (this.wantsPlay) this.invoke('playVideo', (p) => p.playVideo());
        else this.setStatus('paused');
        break;
      case -1:
        if (this.wantsPlay) this.invoke('playVideo', (p) => p.playVideo());
        break;
      default:
        break;
    }
    this.emitTime();
  }

  handleYtError(code: number): void {
    if (this.destroyed) return;
    this.errorMessage = YT_ERRORS[code] ?? `YouTube error ${code}`;
    console.warn('[AudioEngine]', this.errorMessage, `(code ${code}, video ${this.videoId})`);
    this.consecutiveErrors += 1;
    this.setStatus('error');
    // Auto-skip only permanently unplayable videos, at most 3 times in a row.
    if (!this.playlistId && this.wantsPlay && SKIPPABLE_ERROR_CODES.includes(code) && this.consecutiveErrors <= AUTO_SKIP_MAX_CONSECUTIVE) {
      window.clearTimeout(this.errorTimer);
      this.errorTimer = window.setTimeout(() => {
        this.errorTimer = undefined;
        if (!this.destroyed) this.onEnded();
      }, AUTO_SKIP_DELAY_MS);
    }
  }

  /* ───────────────────────── controls ───────────────────────── */

  loadTrack(videoId: string, title?: string, artist?: string): void {
    if (!videoId || this.destroyed) return;
    this.videoId = videoId;
    this.playlistId = null;
    this.trackTitle = title ?? null;
    this.trackArtist = artist ?? null;
    this.wantsPlay = true;
    this.currentTime = 0;
    this.duration = 0;
    this.errorMessage = null;
    this.emitTime();

    if (this.player && this.isReady) {
      this.invoke('loadVideoById', (p) => p.loadVideoById(videoId));
      this.mountedVideoId = videoId;
      this.applyVolume();
      this.invoke('playVideo', (p) => p.playVideo());
      this.setStatus('buffering');
    } else {
      // Player not ready yet: onReady reconciles to this.videoId.
      this.setStatus('loading');
      this.init();
    }
  }

  loadPlaylist(playlistId: string, autoplay = true): void {
    if (!playlistId || this.destroyed) return;
    this.playlistId = playlistId;
    this.wantsPlay = autoplay;
    this.currentTime = 0;
    this.duration = 0;
    this.errorMessage = null;
    this.emitTime();

    if (this.player && this.isReady) {
      const options = { list: playlistId, listType: 'playlist' as const };
      if (autoplay) this.invoke('loadPlaylist', (p) => p.loadPlaylist(options));
      else this.invoke('cuePlaylist', (p) => p.cuePlaylist(options));
      this.applyVolume();
      this.setStatus(autoplay ? 'buffering' : 'paused');
    } else {
      // Not ready yet: onReady applies the request (cue or load) to the live player.
      this.setStatus('loading');
      this.init();
    }
  }

  nextPlaylistTrack(): void {
    if (this.playlistId) this.invoke('nextVideo', (p) => p.nextVideo());
  }

  previousPlaylistTrack(): void {
    if (this.playlistId) this.invoke('previousVideo', (p) => p.previousVideo());
  }

  configurePlaylist(shuffle: boolean, loop: boolean): void {
    this.invoke('setShuffle', (p) => p.setShuffle(shuffle));
    this.invoke('setLoop', (p) => p.setLoop(loop));
  }

  play(): void {
    if (this.destroyed) return;
    this.wantsPlay = true;
    if (this.player && this.isReady) {
      this.applyVolume();
      this.invoke('playVideo', (p) => p.playVideo());
      if (this.status !== 'playing') this.setStatus('buffering');
    } else {
      this.setStatus('loading');
      this.init();
    }
  }

  pause(): void {
    if (this.destroyed) return;
    this.wantsPlay = false;
    this.invoke('pauseVideo', (p) => p.pauseVideo());
    this.setStatus('paused');
  }

  togglePlay(): void {
    if (this.status === 'playing' || this.status === 'buffering' || (this.status === 'loading' && this.wantsPlay)) {
      this.pause();
    } else {
      this.play();
    }
  }

  setVolume(vol: number): void {
    const n = Number(vol);
    this.volume = Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
    if (this.volume > 0 && this.isMuted) this.isMuted = false;
    this.applyVolume();
    this.emitState();
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.applyVolume();
    this.emitState();
  }

  seekTo(seconds: number): void {
    if (this.destroyed) return;
    const n = Number(seconds);
    const sec = Math.max(0, Number.isFinite(n) ? n : 0);
    this.currentTime = sec;
    this.invoke('seekTo', (p) => p.seekTo(sec, true));
    this.emitTime();
  }

  /* ───────────────────────── internals ───────────────────────── */

  /** Runs a player call; a throwing player never breaks engine state. */
  private invoke<T>(action: string, call: (player: YTPlayer) => T): T | undefined {
    const player = this.player;
    if (!player) return undefined;
    try {
      return call(player);
    } catch (error: unknown) {
      console.warn(`[AudioEngine] ${action} gagal`, error);
      return undefined;
    }
  }

  private applyVolume(): void {
    if (!this.player || !this.isReady) return;
    const volume = this.volume;
    this.invoke('setVolume', (p) => p.setVolume(volume));
    if (this.isMuted || volume === 0) this.invoke('mute', (p) => p.mute());
    else this.invoke('unMute', (p) => p.unMute());
  }

  private setStatus(status: AudioStatus): void {
    this.status = status;
    this.emitState();
  }

  private emitState(): void {
    this.onStateChange({
      ready: this.isReady,
      status: this.status,
      isPlaying: this.status === 'playing',
      isLoading: this.status === 'loading' || this.status === 'buffering',
      error: this.status === 'error' ? this.errorMessage : null,
      volume: this.volume,
      isMuted: this.isMuted,
    });
  }

  private emitTime(): void {
    this.onTimeUpdate({ currentTime: this.currentTime, duration: this.duration });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => this.pollProgress(), PROGRESS_POLL_MS);
  }

  private pollProgress(): void {
    if (this.destroyed || !this.player || !this.isReady) return;
    const track = this.invoke('getVideoData', (p) => p.getVideoData());
    if (track?.video_id && track.video_id !== this.reportedVideoId) {
      this.reportedVideoId = track.video_id;
      this.onTrackChange({
        videoId: track.video_id,
        title: track.title || 'YouTube Music',
        artist: track.author || 'YouTube Music',
        cover: `https://i.ytimg.com/vi/${track.video_id}/mqdefault.jpg`,
      });
    }
    const cur = this.invoke('getCurrentTime', (p) => p.getCurrentTime());
    const dur = this.invoke('getDuration', (p) => p.getDuration());
    let changed = false;
    if (typeof cur === 'number' && Number.isFinite(cur) && Math.abs(cur - this.currentTime) > 0.05) {
      this.currentTime = cur;
      changed = true;
    }
    if (typeof dur === 'number' && dur > 0 && dur !== this.duration) {
      this.duration = dur;
      changed = true;
    }
    if (changed) this.emitTime();
  }

  private stopPolling(): void {
    window.clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
}
