'use client';

/**
 * HUD minimap — DOM-only radar. Projects zone rects, Raffa/Khansaku/agent blips
 * from the imperative scene, and zone-click camera focus.
 * Uses zone defs from OfficeCanvas; no CSS imports (Tailwind utilities only).
 */

import { X, Map as MapIcon, Compass } from 'lucide-react';
import { ZONES, type ZoneDef } from '@/components/canvas/OfficeCanvas';
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

const MAP_W = 320;
const MAP_H = 320;
const WORLD_MIN = -20;
const WORLD_MAX = 32;

const projectX = (x: number) => ((x - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * MAP_W;
const projectZ = (z: number) => ((z - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * MAP_H;

export default function OfficeMinimap({ open, onClose, onFocusZone, onFocusAgent, blips, clockStr }: OfficeMinimapProps) {
  if (!open) return null;
  const tradingDesks = AGENTS.filter((a) => a.workspace === 'trading');
  const engDesks = AGENTS.filter((a) => a.workspace !== 'trading');

  return (
    <aside
      className="pointer-events-auto absolute right-4 top-16 z-40 flex max-h-[80vh] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 shadow-2xl backdrop-blur-xl"
      role="dialog"
      aria-label="Radar Peta Kantor"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <MapIcon size={14} className="text-emerald-400" /> PentaRadar · {clockStr ?? '--:--:--'} WIB
        </div>
        <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200" onClick={onClose} aria-label="Tutup minimap">
          <X size={14} />
        </button>
      </header>

      <div className="relative flex-1 p-3">
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-64 w-full rounded-xl bg-slate-900/60">
          {ZONES.map((z) => (
            <g key={z.id}>
              <rect
                x={projectX(z.rect.x1)}
                y={projectZ(z.rect.z1)}
                width={Math.max(2, projectX(z.rect.x2) - projectX(z.rect.x1))}
                height={Math.max(2, projectZ(z.rect.z2) - projectZ(z.rect.z1))}
                className="cursor-pointer fill-emerald-500/10 stroke-emerald-500/40"
                strokeWidth={1}
                onClick={() => onFocusZone(z)}
              >
                <title>{z.label} — klik untuk fokus kamera</title>
              </rect>
              <text x={projectX(z.rect.x1) + 4} y={projectZ(z.rect.z1) + 12} className="fill-slate-400 text-[9px] font-semibold">
                {z.label}
              </text>
            </g>
          ))}
          {blips.map((b) => (
            <circle key={b.id} cx={projectX(b.x)} cy={projectZ(b.z)} r={4} className="cursor-pointer" fill={b.color} onClick={() => onFocusAgent(b.id)}>
              <title>{b.label}</title>
            </circle>
          ))}
          <text x={MAP_W - 60} y={MAP_H - 8} className="fill-slate-500 text-[8px]">
            WIB · {clockStr ?? ''}
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {tradingDesks.map((a) => (
            <button key={a.id} type="button" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[10px] text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-500/10" onClick={() => onFocusAgent(a.id)} aria-label={`Fokus ${a.name}`}>
              <span style={{ color: a.color }}>{a.name}</span> · {a.employeeId}
            </button>
          ))}
        </div>

        <details className="mt-3 text-[10px] text-slate-400">
          <summary className="cursor-pointer flex items-center gap-1 text-slate-500">
            <Compass size={10} /> Engineering ({engDesks.length})
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {engDesks.map((a) => (
              <button key={a.id} type="button" className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-left text-[10px] text-slate-300 hover:bg-white/10" onClick={() => onFocusAgent(a.id)} aria-label={`Fokus ${a.name}`}>
                {a.name}
              </button>
            ))}
          </div>
        </details>
      </div>
    </aside>
  );
}

export function blipsFromScene(playerPos: { x: number; z: number }, khansaPos: { x: number; z: number }, agentPos: { id: string; x: number; z: number; name: string; color: string }[]): Blip[] {
  return [
    { id: 'raffa', x: playerPos.x, z: playerPos.z, label: `${BOSS.name} 👑`, color: '#fbbf24' },
    { id: 'khansaku', x: khansaPos.x, z: khansaPos.z, label: 'Khansaku 💖', color: '#f43f5e' },
    ...agentPos.map((a) => ({ id: a.id, x: a.x, z: a.z, label: `${a.name} ${a.color}`, color: a.color })),
  ];
}