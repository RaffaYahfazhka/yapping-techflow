'use client';

import React from 'react';

export interface Agent {
  id: string;
  name: string;
  fullName?: string;
  role: string;
  department?: string;
  employeeId?: string;
  duties?: string;
  color?: string;
  avatar?: string;
  skills?: string[];
  [key: string]: unknown;
}

export interface AgentIdentityCardProps {
  agent: Agent;
  onOpenWorkspace?: (id: string) => void;
  onFocusDesk?: (id: string) => void;
  className?: string;
  compact?: boolean;
}

function getAgentInitials(agent: Agent) {
  const source = String(agent.fullName || agent.name || agent.id || '').replace(/[()]/g, ' ');
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function AgentIdentityCard({
  agent,
  onOpenWorkspace,
  onFocusDesk,
  className = '',
}: AgentIdentityCardProps) {
  if (!agent) return null;
  const color = agent.color || '#10b981';

  return (
    <div
      className={`relative flex flex-col justify-between gap-3.5 p-5 rounded-2xl bg-[#111218] border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)] hover:border-white/25 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] transition-all duration-200 overflow-hidden font-sans select-none ${className}`}
      style={{ borderColor: `${color}40` }}
    >
      {/* Top glow accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {/* Header ID */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-zinc-400">
          {agent.employeeId || `EMP-${agent.id?.toUpperCase()}`}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          ACTIVE
        </span>
      </div>

      {/* Profile info */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center bg-black/40"
          style={{ borderColor: `${color}60` }}
        >
          {agent.avatar ? (
            <img src={agent.avatar} alt={agent.fullName || agent.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-sm" style={{ color }} aria-hidden="true">
              {getAgentInitials(agent)}
            </span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="text-sm font-bold text-white truncate">{agent.fullName || agent.name}</div>
          <div
            className="inline-block mt-0.5 text-[11px] font-semibold truncate"
            style={{ color }}
          >
            {agent.role}
          </div>
        </div>
      </div>

      {/* Duties description */}
      {agent.duties && (
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
          {agent.duties}
        </p>
      )}

      {/* Skills list */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.skills.map((s, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-300"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={() => onOpenWorkspace(agent.id)}
            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: color }}
          >
            Buka Workspace
          </button>
        )}
        {onFocusDesk && (
          <button
            type="button"
            onClick={() => onFocusDesk(agent.id)}
            title="Sorot meja di scene 3D"
            className="py-1.5 px-3 rounded-xl text-xs font-semibold text-zinc-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
          >
            Meja 🎯
          </button>
        )}
      </div>
    </div>
  );
}
