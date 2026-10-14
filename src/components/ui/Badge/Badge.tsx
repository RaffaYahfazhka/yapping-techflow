'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  variant?: 'default' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'blue';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const VARIANT_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-400',
    border: 'border-violet-500/30',
    dot: 'bg-violet-400 shadow-[0_0_8px_#8b5cf6]',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
  },
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    dot: 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]',
  },
  blue: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400 shadow-[0_0_8px_#3b82f6]',
  },
  default: {
    bg: 'bg-white/5',
    text: 'text-zinc-300',
    border: 'border-white/10',
    dot: 'bg-zinc-400',
  },
};

const SIZE_MAP: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-0.5 text-[11px] gap-1.5',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
  ...props
}: BadgeProps) {
  const conf = VARIANT_MAP[variant] || VARIANT_MAP.default;
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border transition-all select-none backdrop-blur-sm ${conf.bg} ${conf.text} ${conf.border} ${sizeCls} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dot}`} />}
      {children}
    </span>
  );
}
