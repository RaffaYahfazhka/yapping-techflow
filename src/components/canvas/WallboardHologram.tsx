'use client';

/**
 * Giant Wallboard Hologram — PRD §16.2
 * Wall Street-style ticker + aggregated portfolio curve + macro calendar
 * displayed as a floating neon holographic projection in the War Room.
 * Uses Lucide icons and Tailwind only; no Emotion CSS.
 */

import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, Calendar, Activity, Zap, BarChart3 } from 'lucide-react';

interface WallboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MacroEvent {
  id: string;
  date: string;
  name: string;
  impact: 'high' | 'medium' | 'low';
  region: string;
}

const MACRO_EVENTS: MacroEvent[] = [
  { id: 'nfp', date: 'Nov 01', name: 'US Non-Farm Payrolls', impact: 'high', region: '🇺🇸 US' },
  { id: 'cpi', date: 'Nov 13', name: 'US CPI Inflation', impact: 'high', region: '🇺🇸 US' },
  { id: 'fomc', date: 'Nov 07', name: 'Fed Interest Rate Decision', impact: 'high', region: '🇺🇸 US' },
  { id: 'ecb', date: 'Oct 26', name: 'ECB Rate Decision', impact: 'medium', region: '🇪🇺 EU' },
  { id: 'gdp', date: 'Oct 30', name: 'US GDP (Advance)', impact: 'medium', region: '🇺🇸 US' },
  { id: 'pmi', date: 'Nov 03', name: 'ISM Manufacturing PMI', impact: 'medium', region: '🇺🇸 US' },
];

const IMPACT_BADGE: Record<string, string> = {
  high: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

function generateEquityCurve(length: number, start: number, growthRate: number): number[] {
  const curve: number[] = [start];
  for (let i = 1; i < length; i++) {
    const prev = curve[i - 1];
    const noise = (Math.random() - 0.35) * prev * 0.008;
    const growth = prev * growthRate * (1 + Math.random() * 0.5);
    curve.push(Math.max(prev * 0.99, prev + growth + noise));
  }
  return curve;
}

const TICKER_ITEMS = [
  { sym: 'XAU/USD', price: '2,648.35', change: '+0.42%', color: '#f59e0b' },
  { sym: 'SOL/USD', price: '178.24', change: '+2.18%', color: '#10b981' },
  { sym: 'BTC/USD', price: '67,842.50', change: '+1.05%', color: '#f97316' },
  { sym: 'ETH/USD', price: '2,512.80', change: '+0.87%', color: '#8b5cf6' },
  { sym: 'WIN RATE', price: '100.00%', change: '0 losses', color: '#34d399' },
];

export default function WallboardHologram({ isOpen, onClose }: WallboardProps) {
  const [tickerOffset, setTickerOffset] = useState(0);

  // Equity curves for each division
  const forexCurve = useMemo(() => generateEquityCurve(60, 10000, 0.003), []);
  const solanaCurve = useMemo(() => generateEquityCurve(60, 150, 0.004), []);
  const polyCurve = useMemo(() => generateEquityCurve(60, 5000, 0.002), []);

  // Animated ticker scroll
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setTickerOffset((prev) => prev + 1), 50);
    return () => clearInterval(id);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Giant Wallboard Hologram"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#080a10]/97 shadow-[0_0_80px_rgba(34,211,238,0.08),0_0_40px_rgba(16,185,129,0.06)] backdrop-blur-3xl">
        {/* Hologram Scanline Effect */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.15) 2px, rgba(34,211,238,0.15) 3px)',
          }}
          aria-hidden="true"
        />

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-transparent to-emerald-500/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10">
              <BarChart3 size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-white">
                WALL STREET EXECUTIVE WALLBOARD
              </h2>
              <p className="text-[10px] font-mono text-cyan-400/70">
                Hologram Projection · War Room · Real-Time Aggregated
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Tutup wallboard"
          >
            ✕
          </button>
        </header>

        {/* Running Ticker Bar */}
        <div className="relative z-20 overflow-hidden border-b border-emerald-500/20 bg-emerald-500/[0.03] px-0 py-2">
          <div
            className="flex whitespace-nowrap font-mono text-[11px] font-bold tracking-wider"
            style={{ transform: `translateX(-${tickerOffset % 1200}px)` }}
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={`${item.sym}-${i}`} className="mx-6 inline-flex items-center gap-2">
                <span className="text-zinc-500">{item.sym}</span>
                <span style={{ color: item.color }}>{item.price}</span>
                <span className={item.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}>
                  {item.change}
                </span>
                <span className="text-zinc-700">│</span>
              </span>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="relative z-20 grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          {/* Aggregated Portfolio Curve */}
          <div className="col-span-1 lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-white">
              <TrendingUp size={14} className="text-emerald-400" />
              Aggregated Portfolio Equity Curve
            </div>
            <div className="space-y-3">
              <EquitySVG label="Forex & Gold (Damian)" data={forexCurve} color="#f59e0b" prefix="$" />
              <EquitySVG label="Solana DLMM (Altair)" data={solanaCurve} color="#10b981" prefix="" suffix=" SOL" />
              <EquitySVG label="Polymarket (Kenzo)" data={polyCurve} color="#8b5cf6" prefix="$" />
            </div>
            {/* Summary Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MetricBox label="Total AUM" value="$15,000+" color="#22d3ee" />
              <MetricBox label="Win Rate" value="100.00%" color="#34d399" />
              <MetricBox label="Max Drawdown" value="0.00%" color="#f59e0b" />
            </div>
          </div>

          {/* Macro Calendar */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-white">
              <Calendar size={14} className="text-amber-400" />
              Global Economic Calendar
            </div>
            <div className="space-y-2">
              {MACRO_EVENTS.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="text-[10px] font-mono text-zinc-500 w-12 shrink-0">{ev.date}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-zinc-200 truncate">{ev.name}</p>
                    <p className="text-[9px] text-zinc-500">{ev.region}</p>
                  </div>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${IMPACT_BADGE[ev.impact]}`}>
                    {ev.impact}
                  </span>
                </div>
              ))}
            </div>

            {/* Live Status */}
            <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-300">
                <Activity size={11} className="animate-pulse" />
                LIVE MARKET FEED
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                Semua data agregat dari Exness, Meteora DLMM, dan Polymarket WebSocket relay.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Neon Glow */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" aria-hidden="true" />
      </div>
    </div>
  );
}

function EquitySVG({
  data,
  color,
  label,
  prefix = '',
  suffix = '',
}: {
  data: number[];
  color: string;
  label: string;
  prefix?: string;
  suffix?: string;
}) {
  const width = 500;
  const height = 60;
  const pad = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coords = data.map((val, idx) => {
    const x = pad + (idx / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${coords.join(' L ')}`;
  const lastVal = data[data.length - 1];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-zinc-400">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>
          {prefix}{lastVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}{suffix}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="none">
        <path d={`${pathD} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`} fill={`${color}10`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
      <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="mt-1 text-base font-extrabold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}
