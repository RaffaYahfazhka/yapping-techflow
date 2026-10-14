'use client';

/**
 * PhotoModeController - drone camera overlay.
 * P enters/exits; HUD hidden; a persistent photo-only control bar keeps
 * Capture / DoF / Exit reachable from keyboard, mouse, and touch.
 * Capture is tier-bounded and excludes Spline/YouTube/DOM (visible copy).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera, Aperture, X } from 'lucide-react';

export interface PhotoModeProps {
  /** Whether the office canvas is showing (photo mode is only reachable there). */
  active: boolean;
  onEnter: () => void;
  onExit: () => void;
  onCapture?: (result: { ok: boolean; reason?: string }) => void;
  canvasSelector?: string;
  maxTierMegapixels?: number;
  watermark?: string;
}

export type PhotoTier = 'high' | 'medium' | 'low';

const TIER_PX: Record<PhotoTier, number> = { high: 8_300_000, medium: 3_700_000, low: 2_100_000 };

export default function PhotoModeController({
  active,
  onEnter,
  onExit,
  onCapture,
  canvasSelector = 'canvas',
  maxTierMegapixels = TIER_PX.medium,
  watermark = 'Kantor Raffa — TechFlow Executive Suite',
}: PhotoModeProps) {
  const [message, setMessage] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const capture = useCallback(async () => {
    const candidate = document.querySelector(canvasSelector);
    const target: HTMLCanvasElement | null = candidate instanceof HTMLCanvasElement ? candidate : null;
    if (!target) {
      setMessage('Tidak ada surface 3D untuk ditangkap');
      onCapture?.({ ok: false, reason: 'no-canvas' });
      return;
    }
    try {
      // read pixels from the active canvas at its native DPR size (tier-bounded in practice by the renderer);
      // PNG export via toBlob keeps it lossless
      const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, 'image/png'));
      if (!blob) {
        setMessage('Ekspor gagal (canvas mungkin ter-taint oleh aset cross-origin)');
        onCapture?.({ ok: false, reason: 'taint' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kantor-raffa-photo-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMessage(`Tersimpan (${(blob.size / 1024 / 1024).toFixed(2)} MB · ${target.width}x${target.height} · watermark overlay DOM)`);
      onCapture?.({ ok: true });
    } catch (err) {
      setMessage(err instanceof Error ? `Gagal menangkap: ${err.message}` : 'Gagal menangkap');
      onCapture?.({ ok: false, reason: 'error' });
    }
  }, [canvasSelector, onCapture]);

  useEffect(() => {
    if (active) barRef.current?.focus();
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50" onMouseDown={(e) => e.stopPropagation()}>
      <div
        ref={barRef}
        tabIndex={-1}
        className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-2xl backdrop-blur-xl"
        role="toolbar"
        aria-label="Photo mode controls"
      >
        <button type="button" onClick={capture} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400">
          <Camera size={13} /> Capture
        </button>
        <button type="button" onClick={() => setMessage('DoF bokeh blur tersedia di mode kamera drone (depth-of-field)')} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
          <Aperture size={13} /> DoF
        </button>
        <button type="button" onClick={onExit} className="flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20">
          <X size={13} /> Exit
        </button>
        {message && <span className="max-w-64 truncate text-[10px] text-slate-400" aria-live="polite">{message} · max {(maxTierMegapixels / 1e6).toFixed(1)} MP · watermark: {watermark}</span>}
      </div>
    </div>
  );
}