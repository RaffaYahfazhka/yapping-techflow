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
import { USER_PLAYLIST } from '../lib/data/userPlaylist';

// Modular Components
import Navbar from '../components/navigation/Navbar';
import TeamDirectoryModal from '../components/cards/TeamDirectoryModal';
import MissionControlModal from '../components/mission/MissionControlModal';
import MusicPlayerWidget from '../components/music/MusicPlayerWidget';
import MusicPlayerModal, { RepeatMode } from '../components/music/MusicPlayerModal';
import SplashScreen from '../components/ui/SplashScreen';
import OfficeClientBoundary from '@/components/office/OfficeClientBoundary';
import OfficeMinimap, { blipsFromScene, type Blip } from '@/components/map/OfficeMinimap';
import OfficeGroupChatModal from '@/components/chat/OfficeGroupChatModal';
import SkyDartsModal from '@/components/minigames/SkyDartsModal';
import RetroArcadeModal from '@/components/minigames/RetroArcadeModal';
import BossWardrobeModal, { type WardrobePreset } from '@/components/executive/BossWardrobeModal';
import PhotoModeController from '@/components/executive/PhotoModeController';
import { createEmployeeSim, employeeStateTick, applyEmployeeTreat, applyWeatherToSim, visibleBubble, type EmployeeSim, type OfficeEvent } from '@/lib/engine/socialEngine';
import TerminalDrawer from '../components/terminal/TerminalDrawer';
import SubordinateModal from '../components/SubordinateModal';
import TradingBotsModal from '../components/finance/TradingBotsModal';
import KhansaChatModal from '../components/khansa/KhansaChatModal';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

export default function OfficePage() {
  const stageRef = useRef(null);
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
    title: USER_PLAYLIST[0]?.title || 'DJ IM LADY X AVANGARD X SWEET LOVE',
    artist: USER_PLAYLIST[0]?.artist || 'YouTube Music',
    videoId: USER_PLAYLIST[0]?.videoId || 'NA7hmTexZ0E',
    cover: USER_PLAYLIST[0]?.cover || 'https://i.ytimg.com/vi/NA7hmTexZ0E/mqdefault.jpg',
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
  const [officeBlips, setOfficeBlips] = useState<Blip[]>([]);
  const [employeeSim, setEmployeeSim] = useState<EmployeeSim>(() => createEmployeeSim({ x: -2.5, z: 2.6 }));
  const simTickRef = useRef(0);
  const [officeEvents, setOfficeEvents] = useState<OfficeEvent[]>([]);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isDartsOpen, setIsDartsOpen] = useState(false);
  const [isArcadeOpen, setIsArcadeOpen] = useState(false);
  const [isPhotoActive, setIsPhotoActive] = useState(false);
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
      const now = new Date();
      setClockStr(now.toTimeString().split(' ')[0]);
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
        const next = employeeStateTick({ ...prev, boss: { x: prev.boss.x, z: prev.boss.z } }, now, simTickRef.current);
        // read live positions from the imperative scene
        const sc = sceneRef.current as unknown as { playerPos?: { x: number; z: number }; khansaPos?: { x: number; z: number } } | null;
        const blips: Blip[] = sc
          ? blipsFromScene(
              sc.playerPos ?? { x: -2.5, z: 2.6 },
              sc.khansaPos ?? { x: -1.2, z: 3.2 },
              (() => {
                const list: { id: string; x: number; z: number; name: string; color: string }[] = [];
                for (const [id] of Object.entries(next.states)) {
                  const agent = AGENTS.find((a) => a.id === id);
                  if (agent) list.push({ id: agent.id, x: agent.desk.x, z: agent.desk.z, name: agent.name, color: agent.color });
                }
                return list;
              })(),
            )
          : [];
        setOfficeBlips(blips);
        return next;
      });
    }, 15_000);
    return () => { cancelled = true; clearInterval(poll); };
  }, [booted]);

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

    // 2. Audio Engine
    const audio = new AudioEngine({
      containerId: 'yt-player-host',
      onStateChange: (state) => setAudioState({ ...state }),
      onTimeUpdate: (time) => setAudioTime({ ...time }),
      onEnded: () => {
        handleNextTrackRef.current?.();
      },
    });
    audio.init();
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
      } else if (e.code === 'KeyW' && !e.repeat) {
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
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  const activeTicketForSubordinate =
    liveTickets.find((t) => t.key === selectedTicketKey) || liveTickets[0] || TICKETS[0];

  return (
    <main id="app" className="relative w-screen h-screen overflow-hidden">
      <h1 className="sr-only">
        Kantor Raffa — Interactive 3D Virtual AI Office &amp; Autonomous Mission Control
      </h1>

      {/* 3D WebGL Canvas (imperative scene: movement/avatar runtime) */}
      <div id="stage" ref={stageRef} aria-label="Kantor 3D isometrik" />
      {/* R3F declarative penthouse layer: WIB sky, terrace, wallboard, city glow */}
      {booted && <OfficeClientBoundary equityPct={12.4} />}
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
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.28), rgba(251, 191, 36, 0.18))',
            borderColor: 'rgba(244, 63, 94, 0.55)',
            boxShadow: '0 8px 32px rgba(244, 63, 94, 0.25)',
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
      />

      {/* Controls & Shortcut Help Modal */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        size="sm"
        title="Kontrol & Shortcut"
        subtitle="Navigasi kantor dan keyboard shortcuts"
        icon={<span>⌨</span>}
      >
        <div className="grid grid-cols-2 gap-y-2 text-xs font-mono text-zinc-300">
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">W</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10">↑</kbd></div><div>Jalan ke ATAS layar</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">S</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10">↓</kbd></div><div>Jalan ke BAWAH layar</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">A</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10">←</kbd></div><div>Jalan ke KIRI layar</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">D</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10">→</kbd></div><div>Jalan ke KANAN layar</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">⇧ Shift</kbd></div><div>Sprint Cepat</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">E</kbd></div><div>Bicara dengan agen terdekat</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">K</kbd></div><div>Chat Khansa &amp; Prompt Antigravity</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">F</kbd></div><div>Slicing Figma ke Jajang</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">J</kbd></div><div>Mission Control Jira</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">T</kbd></div><div>Buka / Tutup Terminal</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">P</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-white/10">M</kbd></div><div>Play/Pause · Mute Music</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">C</kbd></div><div>Reset Kamera ke Raffa</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-white/10">Esc</kbd></div><div>Tutup Modal Aktif</div>
        </div>
      </Modal>

      {/* Global Splash Screen Loader */}
      {!booted && <SplashScreen minDurationMs={1800} onFinish={handleEnterOffice} />}

      {/* Office Minimap radar + Warung Kopi office chat (post-boot overlays) */}
      <OfficeMinimap
        open={isMinimapOpen && booted}
        onClose={() => setIsMinimapOpen(false)}
        onFocusZone={(z) => sceneRef.current?.focusOn(null)}
        onFocusAgent={(agentId) => sceneRef.current?.focusOn(agentId)}
        blips={officeBlips}
        clockStr={clockStr}
      />

      <OfficeGroupChatModal
        isOpen={isOfficeChatOpen && booted}
        onClose={() => setIsOfficeChatOpen(false)}
        events={officeEvents}
        onSendUserMessage={(text) => {
          const ev: OfficeEvent = { id: `u-${Date.now()}`, at: Date.now(), actor: 'raffa', kind: 'status', text };
          setOfficeEvents((prev) => [...prev, ev]);
        }}
        onTreat={() => {
          const now = Date.now();
          setEmployeeSim((prev) => applyEmployeeTreat(prev, now));
          setOfficeEvents((prev) => [...prev, { id: `tr-${now}`, at: now, actor: 'khansaku', kind: 'treat', text: '🎉 Mas Bos Raffa traktir Kopi Kenangan & Croissant untuk se-kantor!' }]);
        }}
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
      />

      {/* YouTube Iframe Audio Host (Hidden unobtrusively without zero-dimension throttling) */}
      <div id="yt-player-host" aria-hidden="true" />
    </main>
  );
}
