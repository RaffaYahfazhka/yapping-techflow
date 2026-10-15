'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Rocket } from 'lucide-react';

export interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

const STAGES = [
  { pct: 15, text: 'Memuat aset 3D isometric penthouse…', agent: 'khansaku' },
  { pct: 40, text: 'Menginisialisasi 9 Karyawan AI & Trading Engine…', agent: 'arga' },
  { pct: 65, text: 'Sinkronisasi Jira Cloud, Git local & DLMM feeds…', agent: 'jajang' },
  { pct: 88, text: 'Menyiapkan YouTube Music Audio Engine…', agent: 'vani' },
  { pct: 100, text: 'Kantor siap beroperasi!', agent: 'reno' },
];

const AGENT_NAMES = [
  'Khansaku (Sec)',
  'Arga (Arch)',
  'Jajang (FE)',
  'Kian (BE)',
  'Vani (QA)',
  'Reno (DevOps)',
  'Altair (DeFi)',
  'Kenzo (Poly)',
  'Damian (Quant)',
];

export default function SplashScreen({
  onFinish,
  minDurationMs = 1800,
}: SplashScreenProps) {
  const [progress, setProgress] = useState(15);
  const [stageIndex, setStageIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / minDurationMs);

      if (ratio < 0.25) {
        setProgress(25);
        setStageIndex(0);
      } else if (ratio < 0.5) {
        setProgress(50);
        setStageIndex(1);
      } else if (ratio < 0.75) {
        setProgress(75);
        setStageIndex(2);
      } else if (ratio < 1) {
        setProgress(92);
        setStageIndex(3);
      } else {
        setProgress(100);
        setStageIndex(4);
        setReady(true);
        clearInterval(interval);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [minDurationMs]);

  // Synchronous: onFinish is invoked in the same click handler, not deferred by a timer.
  const handleEnter = () => {
    if (!ready || fading) return;
    setFading(true);
    onFinish?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading Yapping Techflow"
      className={`fixed inset-0 z-[9999] flex select-none items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#151824_0%,#090a0f_70%,#040508_100%)] font-sans text-zinc-100 transition-[opacity,transform] duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        fading ? 'pointer-events-none scale-[1.04] opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      <div className="flex w-[min(92vw,560px)] flex-col items-center gap-7 sm:gap-8 rounded-[32px] border border-white/15 bg-[#12141d]/85 px-8 sm:px-12 py-10 sm:py-12 text-center shadow-[0_30px_90px_-10px_rgba(0,0,0,0.85),0_0_50px_rgba(16,185,129,0.15)] backdrop-blur-[28px]">
        {/* Brand Icon */}
        <div className="grid h-18 w-18 sm:h-20 sm:w-20 place-items-center rounded-2xl sm:rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-emerald-600/20 text-emerald-300 shadow-[0_12px_28px_rgba(16,185,129,0.3)] animate-[bounce_3s_ease-in-out_infinite]">
          <Zap size={36} aria-hidden="true" className="drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
        </div>

        {/* Title & Description with Generous Spacing */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[11px] sm:text-xs font-bold tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
            Autonomous Mission Control v2.6
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white m-0">
            Yapping Techflow
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-md m-0">
            Workspace autonomous AI engineering terintegrasi Jira Cloud, Git local detection, dan YouTube Music.
          </p>
        </div>

        {/* Progress Bar Container with Dedicated Spacing */}
        <div className="w-full flex flex-col gap-3 py-1">
          <div
            className="relative h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08] shadow-inner"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 shadow-[0_0_16px_rgba(16,185,129,0.7)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
          </div>

          <div className="flex w-full items-center justify-between font-mono text-xs text-zinc-400 font-medium px-1">
            <span className="text-zinc-300">{STAGES[stageIndex]?.text || 'Menyiapkan…'}</span>
            <span className="text-emerald-400 font-bold">{progress}%</span>
          </div>
        </div>

        {/* Agent Badges with Roomy Gaps and Proper Pill Proportions for 9 Employees */}
        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-2.5 w-full max-w-lg py-1">
          {AGENT_NAMES.map((name, i) => (
            <span
              key={name}
              className={`rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-all duration-300 ${
                i <= stageIndex
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-semibold'
                  : 'border-white/10 bg-white/[0.03] text-zinc-500'
              }`}
            >
              {name}
            </span>
          ))}
        </div>

        {/* Primary CTA Button with Roomy Padding & Margin */}
        <div className="w-full pt-2">
          <button
            type="button"
            onClick={handleEnter}
            disabled={!ready}
            className={`flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400 px-6 py-4 text-sm sm:text-base font-extrabold text-[#031d14] shadow-[0_12px_32px_rgba(16,185,129,0.4)] transition-all duration-200 enabled:cursor-pointer enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_16px_40px_rgba(16,185,129,0.55)] enabled:active:translate-y-0 disabled:cursor-wait disabled:opacity-60`}
          >
            {ready ? (
              <>
                <Rocket size={18} aria-hidden="true" />
                Masuk ke Kantor Raffa
              </>
            ) : (
              <>
                <Zap size={18} aria-hidden="true" />
                Memuat Workspace…
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
