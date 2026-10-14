'use client';

import React, { useEffect, useState } from 'react';
import { Zap, Rocket } from 'lucide-react';

export interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

const STAGES = [
  { pct: 20, text: 'Memuat aset 3D isometric kantor…', agent: 'tara' },
  { pct: 45, text: 'Menginisialisasi 6 Karyawan AI…', agent: 'arga' },
  { pct: 70, text: 'Sinkronisasi Jira Cloud & Git local…', agent: 'jajang' },
  { pct: 90, text: 'Menyiapkan YouTube Music Audio Engine…', agent: 'vani' },
  { pct: 100, text: 'Kantor siap beroperasi!', agent: 'reno' },
];

const AGENT_NAMES = ['Tara (PM)', 'Arga (Arch)', 'Jajang (FE)', 'Kian (BE)', 'Vani (QA)', 'Reno (DevOps)'];

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
      aria-label="Loading Kantor Raffa"
      className={`fixed inset-0 z-[9999] flex select-none items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#151824_0%,#090a0f_70%,#040508_100%)] font-sans text-zinc-100 transition-[opacity,transform] duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        fading ? 'pointer-events-none scale-[1.04] opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      <div className="flex w-[min(92vw,480px)] flex-col items-center gap-5 rounded-[28px] border border-white/12 bg-[#12141d]/75 px-8 py-9 text-center shadow-[0_30px_80px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-[24px]">
        <div className="grid h-[68px] w-[68px] animate-[bounce_3s_ease-in-out_infinite] place-items-center rounded-[20px] border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 text-emerald-300 shadow-[0_10px_24px_rgba(16,185,129,0.25)]">
          <Zap size={32} aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-extrabold uppercase tracking-[0.1em] text-emerald-400">
            Autonomous Mission Control v2.6
          </span>
          <h2 className="m-0 text-[22px] font-extrabold leading-[1.3] tracking-[-0.02em] text-white">Kantor Raffa Virtual 3D</h2>
          <p className="m-0 text-[12.5px] leading-normal text-slate-400">
            Workspace autonomous AI engineering terintegrasi Jira Cloud, Git local detection, dan YouTube Music.
          </p>
        </div>

        <div
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.6)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        </div>

        <div className="flex w-full items-center justify-between font-mono text-[11px] text-slate-400">
          <span>{STAGES[stageIndex]?.text || 'Menyiapkan…'}</span>
          <span>{progress}%</span>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {AGENT_NAMES.map((name, i) => (
            <span
              key={name}
              className={`rounded-md border px-2 py-[3px] text-[10.5px] transition-all duration-200 ${
                i <= stageIndex
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/[0.07] bg-white/[0.04] text-zinc-500'
              }`}
            >
              {name}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={handleEnter}
          disabled={!ready}
          className={`flex w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-emerald-400 to-emerald-500 px-5 py-[13px] text-sm font-extrabold text-[#04241a] shadow-[0_10px_28px_rgba(16,185,129,0.45)] transition-all duration-200 enabled:cursor-pointer enabled:hover:-translate-y-px enabled:hover:from-emerald-300 enabled:hover:to-emerald-400 enabled:hover:shadow-[0_14px_34px_rgba(16,185,129,0.6)] enabled:active:translate-y-0 disabled:cursor-wait disabled:opacity-60`}
        >
          {ready ? (
            <>
              <Rocket size={16} aria-hidden="true" />
              Masuk ke Kantor Raffa
            </>
          ) : (
            <>
              <Zap size={16} aria-hidden="true" />
              Memuat Workspace…
            </>
          )}
        </button>
      </div>
    </div>
  );
}
