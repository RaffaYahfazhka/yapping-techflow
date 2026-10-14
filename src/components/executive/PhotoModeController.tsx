'use client';

/**
 * PhotoModeController — drone camera toolbar overlay.
 * P enters/exits; HUD hidden except this toolbar; Capture/DoF/Exit visible
 * to keyboard, mouse, and touch. Capture is tier-bounded and excludes
 * Spline/YouTube/DOM (visible copy explaining why).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera, Aperture, X, AlertTriangle } from 'lucide-react';

export interface PhotoModeProps {
  active: boolean;
  onEnter: () => void;
  onExit: () => void;
  /** Canvas-provided capture that returns dimensions; null means no canvas available. */
  capture?: () => Promise<{ width: number; height: number }>;
  /** Current depth-of-field value 0..1; null means DoF unavailable. */
  dof?: number | null;
  onDofChange?: (value: number) => void;
  maxTierMegapixels?: number;
  watermark?: string;
}

export type PhotoTier = 'high' | 'medium' | 'low';

const TIER_PX: Record<PhotoTier, number> = { high: 8_300_000, medium: 3_700_000, low: 2_100_000 };

export default function PhotoModeController({
  active,
  onExit,
  capture,
  dof,
  onDofChange,
  maxTierMegapixels = TIER_PX.medium,
  watermark = 'Kantor Raffa — TechFlow Executive Suite',
}: PhotoModeProps) {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const takeCapture = useCallback(async () => {
    if (status === 'capturing') return;
    if (!capture) {
      setStatus('error');
      setMessage('Tidak ada surface 3D untuk ditangkap');
      return;
    }
    setStatus('capturing');
    try {
      const result = await capture();
      setStatus('done');
      setMessage(`Tersimpan · ${result.width}×${result.height}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Gagal menangkap');
    }
  }, [capture, status]);

  useEffect(() => {
    if (active) barRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setMessage(null);
    }
  }, [active]);

  if (!active) return null;

  const dofAvailable = dof !== null && dof !== undefined && onDofChange;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50" role="dialog" aria-label="Photo mode" aria-modal="true">
      <div
        ref={barRef}
        tabIndex={-1}
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl"
        role="toolbar"
        aria-label="Photo mode controls"
      >
        <button
          type="button"
          onClick={takeCapture}
          disabled={status === 'capturing'}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          aria-label="Tangkap foto"
        >
          <Camera size={13} /> {status === 'capturing' ? 'Menangkap…' : 'Capture'}
        </button>

        {dofAvailable ? (
          <label className="flex items-center gap-2 text-[10px] text-slate-400">
            <Aperture size={13} />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((dof ?? 0) * 100)}
              onChange={(e) => onDofChange!(Number(e.target.value) / 100)}
              className="h-1 w-16 accent-violet-400"
              aria-label="Depth of field"
            />
          </label>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Aperture size={11} /> DoF unavailable
          </span>
        )}

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
          aria-label="Keluar photo mode"
        >
          <X size={13} /> Exit
        </button>

        {message && (
          <span className="flex max-w-64 items-center gap-1 truncate text-[10px] text-slate-400" aria-live="polite">
            {status === 'error' && <AlertTriangle size={10} className="text-amber-400" />}
            {message}
          </span>
        )}

        <span className="ml-2 text-[9px] text-slate-600" aria-hidden>
          max {(maxTierMegapixels / 1e6).toFixed(1)} MP · {watermark}
        </span>
      </div>

      <p className="absolute right-4 top-4 rounded-lg border border-white/5 bg-slate-950/70 px-3 py-1.5 text-[9px] text-slate-500" aria-live="polite">
        Capture covers the R3F canvas only. Spline, YouTube, and DOM overlays are excluded.
      </p>
    </div>
  );
}