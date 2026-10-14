'use client';

/**
 * HUD Penthouse Minimap — Architectural Radar.
 * Projects accurate penthouse interior zones, rooftop terrace, furniture landmarks,
 * and live blips for Bos Raffa, Khansaku, and the 9 AI staff members.
 */

import { X, Map as MapIcon, Compass, Sparkles } from 'lucide-react';
import { ZONES, type ZoneDef } from '@/lib/data/zones';
import { AGENTS, BOSS } from '@/lib/data/agents';

export interface Blip {
  id: string;
  x: number;
  z: number;
  label: string;
  color: string;
}

export interface OfficeMinimapProps {
  open: boolean;
  onClose: () => void;
  onFocusZone: (z: ZoneDef) => void;
  onFocusAgent: (agentId: string) => void;
  /** Live positions read from the imperative scene's camera/player state. */
  blips: Blip[];
  clockStr?: string;
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

export default function OfficeMinimap({
  open,
  onClose,
  onFocusZone,
  onFocusAgent,
  blips,
  clockStr,
}: OfficeMinimapProps) {
  if (!open) return null;
  const tradingDesks = AGENTS.filter((a) => a.workspace === 'trading');
  const engDesks = AGENTS.filter((a) => a.workspace !== 'trading');

  return (
    <aside
      className="pointer-events-auto absolute right-5 top-20 z-40 flex max-h-[85vh] w-[380px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0a0b10]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      role="dialog"
      aria-label="Radar Peta Penthouse"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-white/[0.02]">
        <div className="flex items-center gap-2.5 text-xs font-bold text-white tracking-wide">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Compass size={14} className="animate-spin-slow" />
          </div>
          <span>Penthouse Suite Radar · {clockStr ?? '--:--:--'} WIB</span>
        </div>
        <button
          type="button"
          className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          onClick={onClose}
          aria-label="Tutup radar"
        >
          <X size={16} />
        </button>
      </header>

      {/* Blueprint Radar Map Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#08090e] shadow-inner p-1">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto rounded-xl">
            <defs>
              {/* Teak Deck Pattern for Sky Terrace */}
              <pattern id="teakDeck" width="6" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="3" x2="6" y2="3" stroke="#452715" strokeWidth="0.8" />
              </pattern>
              {/* Floor grid pattern */}
              <pattern id="blueprintGrid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />
              </pattern>
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
              fill="#0d111a"
              stroke="#1e293b"
              strokeWidth={1.5}
            />

            {/* 2. Rooftop Sky Terrace Floorplate (z: 12 to 28) */}
            <rect
              x={projectX(-16)}
              y={projectZ(12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(28) - projectZ(12)}
              fill="#1a110a"
              stroke="#452715"
              strokeWidth={1.5}
            />
            <rect
              x={projectX(-16)}
              y={projectZ(12)}
              width={projectX(16) - projectX(-16)}
              height={projectZ(28) - projectZ(12)}
              fill="url(#teakDeck)"
              opacity={0.6}
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
              PANORAMA SKYLINE GLASS (360° WIB VIEW)
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
            <text x={MAP_W / 2} y={projectZ(12) + 3} textAnchor="middle" className="fill-emerald-400 text-[7px] font-mono font-bold">
              DOORS ⇄ TERAS
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

            {/* Zones Overlays & Click Handlers */}
            {ZONES.map((z) => {
              const x1 = projectX(z.rect.x1);
              const y1 = projectZ(z.rect.z1);
              const w = projectX(z.rect.x2) - x1;
              const h = projectZ(z.rect.z2) - y1;

              const isTerrace = z.id === 'terrace';
              const isExec = z.id === 'executive';

              return (
                <g key={z.id} className="cursor-pointer group" onClick={() => onFocusZone(z)}>
                  <rect
                    x={x1}
                    y={y1}
                    width={w}
                    height={h}
                    rx={6}
                    className={`transition-all duration-200 ${
                      isExec
                        ? 'fill-rose-500/10 stroke-rose-500/40 hover:fill-rose-500/20'
                        : isTerrace
                        ? 'fill-amber-500/10 stroke-amber-500/40 hover:fill-amber-500/20'
                        : 'fill-emerald-500/10 stroke-emerald-500/30 hover:fill-emerald-500/20'
                    }`}
                    strokeWidth={1}
                  >
                    <title>{z.label} — Klik untuk fokus kamera</title>
                  </rect>
                  <text
                    x={x1 + 6}
                    y={y1 + 13}
                    className={`text-[9px] font-bold tracking-wide select-none ${
                      isExec ? 'fill-rose-300' : isTerrace ? 'fill-amber-300' : 'fill-slate-300'
                    }`}
                  >
                    {z.label}
                  </text>
                </g>
              );
            })}

            {/* Landmark Furniture Icons in Penthouse */}
            {/* Executive Rug & Royal Desk */}
            <rect
              x={projectX(-11)}
              y={projectZ(-9)}
              width={projectX(-5) - projectX(-11)}
              height={projectZ(-4) - projectZ(-9)}
              rx={3}
              fill="#06281e"
              stroke="#f59e0b"
              strokeWidth={0.8}
            />
            <text x={projectX(-8)} y={projectZ(-6.5) - 4} textAnchor="middle" className="fill-amber-300 text-[7px] font-semibold">
              👑 Royal Suite
            </text>

            {/* War-Room Holographic Circle */}
            <circle
              cx={projectX(9.5)}
              cy={projectZ(0)}
              r={16}
              fill="none"
              stroke="#10b981"
              strokeWidth={1.2}
              strokeDasharray="3 2"
            />
            <circle cx={projectX(9.5)} cy={projectZ(0)} r={6} fill="#10b981" opacity={0.3} />
            <text x={projectX(9.5)} y={projectZ(0) + 12} textAnchor="middle" className="fill-emerald-300 text-[7.5px] font-bold">
              🌐 Holotable
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

            {/* Live Characters & AI Blips */}
            {blips.map((b) => {
              const bx = projectX(b.x);
              const bz = projectZ(b.z);
              const isBoss = b.id === 'raffa';
              const isKhansa = b.id === 'khansaku';

              return (
                <g key={b.id} className="cursor-pointer group" onClick={() => onFocusAgent(b.id)}>
                  {/* Outer animated halo ring for VIPs */}
                  {(isBoss || isKhansa) && (
                    <circle
                      cx={bx}
                      cy={bz}
                      r={9}
                      fill="none"
                      stroke={b.color}
                      strokeWidth={1.5}
                      opacity={0.6}
                      className="animate-ping"
                    />
                  )}
                  {/* Blip Circle */}
                  <circle
                    cx={bx}
                    cy={bz}
                    r={isBoss || isKhansa ? 5.5 : 4}
                    fill={b.color}
                    stroke="#ffffff"
                    strokeWidth={1}
                    className="transition-transform hover:scale-125"
                  />
                  {/* Small Name Tooltip Tag */}
                  <title>{b.label} (Klik untuk teleport)</title>
                  <text
                    x={bx}
                    y={bz - 7}
                    textAnchor="middle"
                    className="fill-white text-[7.5px] font-mono font-semibold pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  >
                    {b.id === 'raffa' ? '👑 Raffa' : b.id === 'khansaku' ? '💖 Khansa' : b.label.split(' ')[0]}
                  </text>
                </g>
              );
            })}

            {/* Watermark */}
            <text x={MAP_W - 8} y={MAP_H - 8} textAnchor="end" className="fill-zinc-500 text-[7.5px] font-mono">
              PENTHOUSE ARCHITECTURE · WIB UTC+7
            </text>
          </svg>
        </div>

        {/* Section: VIP & Trading Bots Roster */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-400" /> Executive &amp; Trading Bots
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/20 transition-all"
              onClick={() => onFocusAgent('tara')}
            >
              <span className="text-base">💖</span>
              <div className="truncate">
                <span className="font-bold text-rose-300">Khansaku</span>
                <span className="block text-[10px] text-zinc-400">First Lady</span>
              </div>
            </button>

            {tradingDesks.map((a) => (
              <button
                key={a.id}
                type="button"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-zinc-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 transition-all"
                onClick={() => onFocusAgent(a.id)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <div className="truncate">
                  <span className="font-semibold text-white">{a.name}</span>
                  <span className="block text-[10px] text-zinc-400">{a.role.split(' ')[0]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section: Engineering Wing */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
            <Compass size={12} className="text-sky-400" /> Engineering Staff ({engDesks.filter(a => a.id !== 'tara').length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {engDesks
              .filter((a) => a.id !== 'tara')
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
                  onClick={() => onFocusAgent(a.id)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="truncate">{a.name} ({a.short})</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function blipsFromScene(
  playerPos: { x: number; z: number },
  khansaPos: { x: number; z: number },
  agentPos: { id: string; x: number; z: number; name: string; color: string }[]
): Blip[] {
  return [
    { id: 'raffa', x: playerPos.x, z: playerPos.z, label: `${BOSS.name} 👑`, color: '#fbbf24' },
    { id: 'khansaku', x: khansaPos.x, z: khansaPos.z, label: 'Khansaku 💖', color: '#f43f5e' },
    ...agentPos.map((a) => ({ id: a.id, x: a.x, z: a.z, label: `${a.name} ${a.color}`, color: a.color })),
  ];
}