'use client';

import React from 'react';
import { css } from '@emotion/css';
import { MARKET_STATUS_META, type MarketFeedStatus } from '../../../lib/data/markets';

export const UNKNOWN = '—';

/** Kontrak anti-fabrikasi: nilai kosong/non-finite SELALU tampil "—". */
export function orUnknown(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : UNKNOWN;
  return value.trim().length > 0 ? value : UNKNOWN;
}

const styles = {
  panel: css`
    padding: 16px;
    border-radius: 16px;
    background: #111218;
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  `,

  panelHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  `,

  panelTitleGroup: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  `,

  panelTitle: css`
    font-size: 13px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  panelSubtitle: css`
    font-size: 11.5px;
    color: #a1a1aa;
    line-height: 1.5;
  `,

  pill: (color: string, bg: string, border: string) => css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: ${color};
    background: ${bg};
    border: 1px solid ${border};
    white-space: nowrap;
  `,

  statGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 8px;
  `,

  statCard: css`
    padding: 10px 12px;
    border-radius: 12px;
    background: #15161c;
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  `,

  statLabel: css`
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #71717a;
    font-weight: 800;
  `,

  statValue: (color: string) => css`
    font-size: 13px;
    font-weight: 800;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: ${color};
    overflow-wrap: anywhere;
  `,

  notice: (color: string, bg: string, border: string) => css`
    padding: 11px 13px;
    border-radius: 12px;
    font-size: 11.5px;
    line-height: 1.55;
    color: ${color};
    background: ${bg};
    border: 1px solid ${border};
    display: flex;
    flex-direction: column;
    gap: 5px;
  `,

  empty: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 30px 16px;
    border-radius: 14px;
    background: #0f1015;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    text-align: center;
    color: #a1a1aa;
    font-size: 12px;
  `,

  table: css`
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  `,

  th: css`
    text-align: left;
    padding: 8px 10px;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #71717a;
    font-weight: 800;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    white-space: nowrap;
  `,

  td: css`
    padding: 9px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: #e4e4e7;
    vertical-align: top;
  `,

  mono: css`
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
  `,

  tableScroll: css`
    overflow-x: auto;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: #0d0e13;
  `,

  fieldInput: css`
    width: 100%;
    padding: 8px 10px;
    border-radius: 9px;
    background: #14151b;
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    outline: none;

    &::placeholder {
      color: #6b7280;
    }

    &:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.18);
    }
  `,

  btn: (variant: 'primary' | 'ghost' | 'danger' | 'warn') => {
    let bg = 'rgba(255, 255, 255, 0.06)';
    let border = 'rgba(255, 255, 255, 0.14)';
    let color = '#f4f4f5';
    if (variant === 'primary') {
      bg = 'rgba(16, 185, 129, 0.2)';
      border = 'rgba(16, 185, 129, 0.5)';
      color = '#6ee7b7';
    } else if (variant === 'warn') {
      bg = 'rgba(245, 158, 11, 0.16)';
      border = 'rgba(245, 158, 11, 0.45)';
      color = '#fcd34d';
    } else if (variant === 'danger') {
      bg = 'rgba(244, 63, 94, 0.16)';
      border = 'rgba(244, 63, 94, 0.45)';
      color = '#fda4af';
    }
    return css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 13px;
      border-radius: 10px;
      background: ${bg};
      border: 1px solid ${border};
      color: ${color};
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;

      &:hover:not(:disabled) {
        filter: brightness(1.15);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `;
  },
};

export interface PanelProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Panel({ title, subtitle, right, children, icon }: PanelProps) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <div className={styles.panelTitle}>
            {icon}
            <span>{title}</span>
          </div>
          {subtitle ? <div className={styles.panelSubtitle}>{subtitle}</div> : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export interface StatusPillProps {
  status: MarketFeedStatus;
  /** Label tambahan, mis. jumlah baris. */
  suffix?: string;
}

export function StatusPill({ status, suffix }: StatusPillProps) {
  const meta = MARKET_STATUS_META[status];
  return (
    <span className={styles.pill(meta.color, meta.bg, meta.border)} title={meta.hint}>
      <span>{meta.label}</span>
      {suffix ? <span style={{ opacity: 0.75 }}>· {suffix}</span> : null}
    </span>
  );
}

export interface StatItem {
  label: string;
  value: React.ReactNode;
  color?: string;
  title?: string;
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className={styles.statGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.statCard} title={item.title}>
          <span className={styles.statLabel}>{item.label}</span>
          <span className={styles.statValue(item.color || '#f4f4f5')}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface NoticeProps {
  tone?: 'info' | 'warn' | 'danger' | 'ok';
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  const palette = {
    info: ['#bfdbfe', 'rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.32)'],
    warn: ['#fde68a', 'rgba(245, 158, 11, 0.12)', 'rgba(245, 158, 11, 0.32)'],
    danger: ['#fecaca', 'rgba(244, 63, 94, 0.12)', 'rgba(244, 63, 94, 0.32)'],
    ok: ['#a7f3d0', 'rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.32)'],
  } as const;
  const [color, bg, border] = palette[tone];
  return (
    <div className={styles.notice(color, bg, border)}>
      {title ? <b style={{ fontSize: '12px' }}>{title}</b> : null}
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <span style={{ fontSize: '22px' }}>{icon}</span>
      <b style={{ color: '#d4d4d8', fontSize: '12.5px' }}>{title}</b>
      {description ? <span style={{ maxWidth: '520px', lineHeight: 1.6 }}>{description}</span> : null}
    </div>
  );
}

export const tradingStyles = styles;
