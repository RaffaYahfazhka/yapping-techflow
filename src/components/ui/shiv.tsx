'use client';

/**
 * Cult-UI-compatible shiv primitives: Button, Modal, Badge, SelectField.
 * Same prop shapes as the existing Emotion versions so callers can swap imports.
 * Tailwind utilities only; no Emotion.
 */

import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './lib/cn';

// ─── Button ─────────────────────────────────────────────────────────────────

export interface ShivButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const VARIANT_CLASSES = {
  primary: 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.15)] hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] focus-visible:ring-emerald-400',
  secondary: 'border border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:border-white/[0.12] focus-visible:ring-white/30',
  ghost: 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 focus-visible:ring-white/20',
  danger: 'bg-rose-500 text-white hover:bg-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.15)] hover:shadow-[0_0_24px_rgba(244,63,94,0.25)] focus-visible:ring-rose-400',
} as const;

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-xs font-bold',
  lg: 'px-6 py-2.5 text-sm font-bold',
} as const;

export function ShivButton({ variant = 'primary', size = 'md', className, children, ...rest }: ShivButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2',
        'disabled:opacity-40 disabled:pointer-events-none',
        'active:scale-[0.97]',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] font-semibold uppercase tracking-wide',
        'backdrop-blur-sm transition-shadow duration-300',
        glow && 'shadow-lg',
        className,
      )}
      style={{
        borderColor: `${color}30`,
        background: `${color}0f`,
        color,
        boxShadow: glow ? `0 0 16px ${color}20` : undefined,
      }}
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center p-4 md:p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-xl" />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.92, y: 20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: 12, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full max-h-[90vh] flex flex-col overflow-hidden',
              'rounded-[20px] md:rounded-[24px]',
              'border border-white/[0.08]',
              'bg-[#0d0e14]/[0.97] backdrop-blur-2xl',
              'shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)]',
              'focus:outline-none',
              SIZE_W[size],
              className,
            )}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />

            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4 bg-white/[0.015] shrink-0">
              <div>
                <h2 className="text-[15px] font-bold text-white tracking-[-0.01em]">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>}
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.06)' }}
                whileTap={{ scale: 0.92 }}
                className="rounded-xl p-2 text-zinc-500 hover:text-zinc-300 transition-colors outline-none"
                aria-label="Tutup"
              >
                <X size={16} strokeWidth={2.5} />
              </motion.button>
            </div>
            <div className={cn('flex-1 overflow-y-auto min-h-0', !noPadding && 'p-6')}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm',
          'px-3.5 py-2.5 text-xs text-slate-200',
          'transition-all duration-200',
          'focus:border-emerald-400/40 focus:shadow-[0_0_12px_rgba(16,185,129,0.06)] focus:outline-none',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
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