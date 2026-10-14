'use client';

/**
 * BacktestSimulator - panel di layar laptop Damian (XAUUSD).
 * Timeframe + period controls, run, honest result table with the 100% fixture label.
 * Pure Tailwind + Lucide. No Emotion, no authored CSS.
 */

import { useMemo, useState, useCallback } from 'react';
import { Play, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  aggregateBars,
  runBacktest,
  generateXauUsdM5,
  type Bars,
  type Period,
  type BacktestResult,
} from '@/lib/engine/backtest';

const TIMEFRAMES: { id: Bars; label: string }[] = [
  { id: 'M5', label: 'M5' },
  { id: 'M15', label: 'M15' },
  { id: 'H1', label: 'H1' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: '1M', label: '1 Bulan' },
  { id: '6M', label: '6 Bulan' },
  { id: '1Y', label: '1 Tahun' },
];

export default function BacktestSimulator() {
  const [tf, setTf] = useState<Bars>('M5');
  const [period, setPeriod] = useState<Period>('1M');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);

  const base = useMemo(() => generateXauUsdM5(20261014, 2026), []);
  const tfBars = useMemo(() => aggregateBars(base, tf), [base, tf]);

  const run = useCallback(() => {
    setRunning(true);
    // Pure calculation, no worker: bounded 1Y M5 window fits the interactive budget
    setTimeout(() => {
      try {
        const r = runBacktest(tfBars, { period, seed: 20261014, target: 3, stop: 5 });
        setResult(r);
      } finally {
        setRunning(false);
      }
    }, 20);
  }, [tfBars, period]);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  const pct = result ? (result.winRate * 100).toFixed(2) : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4" aria-label="Backtest Simulator">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <ShieldCheck size={14} className="text-amber-400" /> Interactive Backtest — XAUUSD (Synthetic Paper)
        </h3>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">Demo fixture, bukan jaminan</span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Timeframe</label>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTf(t.id)}
                aria-pressed={tf === t.id}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                  tf === t.id ? 'bg-amber-400 text-amber-950' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Periode</label>
          <div className="flex gap-1 rounded-xl border border-white/10 bg-slate-950/70 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                  period === p.id ? 'bg-amber-400 text-amber-950' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-300 disabled:opacity-50"
        >
          <Play size={13} /> {running ? 'Menjalankan…' : 'Jalankan Backtest'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          <RotateCcw size={13} /> Reset Hasil
        </button>
      </div>

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatBox label="Total Trades" value={String(result.trades)} />
            <StatBox label="Winning" value={String(result.wins)} accent="text-emerald-400" />
            <StatBox label="Losing" value={String(result.losses)} accent="text-rose-400" />
            <StatBox label="Win Rate" value={`${pct}%`} accent="text-amber-300" />
            <StatBox label="Net P&L" value={`$${result.netPnl.toFixed(2)}`} accent={result.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <StatBox label="Max Drawdown" value={`${result.maxDrawdownPct.toFixed(2)}%`} />
            <StatBox label="Open Baskets" value={String(result.openBaskets)} />
            <StatBox label="Unrealized P&L" value={`$${result.unrealizedPnl.toFixed(2)}`} accent={result.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          </div>

          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
            <p className="text-[10px] leading-relaxed text-emerald-300/90">
              <AlertTriangle size={10} className="mr-1 inline" />
              {result.disclaimer}
            </p>
            <p className="mt-1 text-[9px] text-slate-500">
              Generator: {result.generator} · seed={result.seed} · {result.bars} bar ({tf}) · periode {period} · range {new Date(result.rangeStartMs).toISOString().slice(0, 10)} → {new Date(result.rangeEndMs).toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function StatBox({ label, value, accent = 'text-slate-200' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent}`}>{value}</div>
    </div>
  );
}