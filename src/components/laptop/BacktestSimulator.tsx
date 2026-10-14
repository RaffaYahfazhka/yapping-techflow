'use client';

/**
 * BacktestSimulator - engine-backed reporting for the synthetic XAUUSD fixture.
 * Every number and the equity line come from runBacktest(); nothing is invented here.
 */

import { useMemo, useState, useCallback } from 'react';
import { Play, RotateCcw, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import {
  aggregateBars,
  runBacktest,
  generateXauUsdM5,
  type Bars,
  type Period,
  type BacktestResult,
} from '@/lib/engine/backtest';

const SEED = 20261014;
const INITIAL_EQUITY = 10_000;

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

  const base = useMemo(() => generateXauUsdM5(SEED, 2026), []);
  const tfBars = useMemo(() => aggregateBars(base, tf), [base, tf]);

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      try {
        setResult(
          runBacktest(tfBars, {
            period,
            seed: SEED,
            target: 3,
            stop: 5,
            timeframe: tf,
            initialEquity: INITIAL_EQUITY,
          }),
        );
      } finally {
        setRunning(false);
      }
    }, 20);
  }, [tfBars, period, tf]);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  const hasErrors = !!result && result.errors.length > 0;

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
          <span className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Timeframe</span>
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
          <span className="mb-1.5 block text-[10px] uppercase tracking-wide text-slate-500">Periode</span>
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

      {!result && !running && (
        <p className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-400" role="status">
          Pilih timeframe dan periode, lalu jalankan backtest untuk melihat hasil simulasi. Tidak ada performa contoh yang ditampilkan.
        </p>
      )}

      {running && <p className="text-xs text-amber-300" role="status">Menghitung hasil dari data sintetis…</p>}

      {result && hasErrors && (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3" role="alert">
          <p className="flex items-center gap-2 text-xs font-bold text-rose-300">
            <XCircle size={13} /> Backtest tidak valid — hasil disembunyikan
          </p>
          <ul className="list-disc pl-5 text-[11px] text-rose-200">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {result && !hasErrors && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200" role="status">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" /> <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          {result.trades === 0 && (
            <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">
              Tidak ada transaksi tertutup pada rentang ini. Win rate tidak bermakna tanpa transaksi.
            </p>
          )}

          <EquityChart points={result.equityCurve} initialEquity={result.costModel.initialEquity} />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatBox label="Samples" value={String(result.sampleCount)} />
            <StatBox label="Closed Trades" value={String(result.trades)} />
            <StatBox label="Winning Trades" value={String(result.wins)} accent="text-emerald-400" />
            <StatBox label="Losing Trades" value={String(result.losses)} accent="text-rose-400" />
            <StatBox label="Closed-trade Win Rate" value={result.trades ? `${(result.winRate * 100).toFixed(2)}%` : '—'} accent="text-amber-300" />
            <StatBox label="Realized P&L" value={money(result.realizedPnl)} accent={pnlColor(result.realizedPnl)} />
            <StatBox label="Unrealized P&L" value={money(result.unrealizedPnl)} accent={pnlColor(result.unrealizedPnl)} />
            <StatBox label="Costs" value={money(-result.costs)} accent="text-rose-300" />
            <StatBox label="Final Equity" value={money(result.finalEquity, false)} accent={pnlColor(result.finalEquity - result.costModel.initialEquity)} />
            <StatBox label="Max Drawdown" value={`${result.maxDrawdownPct.toFixed(2)}%`} />
            <StatBox label="Open Positions" value={String(result.openBaskets)} />
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="text-[10px] leading-relaxed text-amber-200/90">
              <AlertTriangle size={10} className="mr-1 inline" />{result.disclaimer}
            </p>
            <p className="mt-1 text-[9px] text-slate-500">
              Source: {result.source} · Generator: {result.generator} · seed={result.seed} · {result.bars} bars ({result.timeframe ?? tf}) · periode {result.period ?? period} · range {new Date(result.rangeStartMs).toISOString().slice(0, 10)} → {new Date(result.rangeEndMs).toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const W = 320;
const H = 120;
const PAD_X = 8;
const PAD_Y = 10;

function EquityChart({ points, initialEquity }: { points: BacktestResult['equityCurve']; initialEquity: number }) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-[11px] text-slate-500" role="status">
        Kurva ekuitas tidak tersedia — butuh minimal 2 titik data.
      </div>
    );
  }

  const values = points.map((p) => p.equity);
  const min = Math.min(initialEquity, ...values);
  const max = Math.max(initialEquity, ...values);
  const span = max - min || 1;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const polyline = points
    .map((p, i) => `${(PAD_X + (i / (points.length - 1)) * plotW).toFixed(2)},${(PAD_Y + (1 - (p.equity - min) / span) * plotH).toFixed(2)}`)
    .join(' ');
  const baselineY = PAD_Y + (1 - (initialEquity - min) / span) * plotH;
  const last = points[points.length - 1];
  const lineColor = last.equity >= initialEquity ? '#34d399' : '#fb7185';

  return (
    <figure className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <figcaption className="mb-2 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-slate-300">Kurva ekuitas (mark-to-market)</span>
        <span className="font-mono text-slate-400">
          {money(initialEquity, false)} → <span style={{ color: lineColor }}>{money(last.equity, false)}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Equity curve from ${money(initialEquity, false)} to ${money(last.equity, false)}`} className="h-32 w-full">
        <line x1={PAD_X} x2={W - PAD_X} y1={baselineY} y2={baselineY} stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 4" />
        <text x={PAD_X} y={baselineY - 3} fill="currentColor" opacity=".5" fontSize="8">initial {money(initialEquity, false)}</text>
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}

function money(v: number, signed = true): string {
  const sign = signed && v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function pnlColor(v: number): string {
  return v >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

function StatBox({ label, value, accent = 'text-slate-200' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent}`}>{value}</div>
    </div>
  );
}
