'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { OfficeScene } from '../lib/engine/officeScene';
import { AudioEngine } from '../lib/engine/audioEngine';
import { PipelineRunner } from '../lib/engine/pipelineRunner';
import { readScreenInput } from '../lib/engine/movement';
import { AGENTS, BOSS } from '../lib/data/agents';
import { REPOS } from '../lib/data/repos';
import { TICKETS } from '../lib/data/tickets';
import { parseFigmaInput } from '../lib/data/figma';
import { USER_PLAYLIST, DEFAULT_PLAYLIST_ID } from '../lib/data/userPlaylist';

// Modular Components
import Navbar from '../components/navigation/Navbar';
import TeamDirectoryModal from '../components/cards/TeamDirectoryModal';
import MissionControlModal from '../components/mission/MissionControlModal';
import MusicPlayerWidget from '../components/music/MusicPlayerWidget';
import MusicPlayerModal, { RepeatMode } from '../components/music/MusicPlayerModal';
import SplashScreen from '../components/ui/SplashScreen';
import OfficeMinimap, { blipsFromScene, type Blip } from '@/components/map/OfficeMinimap';
import { clockWibString, type SkyPhase } from '@/lib/engine/skyEngine';
import OfficeGroupChatModal from '@/components/chat/OfficeGroupChatModal';
import SkyDartsModal from '@/components/minigames/SkyDartsModal';
import RetroArcadeModal from '@/components/minigames/RetroArcadeModal';
import BossWardrobeModal, { type WardrobePreset } from '@/components/executive/BossWardrobeModal';
import PhotoModeController from '@/components/executive/PhotoModeController';
import NotificationToasts, { useNotificationToasts, type ToastKind } from '@/components/ui/NotificationToasts';
import WallboardHologram from '@/components/canvas/WallboardHologram';
import { createEmployeeSim, employeeStateTick, applyEmployeeTreat, applyWeatherToSim, visibleBubble, type EmployeeSim, type OfficeEvent } from '@/lib/engine/socialEngine';
import { fetchEmployeeDialogue, createAiSpeechBubble } from '@/lib/engine/employeeDialogue';
import TerminalDrawer from '../components/terminal/TerminalDrawer';
import SubordinateModal from '../components/SubordinateModal';
import TradingBotsModal from '../components/finance/TradingBotsModal';
import KhansaChatModal from '../components/khansa/KhansaChatModal';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Compass, Coffee, Shirt, Target, Gamepad2, Camera, BarChart3, PartyPopper } from 'lucide-react';
import { Dock, DockItem } from '@/components/ui/dock';
import { HaloButton } from '@/components/ui/halo-button';
import { HaloBadge } from '@/components/ui/halo-badge';
import { PredictionBotProvider } from '@/components/trading/PredictionBotRuntime';
export default function OfficePage() {
  const stageRef = useRef(null);
  const photoCaptureRef = useRef<(() => Promise<{ width: number; height: number }>) | null>(null);
  const sceneRef = useRef(null);
  const audioRef = useRef(null);
  const pipelineRef = useRef(null);
  const keysDownRef = useRef(new Set());
  const inputLoopRef = useRef(null);
  const handleNextTrackRef = useRef(null);
  const openAgentWorkspaceRef = useRef(null);
  const openKhansaChatRef = useRef(null);

  // App & Status State
  const [booted, setBooted] = useState(false);
  const [clockStr, setClockStr] = useState('--:--:--');
  const [missionState, setMissionState] = useState('IDLE');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Audio Widget & Playlist State
  const [audioState, setAudioState] = useState({
    ready: false,
    isPlaying: false,
    volume: 50,
    isMuted: false,
  });
  const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 196 });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState({
    title: 'Playlist Utama · Jazz Smooth',
    artist: 'YouTube Music',
    videoId: '',
    cover: '',
  });
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');

  // Terminal & Pipeline State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [termTab, setTermTab] = useState<'logs' | 'diff'>('logs');
  const [logs, setLogs] = useState([]);
  const [diffData, setDiffData] = useState(null);
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  const [pipelineInfo, setPipelineInfo] = useState(null);
  const [pipelineTimer, setPipelineTimer] = useState('00:00');
  const [precisionScore, setPrecisionScore] = useState(0);
  const timerStartRef = useRef(null);

  // Modals & Interaction
  const [isTeamDirectoryOpen, setIsTeamDirectoryOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  const [isOfficeChatOpen, setIsOfficeChatOpen] = useState(false);
  const [officeBlips, setOfficeBlips] = useState<Blip[]>(() =>
    blipsFromScene(
      { x: BOSS.spawn.x, z: BOSS.spawn.z },
      { x: BOSS.spawn.x + 1.25, z: BOSS.spawn.z + 0.6 },
      AGENTS.map((a) => ({ id: a.id, x: a.desk.x, z: a.desk.z, name: a.name, color: a.color }))
    )
  );
  const [skyPhase, setSkyPhase] = useState<SkyPhase | 'auto'>('auto');
  const [employeeSim, setEmployeeSim] = useState<EmployeeSim>(() => createEmployeeSim({ x: -2.5, z: 2.6 }));
  const simTickRef = useRef(0);
  const [officeEvents, setOfficeEvents] = useState<OfficeEvent[]>([]);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isDartsOpen, setIsDartsOpen] = useState(false);
  const [isArcadeOpen, setIsArcadeOpen] = useState(false);
  const [isPhotoActive, setIsPhotoActive] = useState(false);
  const [isWallboardOpen, setIsWallboardOpen] = useState(false);
  const { toasts, push: pushToast, dismiss: dismissToast } = useNotificationToasts();
  const [isMissionOpen, setIsMissionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [activeAgentModalId, setActiveAgentModalId] = useState('tara');
  const [isTradingModalOpen, setIsTradingModalOpen] = useState(false);
  const [activeTradingBotId, setActiveTradingBotId] = useState('altair-raditya');
  const [isKhansaChatOpen, setIsKhansaChatOpen] = useState(false);
  const [khansaAutoPrompt, setKhansaAutoPrompt] = useState(false);
  const [interactAgent, setInteractAgent] = useState(null);
  const interactAgentRef = useRef(null);

  // Jira & Repo Workspace
  const [liveTickets, setLiveTickets] = useState([]);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState(null);
  const [selectedRepoPath, setSelectedRepoPath] = useState(
    '/Users/raffayahfazhka/Downloads/master/yapping-techflow'
  );
  const [selectedTicketKey, setSelectedTicketKey] = useState(TICKETS[0]?.key || '');

  // Figma State
  const [figmaUrl, setFigmaUrl] = useState(
    'https://www.figma.com/design/TRPL-App/Core?node-id=204-12'
  );
  const [figmaParseResult, setFigmaParseResult] = useState(null);

  // Synchronize near agent ref
  useEffect(() => {
    interactAgentRef.current = interactAgent;
  }, [interactAgent]);

  // Close all open modals helper to prevent modals overlapping
  const closeAllModals = useCallback(() => {
    setIsAgentModalOpen(false);
    setIsTradingModalOpen(false);
    setIsMissionOpen(false);
    setIsTeamDirectoryOpen(false);
    setIsHelpOpen(false);
    setIsMusicModalOpen(false);
    setIsKhansaChatOpen(false);
    setIsOfficeChatOpen(false);
  }, []);

  // Open specific agent workspace
  const openAgentWorkspace = useCallback((agentId) => {
    closeAllModals();
    const target = AGENTS.find((a) => a.id === agentId);
    if (target?.workspace === 'trading') {
      setActiveTradingBotId(agentId);
      setIsTradingModalOpen(true);
    } else {
      setActiveAgentModalId(agentId || 'tara');
      setIsAgentModalOpen(true);
    }
    if (sceneRef.current?.focusOn) {
      sceneRef.current.focusOn(agentId);
    }
  }, [closeAllModals]);

  // Open Khansa companion chat directly
  const openKhansaChat = useCallback((ticketKey?: string, autoPrompt = false) => {
    closeAllModals();
    if (ticketKey) {
      setSelectedTicketKey(ticketKey);
    }
    setKhansaAutoPrompt(autoPrompt);
    setIsKhansaChatOpen(true);
    if (sceneRef.current?.focusOn) {
      sceneRef.current.focusOn('tara');
    }
  }, [closeAllModals]);

  useEffect(() => {
    openAgentWorkspaceRef.current = openAgentWorkspace;
    openKhansaChatRef.current = openKhansaChat;
  }, [openAgentWorkspace, openKhansaChat]);

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setClockStr(clockWibString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    if (sceneRef.current) {
      sceneRef.current.setTheme(theme === 'light');
    }
  }, [theme]);

  // Figma URL Parsing
  useEffect(() => {
    setFigmaParseResult(parseFigmaInput(figmaUrl));
  }, [figmaUrl]);

  // Fetch Live Jira Tickets
  useEffect(() => {
    async function loadJira() {
      setJiraLoading(true);
      try {
        const res = await fetch('/api/jira/tickets');
        const data = await res.json();
        const tech777 = TICKETS.find((t) => t.key === 'TECH-777');
        if (data.tickets && data.tickets.length > 0) {
          const list = tech777 && !data.tickets.some((t: any) => t.key === 'TECH-777')
            ? [tech777, ...data.tickets]
            : data.tickets;
          setLiveTickets(list);
          setSelectedTicketKey(tech777 ? 'TECH-777' : list[0].key);
        } else {
          // Fallback to mock tickets
          setLiveTickets(TICKETS);
          setSelectedTicketKey(tech777 ? 'TECH-777' : TICKETS[0].key);
        }
      } catch (err: any) {
        setJiraError(err.message);
        setLiveTickets(TICKETS);
        setSelectedTicketKey('TECH-777');
      } finally {
        setJiraLoading(false);
      }
    }
    loadJira();
  }, []);

  // Employee social simulation + office minimap blips tick (runs when office is entered)
  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    const poll = setInterval(() => {
      if (cancelled) return;
      simTickRef.current += 1;
      const now = Date.now();
      setEmployeeSim((prev) => {
        const sc = sceneRef.current as any;
        const bossPos = sc?.playerPos ? { x: sc.playerPos.x, z: sc.playerPos.z } : prev.boss;
        const livePositions: Record<string, { x: number; z: number }> = {};
        if (sc?.agentMeshes) {
          sc.agentMeshes.forEach((item: any, id: string) => {
            if (item.currentPos) {
              livePositions[id] = { x: item.currentPos.x, z: item.currentPos.z };
            }
          });
        }
        const next = employeeStateTick(
          { ...prev, boss: bossPos, positions: { ...prev.positions, ...livePositions } },
          now,
          simTickRef.current
        );

        // Update 3D scene agents with new social states and speech bubbles
        if (sc?.setEmployeeSocial) {
          sc.setEmployeeSocial(next.states, next.bubbles);
        }

        // read live positions from the imperative scene
        const blips: Blip[] = sc?.getLiveBlips
          ? sc.getLiveBlips(next.states)
          : [];
        if (blips.length > 0) {
          setOfficeBlips(blips);
        }
        return next;
      });
    }, 4_000); // 4-second reactive tick for responsive social dynamics and proximity silence
    return () => { cancelled = true; clearInterval(poll); };
  }, [booted]);

  // Real-time Minimap Blip Tracker (live 80ms sync when minimap is open, 300ms idle)
  useEffect(() => {
    if (!booted) return;
    const updateLiveBlips = () => {
      const sc = sceneRef.current as any;
      if (sc?.getLiveBlips) {
        setOfficeBlips(sc.getLiveBlips(employeeSim.states));
      } else if (sc?.playerPos && sc?.khansaPos) {
        setOfficeBlips(
          blipsFromScene(
            sc.playerPos,
            sc.khansaPos,
            AGENTS.map((a) => ({ id: a.id, x: a.desk.x, z: a.desk.z, name: a.name, color: a.color }))
          )
        );
      }
    };

    updateLiveBlips();
    const interval = setInterval(updateLiveBlips, 80);
    return () => clearInterval(interval);
  }, [booted, isMinimapOpen, employeeSim.states]);

  // Initialize 3D Engine, Audio, and Pipeline Runner ONCE
  useEffect(() => {
    if (!stageRef.current) return;

    // 1. Scene
    const scene = new OfficeScene(
      stageRef.current,
      (nearAgent) => {
        setInteractAgent((prev) => (prev?.id === nearAgent?.id ? prev : nearAgent));
      },
      (agentId) => {
        openAgentWorkspaceRef.current?.(agentId);
      }
    );
    sceneRef.current = scene;
    photoCaptureRef.current = () => scene.capture();

    // 2. Audio Engine
    const audio = new AudioEngine({
      containerId: 'yt-player-host',
      onStateChange: (state) => setAudioState({ ...state }),
      onTimeUpdate: (time) => setAudioTime({ ...time }),
      onTrackChange: setCurrentTrack,
      onEnded: () => {
        handleNextTrackRef.current?.();
      },
    });
    audio.loadPlaylist(DEFAULT_PLAYLIST_ID, false);
    audioRef.current = audio;

    // 3. Pipeline Runner
    const pipeline = new PipelineRunner({
      onLog: (logItem) => {
        setLogs((prev) => [...prev, logItem]);
      },
      onStepChange: (info) => {
        setPipelineInfo((prev) => ({ ...prev, ...info }));
      },
      onCameraFocus: (targetId) => {
        scene.focusOn(targetId);
      },
      onAgentStatus: (agentId, statusText, color) => {
        scene.updateAgentStatus(agentId, statusText, color);
      },
      onDiffChange: (diff) => {
        setDiffData(diff);
        setSelectedDiffIndex(0);
      },
      onPrecisionChange: (val) => {
        setPrecisionScore(val);
      },
      onComplete: () => {
        setMissionState('COMPLETED');
      },
    });
    pipelineRef.current = pipeline;

    // 4. Keyboard Controls
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      keysDownRef.current.add(e.code);

      if (e.code === 'KeyF' && !e.repeat) {
        openAgentWorkspaceRef.current?.('jajang');
      } else if (e.code === 'KeyJ' && !e.repeat) {
        closeAllModals();
        setIsMissionOpen(true);
      } else if (e.code === 'KeyT' && !e.repeat) {
        setIsTerminalOpen((o) => !o);
      } else if (e.code === 'KeyH' && !e.repeat) {
        closeAllModals();
        setIsHelpOpen((o) => !o);
      } else if (e.code === 'KeyC' && !e.repeat) {
        scene.resetCamera();
      } else if (e.code === 'KeyP' && !e.repeat) {
        setIsPhotoActive((o) => !o);
      } else if (e.code === 'KeyM' && !e.repeat) {
        setIsMinimapOpen((o) => !o);
      } else if (e.code === 'KeyN' && !e.repeat) {
        setIsOfficeChatOpen((o) => !o);
      } else if (e.code === 'KeyO' && !e.repeat) {
        setIsWardrobeOpen((o) => !o);
      } else if (e.code === 'KeyG' && !e.repeat) {
        setIsDartsOpen((o) => !o);
      } else if (e.code === 'KeyB' && !e.repeat) {
        setIsArcadeOpen((o) => !o);
      } else if (e.code === 'KeyK' && !e.repeat) {
        openKhansaChatRef.current?.();
      } else if (e.code === 'KeyE' && !e.repeat) {
        const near = interactAgentRef.current;
        if (near && !near.commandTarget) {
          openKhansaChatRef.current?.();
        } else {
          const targetId = near?.commandTarget ? near.commandTarget.id : (near ? near.id : 'tara');
          openAgentWorkspaceRef.current?.(targetId);
        }
      } else if (e.code === 'Escape') {
        closeAllModals();
      }
    };

    const handleKeyUp = (e) => {
      keysDownRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Movement Loop
    let lastTime = performance.now();
    const movementLoop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const screenInput = readScreenInput(keysDownRef.current);
      if (screenInput.active) {
        const isSprint =
          keysDownRef.current.has('ShiftLeft') || keysDownRef.current.has('ShiftRight');
        scene.applyWASD(screenInput.moveX, screenInput.moveZ, isSprint, dt);
      }

      inputLoopRef.current = requestAnimationFrame(movementLoop);
    };
    inputLoopRef.current = requestAnimationFrame(movementLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (inputLoopRef.current) cancelAnimationFrame(inputLoopRef.current);
      scene.destroy();
      audio.destroy();
    };
  }, []);

  // Music Playback Handlers
  const handleSelectTrack = useCallback((track: any, index?: number) => {
    if (!track) return;
    if (typeof index === 'number') {
      setCurrentTrackIndex(index);
    }
    setCurrentTrack({
      title: track.title,
      artist: track.artist,
      videoId: track.videoId,
      cover: track.cover,
    });
    if (audioRef.current?.loadTrack) {
      audioRef.current.loadTrack(track.videoId, track.title, track.artist);
    }
  }, []);

  const handleNextTrack = useCallback(() => {
    if (audioRef.current?.playlistId) {
      audioRef.current.nextPlaylistTrack();
      return;
    }
    if (!USER_PLAYLIST || USER_PLAYLIST.length === 0) return;
    if (repeatMode === 'one') {
      audioRef.current?.seekTo(0);
      audioRef.current?.play();
      return;
    }
    let nextIdx = (currentTrackIndex + 1) % USER_PLAYLIST.length;
    if (isShuffle && USER_PLAYLIST.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * USER_PLAYLIST.length);
      } while (nextIdx === currentTrackIndex);
    }
    handleSelectTrack(USER_PLAYLIST[nextIdx], nextIdx);
  }, [currentTrackIndex, handleSelectTrack, isShuffle, repeatMode]);

  const handlePrevTrack = useCallback(() => {
    if (audioRef.current?.playlistId) {
      audioRef.current.previousPlaylistTrack();
      return;
    }
    if (!USER_PLAYLIST || USER_PLAYLIST.length === 0) return;
    const prevIdx = (currentTrackIndex - 1 + USER_PLAYLIST.length) % USER_PLAYLIST.length;
    handleSelectTrack(USER_PLAYLIST[prevIdx], prevIdx);
  }, [currentTrackIndex, handleSelectTrack]);

  const handleCycleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'all' ? 'one' : prev === 'one' ? 'off' : 'all'));
  }, []);

  const handleToggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  useEffect(() => {
    audioRef.current?.configurePlaylist(isShuffle, repeatMode === 'all');
  }, [isShuffle, repeatMode, audioState.ready]);

  useEffect(() => {
    handleNextTrackRef.current = handleNextTrack;
  }, [handleNextTrack]);

  const handlePlayCustomUrl = (url, title, artist) => {
    let videoId = null;
    let playlistId = null;
    try {
      if (url.includes('list=')) {
        const match = url.match(/[?&]list=([^#&?]+)/);
        if (match) playlistId = match[1];
      }
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      } else if (url.includes('v=')) {
        const match = url.match(/[?&]v=([^#&?]+)/);
        if (match) videoId = match[1];
      } else if (!url.includes('/') && url.length >= 10 && url.length <= 15) {
        videoId = url;
      }
    } catch (e) {
      console.warn('URL parsing error', e);
    }

    if (!videoId && !playlistId) {
      alert('URL YouTube tidak dikenali');
      return;
    }

    const t = title || (playlistId ? 'Custom Playlist' : 'Custom Track');
    const a = artist || 'YouTube Music';
    const c = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : currentTrack.cover;

    setCurrentTrack({
      title: t,
      artist: a,
      videoId: videoId || currentTrack.videoId,
      cover: c,
    });

    if (playlistId && audioRef.current?.loadPlaylist) {
      audioRef.current.loadPlaylist(playlistId);
    } else if (videoId && audioRef.current?.loadTrack) {
      audioRef.current.loadTrack(videoId, t, a);
    }
  };

  // Jira Sprint Execution
  const handleExecuteTicket = (ticket, targetFolder, validation) => {
    if (!ticket) return;

    setIsMissionOpen(false);
    setIsTerminalOpen(true);
    setTermTab('logs');
    setMissionState('RUNNING');
    setPipelineTimer(null);
    timerStartRef.current = Date.now();

    const planSteps = (ticket.plan || []).map((desc, idx) => ({
      id: `step-${idx + 1}`,
      label: desc.split(':')[0] || `Step ${idx + 1}`,
      desc,
    }));

    pipelineRef.current.runJiraPipeline({
      ticketKey: ticket.key,
      ticket,
      repoId: ticket.repo || 'frontend-dashboard-v2',
      projectPath: targetFolder,
      targetBranch: validation?.currentBranch || 'dev',
      steps: planSteps.length > 0 ? planSteps : undefined,
      diff: ticket.files || [],
      tests: ticket.tests || [],
    });
  };

  // Speed Toggle
  const handleSpeedToggle = () => {
    const nextSpeed = simSpeed === 1 ? 2 : simSpeed === 2 ? 4 : 1;
    setSimSpeed(nextSpeed);
    if (pipelineRef.current) pipelineRef.current.setSpeed(nextSpeed);
  };

  const handleEnterOffice = () => {
    setBooted(true);
    // Primary playlist is cued paused on entry; playback starts only from a visible Play control.
    audioRef.current?.loadPlaylist(DEFAULT_PLAYLIST_ID, false);
  };

  const activeTicketForSubordinate =
    liveTickets.find((t) => t.key === selectedTicketKey) || liveTickets[0] || TICKETS[0];

  const handleTreatAll = useCallback(() => {
    const now = Date.now();
    setEmployeeSim((prev) => applyEmployeeTreat(prev, now));
    void fetchEmployeeDialogue({
      id: 'tara',
      name: 'Tara',
      role: 'Operations & Treat Coordinator',
      event: 'treat',
      weather: 'clear',
    }).then((aiText) => {
      if (aiText) {
        const bubble = createAiSpeechBubble('tara', '🎉', aiText, Date.now() + 20_000, 'status');
        if (bubble) {
          setEmployeeSim((prev) => ({
            ...prev,
            bubbles: [...prev.bubbles.filter((b) => b.agentId !== 'tara'), bubble],
          }));
        }
      }
    });
    setOfficeEvents((prev) => [
      {
        id: `tr-${now}`,
        at: now,
        actor: 'khansaku',
        kind: 'treat',
        text: '🎉 Mas Bos Raffa traktir Kopi Kenangan & Croissant untuk se-kantor!',
      },
    ]);
    pushToast({
      kind: 'coffee',
      title: 'Traktir Se-Kantor!',
      message: 'Khansaku mengantarkan Kopi Kenangan & Croissant ke meja seluruh karyawan. Stamina & fokus 100%!',
    });
  }, [pushToast]);

  return (
    <PredictionBotProvider>
      <main id="app" className="relative w-screen h-screen overflow-hidden">
      <h1 className="sr-only">
        Yapping Techflow — Interactive 3D Virtual AI Penthouse &amp; Autonomous Mission Control
      </h1>

      {/* 3D WebGL Canvas (interactive isometric office runtime) */}
      <div id="stage" ref={stageRef} aria-label="Kantor 3D isometrik" />
      <div className="vignette" aria-hidden="true" />

      {/* Navbar Component */}
      <Navbar
        missionState={missionState}
        clockStr={clockStr}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onOpenTeamDirectory={() => {
          closeAllModals();
          setIsTeamDirectoryOpen(true);
        }}
        onOpenMissionControl={() => {
          closeAllModals();
          setIsMissionOpen(true);
        }}
        onOpenKhansaChat={() => openKhansaChat(selectedTicketKey)}
        onOpenFigma={() => openAgentWorkspace('jajang')}
        onToggleTerminal={() => setIsTerminalOpen((o) => !o)}
        onOpenHelp={() => {
          closeAllModals();
          setIsHelpOpen(true);
        }}
        onOpenMinimap={() => setIsMinimapOpen((o) => !o)}
        onOpenOfficeChat={() => setIsOfficeChatOpen((o) => !o)}
        onOpenWardrobe={() => setIsWardrobeOpen((o) => !o)}
        onOpenDarts={() => setIsDartsOpen((o) => !o)}
        onOpenArcade={() => setIsArcadeOpen((o) => !o)}
        onOpenPhotoMode={() => setIsPhotoActive((o) => !o)}
      />

      {/* Pipeline HUD */}
      {pipelineInfo && (
        <section id="pipeline-hud" className="pipeline-hud glass" aria-live="polite">
          <div className="ph-head">
            <span className="ph-kind mono">{pipelineInfo.kind}</span>
            <span className="ph-title">{pipelineInfo.title}</span>
            <span className="ph-timer mono">{pipelineTimer || '00:00'}</span>
          </div>
          <ol className="ph-steps">
            {pipelineInfo.steps &&
              pipelineInfo.steps.map((step, idx) => {
                const isDone = idx < pipelineInfo.activeIndex;
                const isActive = idx === pipelineInfo.activeIndex;
                return (
                  <li key={step.id} className="ph-step-item">
                    <div className={`ph-step-bar ${isDone ? 'done' : isActive ? 'active' : ''}`} />
                    <span className={`ph-step-label ${isActive ? 'active' : ''}`}>{step.label}</span>
                  </li>
                );
              })}
          </ol>
          {precisionScore > 0 && (
            <div className="ph-meter">
              <div className="ph-meter-label mono">
                <span>Pixel Precision</span>
                <span className={precisionScore >= 99.5 ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {precisionScore.toFixed(1)}%
                </span>
              </div>
              <div className="ph-meter-track">
                <div className="ph-meter-fill" style={{ width: `${precisionScore}%` }} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Proximity Interaction Prompt */}
      {interactAgent && (
        <div
          id="interact-prompt"
          className="interact-prompt glass"
          style={{
            cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.94), rgba(30, 20, 28, 0.92))',
            borderColor: 'rgba(244, 63, 94, 0.45)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(244, 63, 94, 0.22)',
          }}
          onClick={() => {
            if (interactAgent.commandTarget) {
              openAgentWorkspace(interactAgent.commandTarget.id);
            } else {
              openKhansaChat(selectedTicketKey);
            }
          }}
        >
          <kbd className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 font-mono text-xs border border-rose-400/40">
            {interactAgent.commandTarget ? 'E' : 'E / K'}
          </kbd>
          {interactAgent.commandTarget ? (
            <span>
              👑 <b className="text-rose-300">Khansa:</b> &quot;Mau perintahkan{' '}
              <b className="text-amber-300">{interactAgent.commandTarget.name}</b> ({interactAgent.commandTarget.role}), Mas Bos?&quot; —{' '}
              <b className="text-rose-400">Tekan [E] / Klik</b>
            </span>
          ) : (
            <span>
              💖 Bicara dengan <b className="text-rose-300">Khansaku</b> (Permaisuri &amp; Corporate Secretary) —{' '}
              <b className="text-rose-400">Tekan [E] / [K] / Klik</b>
            </span>
          )}
        </div>
      )}

      {/* Terminal Drawer Component */}
      <TerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        logs={logs}
        onClearLogs={() => setLogs([])}
        simSpeed={simSpeed}
        onSpeedToggle={handleSpeedToggle}
        termTab={termTab}
        setTermTab={setTermTab}
        diffData={diffData}
        selectedDiffIndex={selectedDiffIndex}
        setSelectedDiffIndex={setSelectedDiffIndex}
      />

      {/* Music Player Mini Pill Dock */}
      <MusicPlayerWidget
        audioState={audioState}
        audioTime={audioTime}
        currentTrack={currentTrack}
        onTogglePlay={() => audioRef.current?.togglePlay()}
        onNextTrack={handleNextTrack}
        onOpenPlayer={() => setIsMusicModalOpen(true)}
      />

      {/* Music Player Full Pop-up Modal */}
      <MusicPlayerModal
        isOpen={isMusicModalOpen}
        onClose={() => setIsMusicModalOpen(false)}
        audioState={audioState}
        audioTime={audioTime}
        currentTrack={currentTrack}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        onTogglePlay={() => audioRef.current?.togglePlay()}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onToggleMute={() => audioRef.current?.toggleMute()}
        onSeek={(seconds) => audioRef.current?.seekTo(seconds)}
        onVolumeChange={(volume) => audioRef.current?.setVolume(volume)}
        onToggleShuffle={handleToggleShuffle}
        onCycleRepeat={handleCycleRepeat}
        onSelectTrack={handleSelectTrack}
        onPlayCustomUrl={handlePlayCustomUrl}
      />

      {/* Employee Identity Cards Directory Modal */}
      <TeamDirectoryModal
        isOpen={isTeamDirectoryOpen}
        onClose={() => setIsTeamDirectoryOpen(false)}
        onOpenWorkspace={(agentId) => openAgentWorkspace(agentId)}
        onFocusDesk={(agentId) => sceneRef.current?.focusOn(agentId)}
      />

      {/* Mission Control Modal (with Local Folder Selection & Dev Branch Check) */}
      <MissionControlModal
        isOpen={isMissionOpen}
        onClose={() => setIsMissionOpen(false)}
        liveTickets={liveTickets.length > 0 ? liveTickets : TICKETS}
        jiraLoading={jiraLoading}
        jiraError={jiraError}
        selectedTicketKey={selectedTicketKey}
        onSelectTicketKey={setSelectedTicketKey}
        selectedRepoPath={selectedRepoPath}
        onSelectRepoPath={setSelectedRepoPath}
        onExecuteTicket={handleExecuteTicket}
        onOpenKhansaChat={(ticketKey, auto) => openKhansaChat(ticketKey, auto)}
      />

      {/* Subordinate Workspaces Modal */}
      <SubordinateModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        activeAgentId={activeAgentModalId}
        setActiveAgentId={setActiveAgentModalId}
        tickets={liveTickets.length > 0 ? liveTickets : TICKETS}
        activeTicket={activeTicketForSubordinate}
        setActiveTicketKey={setSelectedTicketKey}
        selectedRepoId={REPOS[0]?.id || 'frontend-dashboard-v2'}
        setSelectedRepoId={() => {}}
        customRepoPath={selectedRepoPath}
        setCustomRepoPath={setSelectedRepoPath}
        figmaUrl={figmaUrl}
        setFigmaUrl={setFigmaUrl}
        figmaParseResult={figmaParseResult}
        onRunFullPipeline={() => {
          setIsAgentModalOpen(false);
          setIsMissionOpen(true);
        }}
        onFocusAgentInScene={(id) => sceneRef.current?.focusOn(id)}
        onOpenKhansaChat={(ticketKey, auto) => openKhansaChat(ticketKey, auto)}
      />

      {/* Trading Bots Workspace Modal */}
      <TradingBotsModal
        isOpen={isTradingModalOpen}
        onClose={() => setIsTradingModalOpen(false)}
        initialBotId={activeTradingBotId}
        onFocusAgentInScene={(id) => sceneRef.current?.focusOn(id)}
      />
      {/* Khansa Companion Chat & Antigravity Prompt Modal */}
      <KhansaChatModal
        isOpen={isKhansaChatOpen}
        onClose={() => setIsKhansaChatOpen(false)}
        tickets={liveTickets.length > 0 ? liveTickets : TICKETS}
        activeTicket={activeTicketForSubordinate}
        onSelectTicketKey={setSelectedTicketKey}
        initialTicketKey={selectedTicketKey}
        autoRequestPrompt={khansaAutoPrompt}
        onTreat={handleTreatAll}
      />

      {/* Controls & Shortcut Help Modal */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        size="md"
        title="Kontrol & Shortcut"
        subtitle="Navigasi kantor dan keyboard shortcuts"
        icon={<span>⌨</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5 text-xs text-zinc-300 py-1">
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">W</kbd> / <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">↑</kbd></span>
            <span className="text-zinc-300">Jalan ke ATAS layar</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">S</kbd> / <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">↓</kbd></span>
            <span className="text-zinc-300">Jalan ke BAWAH layar</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">A</kbd> / <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">←</kbd></span>
            <span className="text-zinc-300">Jalan ke KIRI layar</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">D</kbd> / <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">→</kbd></span>
            <span className="text-zinc-300">Jalan ke KANAN layar</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">⇧ Shift</kbd></span>
            <span className="text-zinc-300">Sprint Cepat</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">E</kbd></span>
            <span className="text-zinc-300">Bicara dengan agen terdekat</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">K</kbd></span>
            <span className="text-zinc-300">Chat Khansa &amp; Prompt AI</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">F</kbd></span>
            <span className="text-zinc-300">Slicing Figma ke Jajang</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">J</kbd></span>
            <span className="text-zinc-300">Mission Control Jira</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">T</kbd></span>
            <span className="text-zinc-300">Buka / Tutup Terminal</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">M</kbd></span>
            <span className="text-zinc-300">Radar Minimap Penthouse</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">N</kbd></span>
            <span className="text-zinc-300">Warung Kopi (Chat Kantor)</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">O</kbd></span>
            <span className="text-zinc-300">Setelan Wardrobe Bos Raffa</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">G</kbd></span>
            <span className="text-zinc-300">Sky Darts (Rooftop Mini-Game)</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">B</kbd></span>
            <span className="text-zinc-300">Retro Arcade Machine</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">P</kbd></span>
            <span className="text-zinc-300">Photo Drone Mode (Capture PNG)</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">C</kbd></span>
            <span className="text-zinc-300">Reset Kamera ke Raffa</span>
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-3 py-0.5">
            <span className="shrink-0"><kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] font-bold text-white shadow-sm">Esc</kbd></span>
            <span className="text-zinc-300">Tutup Modal Aktif</span>
          </div>
        </div>
      </Modal>

      {/* Global Splash Screen Loader */}
      {!booted && <SplashScreen minDurationMs={1800} onFinish={handleEnterOffice} />}

      {/* Office Minimap radar + Warung Kopi office chat (post-boot overlays) */}
      {booted && !isPhotoActive && (
        <OfficeMinimap
          open={isMinimapOpen}
          onClose={() => setIsMinimapOpen(false)}
          onToggleOpen={() => setIsMinimapOpen((o) => !o)}
          onFocusZone={(z) => {
            const sc = sceneRef.current as any;
            if (sc?.focusOnZone) sc.focusOnZone(z);
            else if (sc?.focusOn) sc.focusOn(z.focus);
          }}
          onFocusAgent={(agentId) => {
            const sc = sceneRef.current as any;
            if (sc?.focusOn) sc.focusOn(agentId);
          }}
          onPanToLocation={(x, z) => {
            const sc = sceneRef.current as any;
            if (sc?.panTo) sc.panTo(x, z);
            else if (sc?.focusOn) sc.focusOn([x, 0, z]);
          }}
          onRecenterCamera={() => {
            const sc = sceneRef.current as any;
            if (sc?.resetCamera) sc.resetCamera();
          }}
          blips={officeBlips}
          clockStr={clockStr}
          skyPhase={skyPhase}
          onSelectSkyPhase={(phase) => {
            setSkyPhase(phase);
            const sc = sceneRef.current as any;
            if (sc?.setSkyPhase) sc.setSkyPhase(phase);
          }}
          employeeStates={employeeSim.states}
          employeeStamina={employeeSim.stamina}
          employeeFocus={employeeSim.focus}
        />
      )}

      <OfficeGroupChatModal
        isOpen={isOfficeChatOpen && booted}
        onClose={() => setIsOfficeChatOpen(false)}
        events={officeEvents}
        onSendUserMessage={(text) => {
          const ev: OfficeEvent = { id: `u-${Date.now()}`, at: Date.now(), actor: 'raffa', kind: 'status', text };
          setOfficeEvents((prev) => [...prev, ev]);
        }}
        onTreat={handleTreatAll}
        onDelegate={() => {
          setIsOfficeChatOpen(false);
          setIsKhansaChatOpen(true);
        }}
      />

      <BossWardrobeModal isOpen={isWardrobeOpen && booted} onClose={() => setIsWardrobeOpen(false)} />

      <SkyDartsModal isOpen={isDartsOpen && booted} onClose={() => setIsDartsOpen(false)} />

      <RetroArcadeModal isOpen={isArcadeOpen && booted} onClose={() => setIsArcadeOpen(false)} />

      <PhotoModeController
        active={isPhotoActive && booted}
        onEnter={() => setIsPhotoActive(true)}
        onExit={() => setIsPhotoActive(false)}
        capture={() => (photoCaptureRef.current ? photoCaptureRef.current() : Promise.reject(new Error('Kamera 3D belum siap')))}
        dof={null}
      />

      {/* YouTube Iframe Audio Host (Hidden unobtrusively without zero-dimension throttling) */}
      <div id="yt-player-host" aria-label="Pemutar musik YouTube" />

      {/* Giant Wallboard Hologram — War Room */}
      <WallboardHologram isOpen={isWallboardOpen && booted} onClose={() => setIsWallboardOpen(false)} />

      {/* SCBD Executive Push Notification Toasts */}
      <NotificationToasts toasts={toasts} onDismiss={dismissToast} />

      {/* Penthouse Quick Actions Dock — Glassmorphic with Lucide Icons */}
      {booted && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 select-none max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar shrink-0">
          <Dock className="p-2 gap-1.5 sm:gap-2">
            <DockItem
              onClick={() => setIsMinimapOpen((o) => !o)}
              title="Radar Minimap Penthouse (M)"
              className="text-emerald-300 hover:bg-emerald-500/20"
            >
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-emerald-400" />
                <span className="font-bold">Radar</span>
              </span>
            </DockItem>

            <DockItem
              onClick={() => setIsOfficeChatOpen((o) => !o)}
              title="Warung Kopi TechFlow (N)"
              className="text-amber-300 hover:bg-amber-500/20"
            >
              <span className="flex items-center gap-1.5">
                <Coffee size={14} className="text-amber-400" />
                <span className="font-bold">Warung Kopi</span>
              </span>
            </DockItem>

            <DockItem
              onClick={handleTreatAll}
              title="Traktir Kopi & Pizza Se-Kantor via Khansaku (100% Buff)"
              className="text-rose-300 hover:bg-rose-500/20"
            >
              <span className="flex items-center gap-1.5">
                <PartyPopper size={14} className="text-rose-400" />
                <span className="font-bold">Traktir Kopi</span>
              </span>
            </DockItem>

            <DockItem
              onClick={() => setIsWallboardOpen((o) => !o)}
              title="Giant Wallboard Hologram (War Room)"
              className="text-cyan-300 hover:bg-cyan-500/20"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 size={14} className="text-cyan-400" />
                <span className="font-bold">Wallboard</span>
              </span>
            </DockItem>

            <div className="h-5 w-px bg-white/20 mx-1" aria-hidden="true" />

            <DockItem
              onClick={() => setIsWardrobeOpen((o) => !o)}
              title="Setelan Wardrobe Bos Raffa (O)"
            >
              <span className="flex items-center gap-1.5">
                <Shirt size={14} />
                <span className="hidden sm:inline">Wardrobe</span>
              </span>
            </DockItem>

            <DockItem
              onClick={() => setIsDartsOpen((o) => !o)}
              title="Mini-Game Sky Darts Penthouse (G)"
            >
              <span className="flex items-center gap-1.5">
                <Target size={14} />
                <span className="hidden sm:inline">Darts</span>
              </span>
            </DockItem>

            <DockItem
              onClick={() => setIsArcadeOpen((o) => !o)}
              title="Retro Arcade: Crypto Scalper & Whack-A-Bug (B)"
            >
              <span className="flex items-center gap-1.5">
                <Gamepad2 size={14} />
                <span className="hidden sm:inline">Arcade</span>
              </span>
            </DockItem>

            <DockItem
              onClick={() => setIsPhotoActive((o) => !o)}
              title="Photo Drone Mode (P)"
            >
              <span className="flex items-center gap-1.5">
                <Camera size={14} />
                <span className="hidden sm:inline">Photo</span>
              </span>
            </DockItem>
          </Dock>
        </div>
      )}
      </main>
    </PredictionBotProvider>
  );
}
