'use client';

/**
 * SCBD Executive Push Notification Toasts — PRD §17.2
 * Glassmorphic floating toast notifications with neon border accents,
 * auto-dismiss, and smooth slide-in/slide-out animations.
 * Uses Lucide icons and Tailwind only; no Emotion CSS.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Zap, Shield, Coffee, Bell, X } from 'lucide-react';
import { cn } from './lib/cn';

export type ToastKind = 'profit' | 'harvest' | 'qa' | 'coffee' | 'system';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
  timestamp: number;
  /** Auto-dismiss delay in ms (default 5000). 0 = sticky. */
  duration?: number;
}

const TOAST_ICONS: Record<ToastKind, typeof TrendingUp> = {
  profit: TrendingUp,
  harvest: Zap,
  qa: Shield,
  coffee: Coffee,
  system: Bell,
};

const TOAST_COLORS: Record<ToastKind, {
  border: string;
  icon: string;
  glow: string;
  iconBg: string;
  accent: string;
}> = {
  profit: {
    border: 'border-emerald-400/25',
    icon: 'text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.1)]',
    iconBg: 'bg-emerald-500/[0.08]',
    accent: 'from-emerald-500/20',
  },
  harvest: {
    border: 'border-violet-400/25',
    icon: 'text-violet-400',
    glow: 'shadow-[0_0_20px_rgba(167,139,250,0.1)]',
    iconBg: 'bg-violet-500/[0.08]',
    accent: 'from-violet-500/20',
  },
  qa: {
    border: 'border-cyan-400/25',
    icon: 'text-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.1)]',
    iconBg: 'bg-cyan-500/[0.08]',
    accent: 'from-cyan-500/20',
  },
  coffee: {
    border: 'border-amber-400/25',
    icon: 'text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.1)]',
    iconBg: 'bg-amber-500/[0.08]',
    accent: 'from-amber-500/20',
  },
  system: {
    border: 'border-white/[0.1]',
    icon: 'text-zinc-300',
    glow: 'shadow-[0_0_16px_rgba(255,255,255,0.03)]',
    iconBg: 'bg-white/[0.04]',
    accent: 'from-white/[0.04]',
  },
};

const TOAST_EMOJIS: Record<ToastKind, string> = {
  profit: '📈',
  harvest: '⚡',
  qa: '🛡️',
  coffee: '☕',
  system: '🔔',
};

const DEFAULT_DURATION = 6000;
const MAX_VISIBLE = 4;

export interface NotificationToastsHandle {
  push: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

export function useNotificationToasts(): { toasts: ToastItem[]; push: NotificationToastsHandle['push']; dismiss: (id: string) => void; clear: () => void } {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seqRef = useRef(0);

  const push = useCallback((t: Omit<ToastItem, 'id' | 'timestamp'>) => {
    seqRef.current += 1;
    const toast: ToastItem = { ...t, id: `toast-${seqRef.current}-${Date.now()}`, timestamp: Date.now() };
    setToasts((prev) => [...prev, toast].slice(-MAX_VISIBLE * 2)); // keep buffer small
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  return { toasts, push, dismiss, clear };
}

export default function NotificationToasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const visible = toasts.slice(-MAX_VISIBLE);

  return (
    <div
      className="pointer-events-none fixed right-5 top-24 z-[70] flex w-[380px] max-w-[calc(100vw-40px)] flex-col gap-2.5"
      aria-live="polite"
      aria-label="Notifikasi eksekutif"
    >
      <AnimatePresence mode="popLayout">
        {visible.map((toast, idx) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} index={idx} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss, index }: { toast: ToastItem; onDismiss: (id: string) => void; index: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = toast.duration ?? DEFAULT_DURATION;
  const colors = TOAST_COLORS[toast.kind];
  const Icon = TOAST_ICONS[toast.kind];
  const emoji = TOAST_EMOJIS[toast.kind];

  const startDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (duration <= 0) return;
    timerRef.current = setTimeout(startDismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, startDismiss]);

  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
      animate={{ x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ x: 140, opacity: 0, scale: 0.92, filter: 'blur(4px)' }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 28,
        delay: index * 0.04,
      }}
      role="status"
      className={cn(
        'pointer-events-auto relative flex items-start gap-3 overflow-hidden',
        'rounded-[16px] border',
        'bg-[#0c0d12]/[0.96] backdrop-blur-2xl',
        'px-4 py-3.5',
        colors.border,
        colors.glow
      )}
    >
      {/* Left accent gradient bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b', colors.accent, 'to-transparent')} />

      {/* Icon */}
      <div className={cn(
        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center',
        'rounded-[10px] border',
        colors.border,
        colors.iconBg,
        colors.icon
      )}>
        <Icon size={14} strokeWidth={2.5} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[10px]">{emoji}</span>
          <span className="text-[11px] font-bold text-white">{toast.title}</span>
          <span className="ml-auto text-[9px] font-mono text-zinc-600 tabular-nums">
            {new Date(toast.timestamp).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">{toast.message}</p>

        {/* Auto-dismiss progress bar */}
        {duration > 0 && (
          <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
              className={cn('h-full rounded-full', colors.icon.replace('text-', 'bg-'), 'opacity-40')}
            />
          </div>
        )}
      </div>

      {/* Dismiss */}
      <motion.button
        type="button"
        onClick={startDismiss}
        whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.08)' }}
        whileTap={{ scale: 0.9 }}
        className="mt-0.5 shrink-0 rounded-lg p-1.5 text-zinc-600 transition-colors outline-none"
        aria-label="Tutup notifikasi"
      >
        <X size={11} strokeWidth={3} />
      </motion.button>
    </motion.div>
  );
}
