'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    <AnimatePresence>
      {!fading && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Loading Yapping Techflow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] flex select-none items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#151824_0%,#090a0f_70%,#040508_100%)] font-sans text-zinc-100"
        >
          {/* Ambient background orbs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[150px] animate-pulse" />
            <div className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[130px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.1 }}
            className="relative flex w-[min(92vw,560px)] flex-col items-center gap-7 sm:gap-8 rounded-[28px] border border-white/[0.08] bg-[#12141d]/[0.88] px-8 sm:px-12 py-10 sm:py-12 text-center shadow-[0_32px_100px_-15px_rgba(0,0,0,0.9),0_0_60px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[32px]"
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

            {/* Brand Icon */}
            <motion.div
              animate={{
                y: [0, -8, 0],
                rotate: [0, 3, -3, 0],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="grid h-18 w-18 sm:h-20 sm:w-20 place-items-center rounded-2xl sm:rounded-[20px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-emerald-500/[0.06] to-emerald-600/10 text-emerald-300 shadow-[0_12px_36px_rgba(16,185,129,0.2),0_0_20px_rgba(16,185,129,0.1)]"
            >
              <Zap size={36} aria-hidden="true" className="drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
            </motion.div>

            {/* Title & Description */}
            <div className="flex flex-col items-center gap-3 w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
                className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/[0.06] border border-emerald-500/15 text-emerald-400 font-mono text-[11px] sm:text-xs font-bold tracking-wider uppercase"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
                Autonomous Mission Control v2.6
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.02em] text-white m-0">
                Yapping Techflow
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-md m-0">
                Workspace autonomous AI engineering terintegrasi Jira Cloud, Git local detection, dan YouTube Music.
              </p>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full flex flex-col gap-3 py-1">
              <div
                className="relative h-[6px] sm:h-2 w-full overflow-hidden rounded-full bg-white/[0.04] shadow-inner"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <motion.div
                  className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300"
                  initial={{ width: '15%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]" />
                  {/* Glow at tip */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-400/40 blur-md" />
                </motion.div>
              </div>

              <div className="flex w-full items-center justify-between font-mono text-xs text-zinc-500 font-medium px-1">
                <span className="text-zinc-400 transition-all duration-200">{STAGES[stageIndex]?.text || 'Menyiapkan…'}</span>
                <span className="text-emerald-400 font-bold tabular-nums">{progress}%</span>
              </div>
            </div>

            {/* Agent Badges */}
            <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-2.5 w-full max-w-lg py-1">
              {AGENT_NAMES.map((name, i) => (
                <motion.span
                  key={name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: i <= stageIndex ? 1 : 0.4,
                    scale: 1,
                  }}
                  transition={{
                    delay: 0.3 + i * 0.05,
                    type: 'spring',
                    stiffness: 300,
                    damping: 22,
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-all duration-300 ${
                    i <= stageIndex
                      ? 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.08)] font-semibold'
                      : 'border-white/[0.06] bg-white/[0.02] text-zinc-600'
                  }`}
                >
                  {name}
                </motion.span>
              ))}
            </div>

            {/* Primary CTA Button */}
            <div className="w-full pt-2">
              <motion.button
                type="button"
                onClick={handleEnter}
                disabled={!ready}
                whileHover={ready ? { y: -2, boxShadow: '0 16px 48px rgba(16,185,129,0.45)' } : undefined}
                whileTap={ready ? { scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400 px-6 py-4 text-sm sm:text-base font-extrabold text-[#031d14] shadow-[0_12px_36px_rgba(16,185,129,0.3)] transition-all duration-200 enabled:cursor-pointer disabled:cursor-wait disabled:opacity-50"
              >
                {ready ? (
                  <>
                    <Rocket size={18} aria-hidden="true" />
                    Masuk ke Kantor Raffa
                  </>
                ) : (
                  <>
                    <Zap size={18} aria-hidden="true" className="animate-pulse" />
                    Memuat Workspace…
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
