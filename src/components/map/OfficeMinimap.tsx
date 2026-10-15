'use client';

/**
 * HUD Penthouse Minimap — Architectural Radar (PRD §4 & §3.3).
 * Cult UI Glassmorphic Dual-Mode Radar:
 * - Compact HUD Mode (always docked in top-right for real-time situational awareness)
 * - Expanded Tactical Blueprint Mode (full architectural view, zone teleports, sky override, employee directory)
 * Features:
 * - Real-time 60 FPS live tracking of Bos Raffa (#fbbf24) & Khansaku (#f43f5e) with companion tether line
 * - Rotating neon radar sweep beam & directional heading pointer
 * - 6 integrated penthouse zones with zero boundary overlap and live zone detection
 * - Interactive click-to-pan camera to ANY location on the blueprint with visual ripple ping
 * - WIB Timezone / Sky Phase Override HUD Toggle (Auto WIB, Pagi, Siang, Sore, Malam)
 * - 100% Lucide React icons & Cult UI glassmorphism standards
 */

import { useState } from 'react';
import {
  X,
  Compass,
  Sparkles,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Clock,
  Maximize2,
  Minimize2,
  Crosshair,
  Coffee,
  Gamepad2,
  Target,
  Eye,
  Radio,
  MapPin,
  Layers,
  Users,
} from 'lucide-react';
import { ZONES, detectZone, type ZoneDef } from '@/lib/data/zones';
import { AGENTS, BOSS } from '@/lib/data/agents';
import { type SkyPhase } from '@/lib/engine/skyEngine';

export interface Blip {
  id: string;
  x: number;
  z: number;
  facing?: number;
  label: string;
  color: string;
}

export interface OfficeMinimapProps {
  open: boolean;
  onClose: () => void;
  onToggleOpen?: () => void;
  onFocusZone: (z: ZoneDef) => void;
  onFocusAgent: (agentId: string) => void;
  onPanToLocation?: (x: number, z: number) => void;
  onRecenterCamera?: () => void;
  blips: Blip[];
  clockStr?: string;
  skyPhase?: SkyPhase | 'auto';
  onSelectSkyPhase?: (phase: SkyPhase | 'auto') => void;
  employeeStates?: Record<string, string>;
  employeeStamina?: Record<string, number>;
  employeeFocus?: Record<string, number>;
}

// Penthouse coordinate mapping (matches ROOM: X [-16, 16], Z [-12, 28])
const WORLD_X_MIN = -16.5;
const WORLD_X_MAX = 16.5;
const WORLD_Z_MIN = -12.5;
const WORLD_Z_MAX = 28.5;

const MAP_W = 340;
const MAP_H = 420;

const projectX = (x: number) => ((x - WORLD_X_MIN) / (WORLD_X_MAX - WORLD_X_MIN)) * MAP_W;
const projectZ = (z: number) => ((z - WORLD_Z_MIN) / (WORLD_Z_MAX - WORLD_Z_MIN)) * MAP_H;

const unprojectX = (svgX: number) => WORLD_X_MIN + (svgX / MAP_W) * (WORLD_X_MAX - WORLD_X_MIN);
const unprojectZ = (svgY: number) => WORLD_Z_MIN + (svgY / MAP_H) * (WORLD_Z_MAX - WORLD_Z_MIN);

export default function OfficeMinimap({
  open,
  onClose,
  onToggleOpen,
  onFocusZone,
  onFocusAgent,
  onPanToLocation,
  onRecenterCamera,
  blips,
  clockStr = '--:--:--',
  skyPhase = 'auto',
  onSelectSkyPhase,
  employeeStates = {},
  employeeStamina = {},
  employeeFocus = {},
}: OfficeMinimapProps) {
  const [selectedAgentInfo, setSelectedAgentInfo] = useState<string | null>(null);
  const [clickPing, setClickPing] = useState<{ x: number; y: number; id: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'agents' | 'zones'>('agents');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const tradingDesks = AGENTS.filter((a) => a.workspace === 'trading');
  const engDesks = AGENTS.filter((a) => a.workspace !== 'trading' && a.id !== 'tara');

  const raffaBlip = blips.find((b) => b.id === 'raffa');
  const khansaBlip = blips.find((b) => b.id === 'tara' || b.id === 'khansaku');

  // Detect which zone Bos Raffa is currently standing in
  const currentZone = raffaBlip ? detectZone(raffaBlip.x, raffaBlip.z) : ZONES[0];

  const activeSkyPhase = skyPhase ?? 'auto';

  // Handle click on the map canvas to pan the camera
  const handleMapCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * MAP_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * MAP_H;
    const worldX = unprojectX(svgX);
    const worldZ = unprojectZ(svgY);

    setClickPing({ x: svgX, y: svgY, id: Date.now() });
    onPanToLocation?.(worldX, worldZ);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // COMPACT HUD MODE (Always docked in top-right when not expanded)
  // ───────────────────────────────────────────────────────────────────────────
  if (!open) {
    if (isCollapsed) {
      return (
        <aside
          className="pointer-events-auto fixed right-4 top-20 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-[#0a0b10]/90 shadow-[0_10px_25px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-200 hover:border-emerald-500/40 select-none cursor-pointer"
          onClick={() => setIsCollapsed(false)}
          title="Buka Radar HUD (M)"
          aria-label="Radar HUD Mini"
        >
          <Compass size={13} className="text-emerald-400 animate-spin-slow shrink-0" />
          <span className="text-[11px] font-bold text-white tracking-wide">RADAR</span>
          <span className="text-[10px] font-medium text-zinc-300">· {currentZone.shortLabel}</span>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        </aside>
      );
    }

    return (
      <aside
        className="pointer-events-auto fixed right-4 top-20 z-40 flex w-[230px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b10]/90 shadow-[0_14px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-300 hover:border-emerald-500/40 select-none"
        aria-label="Radar HUD Penthouse"
      >
        {/* Compact Header */}
        <header className="flex items-center justify-between border-b border-white/10 px-3 py-2 bg-white/[0.03]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
            <Compass size={13} className="text-emerald-400 animate-spin-slow shrink-0" />
            <span className="tracking-wide">RADAR</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            {onRecenterCamera && (
              <button
                type="button"
                onClick={onRecenterCamera}
                className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Pusatkan kamera ke Bos Raffa (C)"
              >
                <Crosshair size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Kecilkan Radar (Sembunyikan HUD)"
            >
              <Minimize2 size={12} />
            </button>
            <button
              type="button"
              onClick={onToggleOpen}
              className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Perbesar Blueprint Penuh (M)"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </header>

        {/* Current Location Badge */}
        <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.015] px-3 py-1.5 text-[10px]">
          <MapPin size={10} style={{ color: currentZone.color }} className="shrink-0" />
          <span className="truncate font-semibold text-zinc-200">{currentZone.shortLabel}</span>
          <span className="ml-auto text-[9px] font-mono text-zinc-400">
            {raffaBlip ? `${raffaBlip.x.toFixed(1)}, ${raffaBlip.z.toFixed(1)}` : '0.0, 0.0'}
          </span>
        </div>

        {/* Mini Radar Map Canvas */}
        <div className="relative p-2 bg-[#07080d]/80 cursor-crosshair group">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto rounded-xl" onClick={handleMapCanvasClick}>
            <defs>
              <radialGradient id="hudRadarSweepGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width={MAP_W} height={MAP_H} fill="#07090e" />

            {/* Interior Floorplate */}
            <rect
              x={projectX(-16)}
              y={projectZ(-12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(12) - projectZ(-12)}
              fill="#0d111a"
              stroke="#1e293b"
              strokeWidth={1}
            />

            {/* Sky Terrace Floorplate */}
            <rect
              x={projectX(-16)}
              y={projectZ(12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(28) - projectZ(12)}
              fill="#18110b"
              stroke="#452715"
              strokeWidth={1}
            />

            {/* Sliding Doors Line */}
            <line
              x1={projectX(-16)}
              y1={projectZ(12)}
              x2={projectX(16)}
              y2={projectZ(12)}
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.6}
            />

            {/* Radar Circular Range Rings */}
            {raffaBlip && (
              <g transform={`translate(${projectX(raffaBlip.x)}, ${projectZ(raffaBlip.z)})`}>
                <circle r={35} fill="none" stroke="#10b981" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.3} />
                <circle r={75} fill="none" stroke="#10b981" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.2} />
                {/* Rotating Scanner Beam */}
                <g className="animate-radar-sweep origin-center">
                  <line x1={0} y1={0} x2={0} y2={-90} stroke="#10b981" strokeWidth={1} opacity={0.7} />
                  <polygon points="0,0 -30,-85 0,-90" fill="url(#hudRadarSweepGrad)" opacity={0.3} />
                </g>
              </g>
            )}

            {/* Companion Tether Line */}
            {raffaBlip && khansaBlip && (
              <line
                x1={projectX(raffaBlip.x)}
                y1={projectZ(raffaBlip.z)}
                x2={projectX(khansaBlip.x)}
                y2={projectZ(khansaBlip.z)}
                stroke="#f43f5e"
                strokeWidth={1.2}
                strokeDasharray="2 2"
                opacity={0.7}
              />
            )}

            {/* AI Blips */}
            {blips.map((b) => {
              const bx = projectX(b.x);
              const bz = projectZ(b.z);
              const isBoss = b.id === 'raffa';
              const isKhansa = b.id === 'tara' || b.id === 'khansaku';

              return (
                <g key={`mini-${b.id}`}>
                  {(isBoss || isKhansa) && (
                    <circle
                      cx={bx}
                      cy={bz}
                      r={7}
                      fill="none"
                      stroke={b.color}
                      strokeWidth={1}
                      opacity={0.5}
                      className="animate-ping origin-center"
                    />
                  )}
                  <circle
                    cx={bx}
                    cy={bz}
                    r={isBoss || isKhansa ? 4.5 : 3}
                    fill={b.color}
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                  {/* Raffa direction pointer arrow */}
                  {isBoss && b.facing !== undefined && (
                    <g transform={`translate(${bx}, ${bz}) rotate(${(b.facing * 180) / Math.PI + 180})`}>
                      <polygon points="0,-8 -3,-3 3,-3" fill="#fbbf24" opacity={0.9} />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Click Ping Animation */}
            {clickPing && (
              <circle
                key={clickPing.id}
                cx={clickPing.x}
                cy={clickPing.y}
                r={12}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.5}
                className="animate-ping origin-center"
              />
            )}
          </svg>
          <div className="absolute bottom-3 right-3 rounded bg-black/60 px-1 py-0.5 text-[8px] font-mono text-zinc-400 pointer-events-none">
            KLIK: PAN
          </div>
        </div>

        {/* Compact Footer */}
        <footer className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[10px] text-zinc-400 bg-white/[0.02]">
          <span className="font-mono text-zinc-300">{clockStr} WIB</span>
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Radio size={11} className="animate-pulse" />
            <span>Detail (M)</span>
          </button>
        </footer>
      </aside>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EXPANDED TACTICAL BLUEPRINT MODE
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <aside
      className="pointer-events-auto fixed right-4 top-20 z-40 flex h-[min(82vh,740px)] w-[400px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0a0b10]/95 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all duration-300 select-none"
      role="dialog"
      aria-label="Radar Penthouse Blueprint Penuh"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-white/[0.03]">
        <div className="flex items-center gap-2.5 text-xs font-bold text-white tracking-wide">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Compass size={15} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span>Radar Penthouse</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] text-emerald-300 font-mono">
                LIVE 60 FPS
              </span>
            </div>
            <span className="block text-[10px] text-zinc-400 font-mono font-normal">
              WIB UTC+7 · {clockStr}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onRecenterCamera && (
            <button
              type="button"
              className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              onClick={onRecenterCamera}
              title="Pusatkan kamera ke Bos Raffa (C)"
            >
              <Crosshair size={15} />
            </button>
          )}
          <button
            type="button"
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            onClick={onToggleOpen || onClose}
            title="Kecilkan ke HUD Radar (M)"
          >
            <Minimize2 size={15} />
          </button>
          <button
            type="button"
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Tutup radar"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Current Location & Status Strip */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full animate-ping" style={{ backgroundColor: currentZone.color }} />
          <span className="text-[11px] font-bold text-white flex items-center gap-1">
            <MapPin size={12} style={{ color: currentZone.color }} /> {currentZone.label}
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          Pos: {raffaBlip ? `${raffaBlip.x.toFixed(1)}, ${raffaBlip.z.toFixed(1)}` : '0.0, 0.0'}
        </span>
      </div>

      {/* Timezone / Sky Phase Override HUD Toggle (PRD §3.3 & §4) */}
      <div className="border-b border-white/10 bg-[#0d0e15] px-5 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Clock size={12} className="text-amber-400" /> Sky &amp; Lighting Engine
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {activeSkyPhase === 'auto' ? 'WIB Auto-Sync' : 'Manual Override'}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onSelectSkyPhase?.('auto')}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-1.5 border transition-all ${
              activeSkyPhase === 'auto'
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="Sinkronisasi jam nyata otomatis WIB"
          >
            <Clock size={12} />
            <span className="text-[10px]">Auto</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSkyPhase?.('morning')}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-1.5 border transition-all ${
              activeSkyPhase === 'morning'
                ? 'border-amber-400/50 bg-amber-400/20 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.2)]'
                : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="Pagi: Golden sunrise (05:30 - 09:30 WIB)"
          >
            <Sunrise size={12} />
            <span className="text-[10px]">Pagi</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSkyPhase?.('day')}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-1.5 border transition-all ${
              activeSkyPhase === 'day'
                ? 'border-sky-400/50 bg-sky-400/20 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="Siang: Clear bright daylight (09:30 - 15:30 WIB)"
          >
            <Sun size={12} />
            <span className="text-[10px]">Siang</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSkyPhase?.('sunset')}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-1.5 border transition-all ${
              activeSkyPhase === 'sunset'
                ? 'border-orange-400/50 bg-orange-400/20 text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="Sore: Sunset peach-magenta glow (15:30 - 18:15 WIB)"
          >
            <Sunset size={12} />
            <span className="text-[10px]">Sore</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSkyPhase?.('night')}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 px-1.5 border transition-all ${
              activeSkyPhase === 'night'
                ? 'border-violet-400/50 bg-violet-400/20 text-violet-200 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
            title="Malam: Obsidian sky & glowing city lights (18:15 - 05:30 WIB)"
          >
            <Moon size={11} />
            <span className="text-[9px]">Malam</span>
          </button>
        </div>
      </div>

      {/* Blueprint Radar Map Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#07080d] shadow-inner p-1 cursor-crosshair">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto rounded-xl" onClick={handleMapCanvasClick}>
            <defs>
              {/* Teak Deck Pattern for Sky Terrace */}
              <pattern id="teakDeck" width="6" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="3" x2="6" y2="3" stroke="#452715" strokeWidth="0.8" />
              </pattern>
              {/* Floor grid pattern */}
              <pattern id="blueprintGrid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
              </pattern>
              {/* Conical Radar Sweep Gradient */}
              <radialGradient id="radarSweepGradExp" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#10b981" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width={MAP_W} height={MAP_H} fill="#07090e" />
            <rect width={MAP_W} height={MAP_H} fill="url(#blueprintGrid)" />

            {/* 1. Interior Floorplate (z: -12 to 12) */}
            <rect
              x={projectX(-16)}
              y={projectZ(-12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(12) - projectZ(-12)}
              fill="#0b0e17"
              stroke="#1e293b"
              strokeWidth={1.5}
            />

            {/* 2. Rooftop Sky Terrace Floorplate (z: 12 to 28) */}
            <rect
              x={projectX(-16)}
              y={projectZ(12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(28) - projectZ(12)}
              fill="#18110b"
              stroke="#452715"
              strokeWidth={1.5}
            />
            <rect
              x={projectX(-16)}
              y={projectZ(12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(28) - projectZ(12)}
              fill="url(#teakDeck)"
              opacity={0.65}
            />

            {/* North Panoramic Glass Windows Marker */}
            <line
              x1={projectX(-16)}
              y1={projectZ(-12)}
              x2={projectX(16)}
              y2={projectZ(-12)}
              stroke="#38bdf8"
              strokeWidth={3}
              strokeDasharray="6 2"
            />
            <text x={MAP_W / 2} y={projectZ(-12) - 4} textAnchor="middle" className="fill-sky-400 text-[8px] font-mono tracking-widest font-bold">
              NORTH PANORAMA SKYLINE GLASS (360° VIEW)
            </text>

            {/* Sliding Acoustic Glass Doors (z = 12) */}
            <line
              x1={projectX(-16)}
              y1={projectZ(12)}
              x2={projectX(-3.2)}
              y2={projectZ(12)}
              stroke="#10b981"
              strokeWidth={2}
            />
            <line
              x1={projectX(3.2)}
              y1={projectZ(12)}
              x2={projectX(16)}
              y2={projectZ(12)}
              stroke="#10b981"
              strokeWidth={2}
            />
            {/* Door Portal opening */}
            <rect
              x={projectX(-3.2)}
              y={projectZ(11.7)}
              width={projectX(3.2) - projectX(-3.2)}
              height={projectZ(12.3) - projectZ(11.7)}
              fill="#10b981"
              opacity={0.35}
            />
            <text x={MAP_W / 2} y={projectZ(12) + 3.5} textAnchor="middle" className="fill-emerald-400 text-[7px] font-mono font-bold select-none">
              SLIDING GLASS DOORS ⇄ ROOFTOP
            </text>

            {/* Frameless Glass Balustrade on Terrace Perimeter */}
            <polyline
              points={`
                ${projectX(-16)},${projectZ(12)} 
                ${projectX(-16)},${projectZ(28)} 
                ${projectX(16)},${projectZ(28)} 
                ${projectX(16)},${projectZ(12)}
              `}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="4 2"
            />

            {/* 6 Zones Overlays & Click Handlers (PRD §4) */}
            {ZONES.map((z) => {
              const x1 = projectX(z.rect.x1);
              const y1 = projectZ(z.rect.z1);
              const w = projectX(z.rect.x2) - x1;
              const h = projectZ(z.rect.z2) - y1;
              const isCurrent = currentZone.id === z.id;

              return (
                <g
                  key={z.id}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusZone(z);
                  }}
                >
                  <rect
                    x={x1}
                    y={y1}
                    width={w}
                    height={h}
                    rx={6}
                    fill={z.color}
                    fillOpacity={isCurrent ? 0.22 : 0.08}
                    stroke={z.color}
                    strokeWidth={isCurrent ? 1.8 : 0.8}
                    strokeOpacity={isCurrent ? 0.8 : 0.4}
                    className="transition-all duration-200 hover:fill-opacity-25 hover:stroke-opacity-100"
                  >
                    <title>{z.label} — Klik untuk fokus kamera</title>
                  </rect>
                  <text
                    x={x1 + 6}
                    y={y1 + 13}
                    fill={z.color}
                    className="text-[8.5px] font-bold tracking-wide select-none"
                  >
                    {z.label}
                  </text>
                </g>
              );
            })}

            {/* Landmark Furniture Icons in Penthouse */}
            {/* Executive Royal Rug */}
            <rect
              x={projectX(-11.9)}
              y={projectZ(-9.6)}
              width={projectX(-4.1) - projectX(-11.9)}
              height={projectZ(-3.4) - projectZ(-9.6)}
              rx={3}
              fill="#06281e"
              stroke="#f59e0b"
              strokeWidth={0.8}
            />

            {/* War-Room Holographic Circle & Wallboard */}
            <circle
              cx={projectX(9.5)}
              cy={projectZ(0)}
              r={18}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.2}
              strokeDasharray="4 2"
              className="animate-spin-slow origin-center"
            />
            <circle cx={projectX(9.5)} cy={projectZ(0)} r={7} fill="#10b981" opacity={0.35} />
            <text x={projectX(9.5)} y={projectZ(0) + 12} textAnchor="middle" className="fill-emerald-300 text-[7.5px] font-bold">
              🌐 Holotable
            </text>
            <rect
              x={projectX(5.8)}
              y={projectZ(-4.6)}
              width={projectX(11.2) - projectX(5.8)}
              height={2.5}
              rx={1}
              fill="#06b6d4"
              opacity={0.85}
            />
            <text x={projectX(8.5)} y={projectZ(-4.6) - 2} textAnchor="middle" className="fill-cyan-300 text-[6.5px] font-mono font-semibold">
              📊 Wallboard Hologram
            </text>

            {/* Espresso Pantry Counter */}
            <rect
              x={projectX(6.5)}
              y={projectZ(7)}
              width={projectX(10.5) - projectX(6.5)}
              height={projectZ(10.5) - projectZ(7)}
              rx={3}
              fill="#2e1a0d"
              stroke="#f59e0b"
              strokeWidth={0.8}
              strokeDasharray="2 1"
            />
            <text x={projectX(8.5)} y={projectZ(8.8)} textAnchor="middle" className="fill-amber-300 text-[7px] font-bold">
              ☕ Espresso Bar
            </text>

            {/* Terrace Landmarks */}
            {/* L-Sofa */}
            <path
              d={`
                M ${projectX(-11)} ${projectZ(17)}
                L ${projectX(-5)} ${projectZ(17)}
                L ${projectX(-5)} ${projectZ(18.5)}
                L ${projectX(-9)} ${projectZ(18.5)}
                L ${projectX(-9)} ${projectZ(20.5)}
                L ${projectX(-11)} ${projectZ(20.5)}
                Z
              `}
              fill="#27272a"
              stroke="#52525b"
              strokeWidth={0.8}
            />
            <text x={projectX(-7.5)} y={projectZ(19.8)} textAnchor="middle" className="fill-amber-200 text-[7px]">
              🛋️ Outdoor Lounge
            </text>

            {/* Arcade Cabinet */}
            <rect
              x={projectX(9.5)}
              y={projectZ(15)}
              width={projectX(12.5) - projectX(9.5)}
              height={projectZ(17.5) - projectZ(15)}
              rx={2}
              fill="#8b5cf6"
              opacity={0.7}
            />
            <text x={projectX(11)} y={projectZ(16.5) - 1} textAnchor="middle" className="fill-white text-[7px] font-bold">
              🕹️ Arcade
            </text>

            {/* Sky Darts Board */}
            <rect
              x={projectX(10.5)}
              y={projectZ(22)}
              width={projectX(13.5) - projectX(10.5)}
              height={projectZ(24.5) - projectZ(22)}
              rx={2}
              fill="#ef4444"
              opacity={0.65}
            />
            <text x={projectX(12)} y={projectZ(23.5) - 1} textAnchor="middle" className="fill-white text-[7px] font-bold">
              🎯 Darts
            </text>

            {/* Telescope */}
            <circle cx={projectX(-11.5)} cy={projectZ(24.5)} r={5} fill="#e4e4e7" stroke="#38bdf8" strokeWidth={1} />
            <text x={projectX(-11.5)} y={projectZ(24.5) + 10} textAnchor="middle" className="fill-sky-300 text-[6.5px]">
              🔭 Telescope
            </text>

            {/* Workstations for all 9 Agents */}
            {AGENTS.map((agent) => {
              const isTara = agent.id === 'tara';
              const isTrading = agent.workspace === 'trading';
              const dw = isTara ? 24 : 18;
              const dh = isTara ? 13 : 10;
              const dx = projectX(agent.desk.x) - dw / 2;
              const dy = projectZ(agent.desk.z) - dh / 2;
              const color = agent.color || '#38bdf8';

              return (
                <g
                  key={`desk-${agent.id}`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusAgent(agent.id);
                  }}
                >
                  {/* Chair */}
                  <rect
                    x={dx + 3}
                    y={agent.desk.rot === 0 ? dy + dh + 1 : dy - 5}
                    width={dw - 6}
                    height={4}
                    rx={1}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={0.5}
                  />
                  {/* Desk surface */}
                  <rect
                    x={dx}
                    y={dy}
                    width={dw}
                    height={dh}
                    rx={2}
                    fill="#0f172a"
                    stroke={isTara ? '#f59e0b' : isTrading ? color : '#334155'}
                    strokeWidth={1}
                    className="transition-colors group-hover:stroke-white"
                  >
                    <title>{agent.fullName} ({agent.employeeId}) — Klik untuk fokus kamera</title>
                  </rect>
                  {/* Glowing monitors */}
                  <rect
                    x={dx + 2}
                    y={agent.desk.rot === 0 ? dy + 1 : dy + dh - 2.5}
                    width={dw / 2 - 2.5}
                    height={1.5}
                    rx={0.5}
                    fill={color}
                    opacity={0.8}
                  />
                  <rect
                    x={dx + dw / 2 + 1}
                    y={agent.desk.rot === 0 ? dy + 1 : dy + dh - 2.5}
                    width={dw / 2 - 2.5}
                    height={1.5}
                    rx={0.5}
                    fill={color}
                    opacity={0.8}
                  />
                  {/* Label on desk */}
                  <text
                    x={dx + dw / 2}
                    y={dy + dh / 2 + 2.5}
                    textAnchor="middle"
                    className="fill-zinc-300 text-[6px] font-mono font-bold pointer-events-none group-hover:fill-white select-none"
                  >
                    {isTara ? '👑 KHANSA' : agent.name.slice(0, 4).toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Radar Circular Scan Grid Centered on Raffa */}
            {raffaBlip && (
              <g transform={`translate(${projectX(raffaBlip.x)}, ${projectZ(raffaBlip.z)})`}>
                <circle r={45} fill="none" stroke="#10b981" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.3} />
                <circle r={90} fill="none" stroke="#10b981" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.2} />
                {/* Rotating Scanner Beam */}
                <g className="animate-radar-sweep origin-center">
                  <line x1={0} y1={0} x2={0} y2={-110} stroke="#10b981" strokeWidth={1.2} opacity={0.7} />
                  <polygon points="0,0 -40,-105 0,-110" fill="url(#radarSweepGradExp)" opacity={0.35} />
                </g>
              </g>
            )}

            {/* Companion Tether Line between Raffa and Khansaku */}
            {(() => {
              if (raffaBlip && khansaBlip) {
                const rx = projectX(raffaBlip.x);
                const rz = projectZ(raffaBlip.z);
                const kx = projectX(khansaBlip.x);
                const kz = projectZ(khansaBlip.z);
                const distMeters = Math.hypot(raffaBlip.x - khansaBlip.x, raffaBlip.z - khansaBlip.z);

                return (
                  <g>
                    <line
                      x1={rx}
                      y1={rz}
                      x2={kx}
                      y2={kz}
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      opacity={0.75}
                    />
                    <text
                      x={(rx + kx) / 2}
                      y={(rz + kz) / 2 - 3}
                      textAnchor="middle"
                      className="fill-rose-300 text-[7px] font-mono font-bold pointer-events-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                    >
                      {distMeters.toFixed(1)}m
                    </text>
                  </g>
                );
              }
              return null;
            })()}

            {/* Live Characters & AI Blips (Smooth Real-Time Tracking) */}
            {blips.map((b) => {
              const bx = projectX(b.x);
              const bz = projectZ(b.z);
              const isBoss = b.id === 'raffa';
              const isKhansa = b.id === 'khansaku' || b.id === 'tara';

              return (
                <g
                  key={b.id}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusAgent(b.id === 'khansaku' ? 'tara' : b.id);
                  }}
                  onMouseEnter={() => setSelectedAgentInfo(b.id)}
                  onMouseLeave={() => setSelectedAgentInfo(null)}
                >
                  {/* Outer animated halo ring for VIPs */}
                  {(isBoss || isKhansa) && (
                    <circle
                      cx={bx}
                      cy={bz}
                      r={10}
                      fill="none"
                      stroke={b.color}
                      strokeWidth={1.5}
                      opacity={0.5}
                      className="animate-ping origin-center"
                    />
                  )}

                  {/* Blip Circle */}
                  <circle
                    cx={bx}
                    cy={bz}
                    r={isBoss || isKhansa ? 5.5 : 4}
                    fill={b.color}
                    stroke="#ffffff"
                    strokeWidth={1.2}
                    className="transition-transform duration-150 group-hover:scale-150 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                  />

                  {/* Heading direction arrow for Raffa */}
                  {isBoss && b.facing !== undefined && (
                    <g transform={`translate(${bx}, ${bz}) rotate(${(b.facing * 180) / Math.PI + 180})`}>
                      <polygon points="0,-11 -4,-4 4,-4" fill="#fbbf24" opacity={0.9} />
                    </g>
                  )}

                  {/* Name Tooltip Tag */}
                  <title>{b.label} (Klik untuk teleport)</title>
                  <text
                    x={bx}
                    y={bz - 7}
                    textAnchor="middle"
                    className="fill-white text-[7.5px] font-mono font-bold pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,1)] select-none"
                  >
                    {isBoss ? '👑 Raffa' : isKhansa ? '💖 Khansa' : b.label.split(' ')[0]}
                  </text>
                </g>
              );
            })}

            {/* Click-to-pan Ripple Animation */}
            {clickPing && (
              <circle
                key={clickPing.id}
                cx={clickPing.x}
                cy={clickPing.y}
                r={16}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2}
                className="animate-ping origin-center"
              />
            )}

            {/* Blueprint Coordinates Watermark */}
            <text x={MAP_W - 8} y={MAP_H - 8} textAnchor="end" className="fill-zinc-500 text-[7px] font-mono">
              PENTHOUSE ARCHITECTURE · WIB UTC+7
            </text>
          </svg>
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 text-[9px] font-mono text-zinc-300 border border-white/10 pointer-events-none">
            🖱️ Klik lokasi peta untuk pan kamera
          </div>
        </div>

        {/* Segmented Sub-Navigation: Tim & Bot vs 6 Zona */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
              activeTab === 'agents'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
            }`}
          >
            <Users size={14} />
            <span>Tim &amp; Bot ({AGENTS.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zones')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all ${
              activeTab === 'zones'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
            }`}
          >
            <MapPin size={14} />
            <span>6 Zona Penthouse</span>
          </button>
        </div>

        {activeTab === 'agents' && (
          <div className="space-y-4">
            {/* Section: VIP & Trading Division */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" /> Executive &amp; Trading Bots
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Klik untuk navigasi</span>
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  className="flex items-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-left text-xs text-rose-200 hover:bg-rose-500/20 transition-all hover:-translate-y-0.5"
                  onClick={() => onFocusAgent('tara')}
                >
                  <span className="text-base shrink-0">💖</span>
                  <div className="truncate">
                    <span className="font-bold text-rose-300 text-xs block">Khansaku</span>
                    <span className="block text-[10px] text-zinc-400 truncate mt-0.5">First Lady · {employeeStates['tara'] || 'Active'}</span>
                  </div>
                </button>

                {tradingDesks.map((a) => {
                  const state = employeeStates[a.id] || 'working';
                  const focus = employeeFocus[a.id] ?? 100;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left text-xs text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 transition-all hover:-translate-y-0.5"
                      onClick={() => onFocusAgent(a.id)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                      <div className="truncate">
                        <span className="font-semibold text-white text-xs block">{a.name}</span>
                        <span className="block text-[10px] text-zinc-400 truncate mt-0.5">
                          {a.short} · {state === 'pantry' ? 'Ngopi' : state === 'terrace' ? 'Teras' : `${focus}% Focus`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: Engineering Wing */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Compass size={13} className="text-sky-400" /> Engineering Staff ({engDesks.length})
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">100% Ready</span>
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {engDesks.map((a) => {
                  const state = employeeStates[a.id] || 'working';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all hover:-translate-y-0.5"
                      onClick={() => onFocusAgent(a.id)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                      <div className="truncate">
                        <span className="font-semibold text-white text-xs block">{a.name}</span>
                        <span className="block text-[10px] text-zinc-400 truncate mt-0.5">
                          {a.short} · {state === 'pantry' ? 'Ngopi' : state === 'terrace' ? 'Teras' : 'Coding'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Eye size={13} className="text-emerald-400" /> 6 Integrated Penthouse Zones
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Klik untuk fokus kamera</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {ZONES.map((z) => {
                const isCurrent = currentZone.id === z.id;
                return (
                  <button
                    key={`btn-zone-${z.id}`}
                    type="button"
                    onClick={() => onFocusZone(z)}
                    className={`rounded-2xl border p-3 text-left text-xs transition-all hover:-translate-y-0.5 ${
                      isCurrent
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                        : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{z.label}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/30 text-emerald-200 font-mono font-bold">
                          Lokasi Bos
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 block line-clamp-1">{z.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function blipsFromScene(
  playerPos: { x: number; z: number; facing?: number },
  khansaPos: { x: number; z: number; facing?: number },
  agentPos: { id: string; x: number; z: number; name: string; color: string }[]
): Blip[] {
  return [
    {
      id: 'raffa',
      x: playerPos.x,
      z: playerPos.z,
      facing: playerPos.facing,
      label: `${BOSS.name} (Bos Raffa) 👑`,
      color: '#fbbf24',
    },
    {
      id: 'tara',
      x: khansaPos.x,
      z: khansaPos.z,
      facing: khansaPos.facing,
      label: 'Khansaku 💖',
      color: '#f43f5e',
    },
    ...agentPos
      .filter((a) => a.id !== 'tara')
      .map((a) => ({ id: a.id, x: a.x, z: a.z, label: `${a.name} (${a.id})`, color: a.color })),
  ];
}