'use client';

import React, { useRef, useCallback } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../lib/cn';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'emerald' | 'violet' | 'ghost' | 'outline' | 'danger' | 'accent' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  kbd?: string | null;
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const VARIANT_MAP: Record<string, string> = {
  emerald:
    'bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 text-white border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.2),0_4px_16px_rgba(16,185,129,0.15)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35),0_6px_24px_rgba(16,185,129,0.2)]',
  violet:
    'bg-gradient-to-r from-violet-500/90 to-violet-600/90 text-white border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.2),0_4px_16px_rgba(139,92,246,0.15)] hover:shadow-[0_0_28px_rgba(139,92,246,0.35),0_6px_24px_rgba(139,92,246,0.2)]',
  danger:
    'bg-rose-500/10 text-rose-300 border border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.08)] hover:bg-rose-500/20 hover:border-rose-400/30 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  accent:
    'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.08)] hover:bg-cyan-500/20 hover:border-cyan-400/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
  ghost:
    'bg-transparent text-zinc-400 border border-transparent hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.06]',
  outline:
    'bg-white/[0.02] text-zinc-200 border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.15] hover:text-white',
  primary:
    'bg-white/[0.06] text-zinc-100 border border-white/[0.1] backdrop-blur-sm hover:bg-white/[0.1] hover:border-white/[0.18] hover:text-white',
};

const SIZE_MAP: Record<string, string> = {
  xs: 'text-[11px] px-2.5 py-1 rounded-[10px] gap-1.5',
  sm: 'text-xs px-3 py-1.5 rounded-xl gap-1.5',
  md: 'text-xs px-4 py-2 rounded-xl gap-2',
  lg: 'text-sm px-5 py-3 rounded-2xl gap-2.5 font-bold',
  icon: 'w-9 h-9 p-0 rounded-xl justify-center',
  'icon-sm': 'w-7 h-7 p-0 rounded-[10px] justify-center text-xs',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  kbd = null,
  icon = null,
  type = 'button',
  onClick,
  ...props
}: ButtonProps) {
  const isIcon = variant === 'icon';
  const resolvedVariant = isIcon ? 'ghost' : variant;
  const resolvedSize = isIcon ? (size === 'sm' ? 'icon-sm' : 'icon') : size;

  const variantCls = VARIANT_MAP[resolvedVariant] || VARIANT_MAP.primary;
  const sizeCls = SIZE_MAP[resolvedSize] || SIZE_MAP.md;

  const rippleRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Ripple effect
      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const ripple = rippleRef.current;
      if (ripple) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x - size / 2}px`;
        ripple.style.top = `${y - size / 2}px`;
        ripple.classList.remove('animate-[ripple_0.5s_ease-out]');
        // Force reflow
        void ripple.offsetWidth;
        ripple.classList.add('animate-[ripple_0.5s_ease-out]');
      }
      onClick?.(e);
    },
    [onClick]
  );

  const isGlowing = resolvedVariant === 'emerald' || resolvedVariant === 'violet';

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'relative inline-flex items-center justify-center font-semibold select-none cursor-pointer',
        'outline-none overflow-hidden',
        'transition-[background,border,box-shadow,color] duration-200 ease-out',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantCls,
        sizeCls,
        className
      )}
      {...props}
    >
      {/* Shimmer overlay for glowing variants */}
      {isGlowing && (
        <span className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.12)_45%,rgba(255,255,255,0.05)_50%,transparent_55%)] bg-[length:250%_100%] animate-[shimmer_2.5s_ease-in-out_infinite]" />
      )}

      {/* Ripple element */}
      <span
        ref={rippleRef}
        className="pointer-events-none absolute rounded-full bg-white/20 opacity-0 animate-none"
        style={{ transform: 'scale(0)' }}
      />

      {loading ? (
        <span className="relative z-10 flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-20"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {children && <span>{children}</span>}
        </span>
      ) : (
        <>
          {icon && <span className="relative z-10 inline-flex shrink-0">{icon}</span>}
          {children && <span className="relative z-10">{children}</span>}
        </>
      )}

      {kbd && (
        <kbd className="relative z-10 ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-md bg-black/50 border border-white/10 text-zinc-500 shrink-0">
          {kbd}
        </kbd>
      )}
    </motion.button>
  );
}
