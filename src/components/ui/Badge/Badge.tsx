'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../lib/cn';

export interface BadgeProps extends Omit<HTMLMotionProps<'span'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'default' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'blue';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
  pulse?: boolean;
}

const VARIANT_MAP: Record<string, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  glow: string;
}> = {
  emerald: {
    bg: 'bg-emerald-500/[0.08]',
    text: 'text-emerald-400',
    border: 'border-emerald-500/[0.15]',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.12)]',
  },
  violet: {
    bg: 'bg-violet-500/[0.08]',
    text: 'text-violet-400',
    border: 'border-violet-500/[0.15]',
    dot: 'bg-violet-400',
    glow: 'shadow-[0_0_10px_rgba(139,92,246,0.12)]',
  },
  amber: {
    bg: 'bg-amber-500/[0.08]',
    text: 'text-amber-400',
    border: 'border-amber-500/[0.15]',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.12)]',
  },
  rose: {
    bg: 'bg-rose-500/[0.08]',
    text: 'text-rose-400',
    border: 'border-rose-500/[0.15]',
    dot: 'bg-rose-400',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.12)]',
  },
  cyan: {
    bg: 'bg-cyan-500/[0.08]',
    text: 'text-cyan-400',
    border: 'border-cyan-500/[0.15]',
    dot: 'bg-cyan-400',
    glow: 'shadow-[0_0_10px_rgba(6,182,212,0.12)]',
  },
  blue: {
    bg: 'bg-blue-500/[0.08]',
    text: 'text-blue-400',
    border: 'border-blue-500/[0.15]',
    dot: 'bg-blue-400',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.12)]',
  },
  default: {
    bg: 'bg-white/[0.04]',
    text: 'text-zinc-300',
    border: 'border-white/[0.08]',
    dot: 'bg-zinc-400',
    glow: '',
  },
};

const SIZE_MAP: Record<string, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-1',
  sm: 'px-2 py-0.5 text-[11px] gap-1.5',
  md: 'px-3 py-1 text-xs gap-1.5',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
  pulse = false,
  ...props
}: BadgeProps) {
  const conf = VARIANT_MAP[variant] || VARIANT_MAP.default;
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={cn(
        'inline-flex items-center font-semibold rounded-full border select-none',
        'backdrop-blur-sm transition-shadow duration-300',
        conf.bg,
        conf.text,
        conf.border,
        conf.glow,
        sizeCls,
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span className={cn('animate-ping absolute inset-0 rounded-full opacity-60', conf.dot)} />
          )}
          <span className={cn('relative inline-flex w-1.5 h-1.5 rounded-full', conf.dot)} />
        </span>
      )}
      {children}
    </motion.span>
  );
}
