'use client';

/**
 * Cult-UI-compatible shiv primitives: Button, Modal, Badge, SelectField.
 * Same prop shapes as the existing Emotion versions so callers can swap imports.
 * Tailwind utilities only; no Emotion.
 */

import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from './lib/cn';

// ─── Button ─────────────────────────────────────────────────────────────────

export interface ShivButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const VARIANT_CLASSES = {
  primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 focus-visible:ring-emerald-400',
  secondary: 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus-visible:ring-white/30',
  ghost: 'text-slate-300 hover:bg-white/5 focus-visible:ring-white/20',
  danger: 'bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-400',
} as const;

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-xs font-bold',
  lg: 'px-5.5 py-2.5 text-sm font-bold',
} as const;

export function ShivButton({ variant = 'primary', size = 'md', className, children, ...rest }: ShivButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition focus:outline-none focus-visible:ring-2 disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────

export interface ShivBadgeProps {
  color?: string;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function ShivBadge({ color = '#10b981', children, className, glow }: ShivBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        glow && 'shadow-lg',
        className,
      )}
      style={{ borderColor: `${color}55`, background: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export interface ShivModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  noPadding?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZE_W = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[96vw]',
} as const;

export function ShivModal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  noPadding = false,
  className,
  children,
}: ShivModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // put focus into the panel so screen readers land inside the dialog
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 md:p-6 backdrop-blur-md">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-[#0d0e14]/95 shadow-2xl backdrop-blur-xl focus:outline-none overflow-hidden',
          SIZE_W[size],
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5 bg-white/[0.02] shrink-0">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-zinc-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        <div className={cn('flex-1 overflow-y-auto min-h-0', !noPadding && 'p-6')}>{children}</div>
      </div>
    </div>
  );
}

// ─── SelectField ────────────────────────────────────────────────────────────

export interface ShivSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

export function ShivSelect({ label, value, onChange, options, disabled, className }: ShivSelectProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 focus:border-emerald-400/60 focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}