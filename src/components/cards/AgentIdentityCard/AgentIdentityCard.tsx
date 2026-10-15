'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../ui/lib/cn';

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{
        y: -3,
        transition: { type: 'spring', stiffness: 400, damping: 22 },
      }}
      className={cn(
        'group relative flex flex-col justify-between gap-4 p-5 overflow-hidden',
        'rounded-[20px]',
        'bg-[#111218]/[0.95] backdrop-blur-xl',
        'border border-white/[0.07]',
        'shadow-[0_12px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]',
        'hover:border-white/[0.12] hover:shadow-[0_18px_52px_rgba(0,0,0,0.55)]',
        'transition-[border,box-shadow] duration-300',
        'font-sans select-none',
        className
      )}
      style={{ borderColor: `${color}25` }}
    >
      {/* Top glow accent — animated on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {/* Ambient glow in corner */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: color, opacity: 'inherit' }}
      />

      {/* Header ID */}
      <div className="flex items-center justify-between relative z-10">
        <span className="font-mono text-[11px] font-bold text-zinc-500">
          {agent.employeeId || `EMP-${agent.id?.toUpperCase()}`}
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/[0.08] text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
          ACTIVE
        </span>
      </div>

      {/* Profile info */}
      <div className="flex items-center gap-3.5 relative z-10">
        <div
          className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 border flex items-center justify-center bg-black/30 backdrop-blur-sm"
          style={{ borderColor: `${color}35` }}
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
          <div className="text-sm font-bold text-white truncate tracking-[-0.01em]">
            {agent.fullName || agent.name}
          </div>
          <div
            className="inline-block mt-0.5 text-xs font-semibold truncate"
            style={{ color }}
          >
            {agent.role}
          </div>
        </div>
      </div>

      {/* Duties description */}
      {agent.duties && (
        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 relative z-10">
          {agent.duties}
        </p>
      )}

      {/* Skills list */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 relative z-10">
          {agent.skills.map((s, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-white/[0.04] border border-white/[0.06] text-zinc-400 transition-colors duration-200 hover:bg-white/[0.06] hover:text-zinc-300"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/[0.05] relative z-10">
        {onOpenWorkspace && (
          <motion.button
            type="button"
            onClick={() => onOpenWorkspace(agent.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white whitespace-nowrap transition-all duration-200"
            style={{
              backgroundColor: color,
              boxShadow: `0 4px 16px ${color}30`,
            }}
          >
            Buka Workspace
          </motion.button>
        )}
        {onFocusDesk && (
          <motion.button
            type="button"
            onClick={() => onFocusDesk(agent.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            title="Sorot meja di scene 3D"
            className="py-2 px-3 rounded-xl text-xs font-semibold text-zinc-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:text-white whitespace-nowrap shrink-0 transition-all duration-200"
          >
            Meja 🎯
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
