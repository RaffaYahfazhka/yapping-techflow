'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../lib/cn';

export interface ContainerProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  className?: string;
  glass?: boolean;
  elevated?: boolean;
  bordered?: boolean;
  padded?: boolean;
  glow?: 'emerald' | 'violet' | 'cyan' | 'none';
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const GLOW_MAP: Record<string, string> = {
  emerald: 'hover:border-emerald-500/25 hover:shadow-[0_0_30px_rgba(16,185,129,0.06),0_20px_50px_rgba(0,0,0,0.4)]',
  violet: 'hover:border-violet-500/25 hover:shadow-[0_0_30px_rgba(139,92,246,0.06),0_20px_50px_rgba(0,0,0,0.4)]',
  cyan: 'hover:border-cyan-500/25 hover:shadow-[0_0_30px_rgba(6,182,212,0.06),0_20px_50px_rgba(0,0,0,0.4)]',
  none: '',
};

export default function Container({
  children,
  className = '',
  glass = true,
  elevated = false,
  bordered = true,
  padded = true,
  glow = 'none',
  onClick,
  ...props
}: ContainerProps) {
  const glassCls = glass
    ? 'bg-[rgba(14,15,21,0.88)] backdrop-blur-2xl'
    : 'bg-[#0e0f15]';
  const borderCls = bordered
    ? 'border border-white/[0.07] shadow-[0_16px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)]'
    : 'border-0';
  const padCls = padded ? 'p-5' : 'p-0';
  const glowCls = GLOW_MAP[glow] || '';

  const Component = elevated ? motion.div : 'div';

  if (elevated) {
    return (
      <motion.div
        onClick={onClick}
        whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
        className={cn(
          'rounded-2xl overflow-hidden transition-[border,box-shadow] duration-300',
          glassCls,
          borderCls,
          padCls,
          glowCls,
          className
        )}
        {...props}
      >
        {/* Top highlight line */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        {children}
      </motion.div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl overflow-hidden transition-all duration-200',
        glassCls,
        borderCls,
        padCls,
        glowCls,
        className
      )}
      {...(props as unknown as React.HTMLAttributes<HTMLDivElement>)}
    >
      {/* Top highlight line */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {children}
    </div>
  );
}
