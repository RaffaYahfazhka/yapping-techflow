'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border border-emerald-400/40 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0',
  violet:
    'bg-gradient-to-r from-violet-500 to-violet-600 text-white border border-violet-400/40 shadow-[0_4px_14px_rgba(139,92,246,0.3)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0',
  danger:
    'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 active:bg-rose-500/30',
  accent:
    'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 active:bg-cyan-500/30',
  ghost:
    'bg-transparent text-zinc-400 border border-transparent hover:bg-white/10 hover:text-white',
  outline:
    'bg-white/[0.03] text-zinc-200 border border-white/15 hover:bg-white/10 hover:border-white/25 hover:text-white',
  primary:
    'bg-white/10 text-zinc-100 border border-white/15 hover:bg-white/15 hover:text-white active:bg-white/20',
};

const SIZE_MAP: Record<string, string> = {
  xs: 'text-[11px] px-2.5 py-1 rounded-lg gap-1.5',
  sm: 'text-xs px-3 py-1.5 rounded-xl gap-1.5',
  md: 'text-xs px-4 py-2 rounded-xl gap-2',
  lg: 'text-sm px-5 py-3 rounded-2xl gap-2.5 font-bold',
  icon: 'w-9 h-9 p-0 rounded-xl justify-center',
  'icon-sm': 'w-7 h-7 p-0 rounded-lg justify-center text-xs',
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

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center font-semibold select-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.98] outline-none ${variantCls} ${sizeCls} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0 mr-1" />
      ) : icon ? (
        <span className="inline-flex shrink-0">{icon}</span>
      ) : null}

      {children && <span>{children}</span>}

      {kbd && (
        <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/40 border border-white/15 text-zinc-400">
          {kbd}
        </kbd>
      )}
    </button>
  );
}
