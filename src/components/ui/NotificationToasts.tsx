'use client';

/**
 * SCBD Executive Push Notification Toasts — PRD §17.2
 * Glassmorphic floating toast notifications with neon border accents,
 * auto-dismiss, and smooth slide-in/slide-out animations.
 * Uses Lucide icons and Tailwind only; no Emotion CSS.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, Zap, Shield, Coffee, Bell, X, CheckCircle2 } from 'lucide-react';

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

const TOAST_COLORS: Record<ToastKind, { border: string; icon: string; glow: string }> = {
  profit: { border: 'border-emerald-400/50', icon: 'text-emerald-400', glow: 'shadow-[0_0_24px_rgba(52,211,153,0.15)]' },
  harvest: { border: 'border-violet-400/50', icon: 'text-violet-400', glow: 'shadow-[0_0_24px_rgba(167,139,250,0.15)]' },
  qa: { border: 'border-cyan-400/50', icon: 'text-cyan-400', glow: 'shadow-[0_0_24px_rgba(34,211,238,0.15)]' },
  coffee: { border: 'border-amber-400/50', icon: 'text-amber-400', glow: 'shadow-[0_0_24px_rgba(251,191,36,0.15)]' },
  system: { border: 'border-white/20', icon: 'text-zinc-300', glow: 'shadow-[0_0_16px_rgba(255,255,255,0.06)]' },
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
      {visible.map((toast, idx) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} index={idx} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss, index }: { toast: ToastItem; onDismiss: (id: string) => void; index: number }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = toast.duration ?? DEFAULT_DURATION;
  const colors = TOAST_COLORS[toast.kind];
  const Icon = TOAST_ICONS[toast.kind];
  const emoji = TOAST_EMOJIS[toast.kind];

  const startDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (duration <= 0) return;
    timerRef.current = setTimeout(startDismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, startDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[#0c0d12]/95 backdrop-blur-2xl px-4 py-3.5 transition-all duration-300 ${colors.border} ${colors.glow} ${
        exiting ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100 animate-[slideInRight_0.35s_ease-out]'
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${colors.border} bg-white/5 ${colors.icon}`}>
        <Icon size={15} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[10px]">{emoji}</span>
          <span className="text-[11px] font-bold text-white">{toast.title}</span>
          <span className="ml-auto text-[9px] font-mono text-zinc-600">
            {new Date(toast.timestamp).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">{toast.message}</p>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={startDismiss}
        className="mt-0.5 shrink-0 rounded-lg p-1 text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X size={12} />
      </button>
    </div>
  );
}
