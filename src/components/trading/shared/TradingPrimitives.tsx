'use client';

import React from 'react';
import { MARKET_STATUS_META, type MarketFeedStatus } from '../../../lib/data/markets';

export const UNKNOWN = '—';

/** Kontrak anti-fabrikasi: nilai kosong/non-finite SELALU tampil "—". */
export function orUnknown(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : UNKNOWN;
  return value.trim().length > 0 ? value : UNKNOWN;
}

export interface PanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, right, children, icon, className = '' }: PanelProps) {
  return (
    <section className={`rounded-xl border border-white/10 bg-black/40 p-4 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-zinc-400">{icon}</span>}
          <div>
            <h3 className="text-xs font-bold text-zinc-100">{title}</h3>
            {subtitle && <p className="text-[11px] text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        {right && <div>{right}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export interface StatusPillProps {
  status: MarketFeedStatus;
  suffix?: React.ReactNode;
}

export function StatusPill({ status, suffix }: StatusPillProps) {
  const meta = MARKET_STATUS_META[status] || MARKET_STATUS_META.unavailable;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border uppercase"
      style={{
        backgroundColor: `${meta.color}15`,
        borderColor: `${meta.color}35`,
        color: meta.color,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
      {suffix && <span className="text-zinc-400">· {suffix}</span>}
    </span>
  );
}

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
}

const TONE_COLOR = {
  default: 'text-zinc-100',
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  accent: 'text-cyan-400',
};

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{it.label}</span>
          <span className={`text-sm font-extrabold font-mono ${TONE_COLOR[it.tone || 'default']}`}>{it.value}</span>
          {it.hint && <span className="text-[10px] text-zinc-400">{it.hint}</span>}
        </div>
      ))}
    </div>
  );
}

export interface NoticeProps {
  tone?: 'info' | 'warn' | 'error' | 'success';
  title?: React.ReactNode;
  children: React.ReactNode;
}

const NOTICE_STYLE = {
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
};

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <div className={`rounded-xl border p-3 text-xs ${NOTICE_STYLE[tone]}`}>
      {title && <div className="font-bold mb-1">{title}</div>}
      <div className="opacity-90">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
      <span className="text-2xl mb-2">{icon}</span>
      <h4 className="text-xs font-bold text-zinc-200">{title}</h4>
      {description && <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">{description}</p>}
    </div>
  );
}

export const tradingStyles = {};
