'use client';

/**
 * Client boundary: loads OfficeCanvas via next/dynamic with ssr:false.
 * Server Components cannot declare ssr:false in Next.js 16 — this wrapper is the client gate.
 * WebGL-unsupported browsers are detected before mount and get an accessible DOM fallback.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const OfficeCanvas = dynamic(() => import('@/components/canvas/OfficeCanvas'), {
  ssr: false,
  loading: () => <OfficeSkeleton />,
});

export type OfficeEquity = number;

/** Mutable handle the canvas fills with its R3F capture function. */
export type OfficeCaptureHandle = { current: (() => Promise<{ width: number; height: number }>) | null };

function OfficeSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950 text-slate-400 font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
        <div className="text-xs font-medium tracking-wide">Menyiapkan penthouse…</div>
      </div>
    </div>
  );
}

function detectWebgl(): { ok: boolean; reason: string } {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { ok: false, reason: 'no-window' };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { ok: false, reason: 'no-webgl' };
    return { ok: true, reason: '' };
  } catch {
    return { ok: false, reason: 'throw' };
  }
}

export default function OfficeClientBoundary({ equityPct, captureRef }: { equityPct: OfficeEquity; captureRef?: OfficeCaptureHandle }) {
  const [webgl, setWebgl] = useState<{ ok: boolean; reason: string } | null>(null);

  useEffect(() => {
    setWebgl(detectWebgl());
  }, []);

  if (webgl === null) {
    return <OfficeSkeleton />;
  }

  if (!webgl.ok) {
    return (
      <div className="absolute inset-0 overflow-auto bg-slate-950 p-6 font-sans text-slate-200" role="main" aria-label="Kantor mode 2D">
        <h1 className="mb-4 text-lg font-bold text-emerald-400">Kantor Raffa — Mode Ringan (2D)</h1>
        <p className="mb-4 max-w-prose text-xs text-slate-400">
          WebGL tidak tersedia di browser ini. Fitur kantor tetap bisa dipakai lewat panel di bawah.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-left text-xs hover:bg-emerald-500/20" aria-label="Buka Market Feed">
            <strong className="mb-1 block text-emerald-300">📡 Market Feed</strong>
            <span className="text-slate-400">Meteora, Polymarket, Exness (paper)</span>
          </button>
          <button type="button" className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-left text-xs hover:bg-violet-500/20" aria-label="Buka Chat Khansaku">
            <strong className="mb-1 block text-violet-300">💖 Chat Khansaku</strong>
            <span className="text-slate-400">Delegasi perintah kantor</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="pointer-events-auto absolute inset-0">
        <OfficeCanvas equityPct={equityPct} captureRef={captureRef} />
      </div>
    </div>
  );
}