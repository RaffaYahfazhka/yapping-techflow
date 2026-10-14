'use client';

import React, { useState } from 'react';
import { Target, Crown, Users, TerminalSquare, Palette, Keyboard, Sun, Moon } from 'lucide-react';
import { css } from '@emotion/css';

export interface NavbarProps {
  missionState?: string;
  clockStr?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenTeamDirectory?: () => void;
  onOpenMissionControl?: () => void;
  onOpenKhansaChat?: () => void;
  onOpenFigma?: () => void;
  onToggleTerminal?: () => void;
  onOpenHelp?: () => void;
  className?: string;
}

const styles = {
  header: css`
    position: fixed;
    top: 12px;
    left: 14px;
    right: 14px;
    z-index: 90;
    padding: 8px 18px;
    border-radius: 18px;
    background: rgba(10, 10, 14, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `,

  brandWrapper: css`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  `,

  brandLogo: css`
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(139, 92, 246, 0.2));
    border: 1px solid rgba(16, 185, 129, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  brandTitle: css`
    display: flex;
    flex-direction: column;
  `,

  brandTitleRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  brandName: css`
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
    line-height: 1.2;
  `,

  versionBadge: css`
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.16);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  `,

  brandSubtitle: css`
    font-size: 11px;
    color: #a1a1aa;
    font-weight: 500;
    @media (max-width: 640px) {
      display: none;
    }
  `,

  statusCenter: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;

    @media (max-width: 1024px) {
      display: none;
    }
  `,

  statusPill: (dotColor: string, textColor: string) => css`
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    color: ${textColor};

    &::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${dotColor};
      box-shadow: 0 0 8px ${dotColor};
    }
  `,

  actionsRight: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;

    @media (max-width: 768px) {
      display: none;
    }
  `,

  actionBtn: (variant?: 'primary' | 'secondary' | 'accent') => {
    let bg = 'rgba(255, 255, 255, 0.06)';
    let border = 'rgba(255, 255, 255, 0.12)';
    let color = '#f4f4f5';
    let hoverBg = 'rgba(255, 255, 255, 0.12)';

    if (variant === 'primary') {
      bg = 'linear-gradient(135deg, #f59e0b, #d97706)';
      border = 'rgba(245, 158, 11, 0.6)';
      color = '#000000';
      hoverBg = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
    } else if (variant === 'accent') {
      bg = 'rgba(16, 185, 129, 0.15)';
      border = 'rgba(16, 185, 129, 0.35)';
      color = '#34d399';
      hoverBg = 'rgba(16, 185, 129, 0.25)';
    }

    return css`
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      border-radius: 10px;
      background: ${bg};
      border: 1px solid ${border};
      color: ${color};
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
      white-space: nowrap;

      &:hover {
        background: ${hoverBg};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
    `;
  },

  iconBtn: css`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e4e4e7;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.22);
    }
  `,

  mobileToggle: css`
    display: none;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;

    @media (max-width: 768px) {
      display: flex;
    }
  `,

  mobileDrawer: css`
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    left: 0;
    background: rgba(14, 14, 18, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
  `,
};

export default function Navbar({
  missionState = 'IDLE',
  clockStr = '--:--:--',
  theme = 'dark',
  onToggleTheme,
  onOpenTeamDirectory,
  onOpenMissionControl,
  onOpenKhansaChat,
  onOpenFigma,
  onToggleTerminal,
  onOpenHelp,
  className = '',
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className={`${styles.header} ${className}`} id="hud-header">
      {/* Brand Logo & Title */}
      <div className={styles.brandWrapper}>
        <div className={styles.brandLogo} aria-hidden="true">
          <svg viewBox="0 0 64 64" width="22" height="22">
            <path
              d="M32 8 54 20.5v23L32 56 10 43.5v-23Z"
              fill="none"
              stroke="#34d399"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M32 32 54 20.5M32 32 10 20.5M32 32v24"
              stroke="#a78bfa"
              strokeWidth="4"
              strokeLinecap="round"
              opacity=".85"
            />
          </svg>
        </div>

        <div className={styles.brandTitle}>
          <div className={styles.brandTitleRow}>
            <span className={styles.brandName}>Kantor Raffa</span>
            <span className={styles.versionBadge}>v2.5 TS</span>
          </div>
          <span className={styles.brandSubtitle}>
            Autonomous Mission Control
          </span>
        </div>
      </div>

      {/* Center Live Indicators */}
      <div className={styles.statusCenter}>
        <div className={styles.statusPill('#10b981', '#6ee7b7')}>
          <span>6/6 Karyawan Aktif</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>|</span>
        <div
          className={styles.statusPill(
            missionState === 'RUNNING'
              ? '#f59e0b'
              : missionState === 'COMPLETED'
              ? '#10b981'
              : '#a1a1aa',
            missionState === 'RUNNING'
              ? '#fcd34d'
              : missionState === 'COMPLETED'
              ? '#6ee7b7'
              : '#d4d4d8'
          )}
        >
          <span>Sprint: {missionState}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>|</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>
          ⏱ {clockStr}
        </span>
      </div>

      {/* Right Desktop Actions */}
      <div className={styles.actionsRight}>
        <button
          type="button"
          className={styles.actionBtn('primary')}
          onClick={onOpenMissionControl}
          title="Buka Mission Control Board (Shortcut: J)"
        >
          <span><Target size={13} /></span>
          <span>Mission Control</span>
        </button>

        {onOpenKhansaChat && (
          <button
            type="button"
            className={css`
              display: inline-flex;
              align-items: center;
              gap: 7px;
              padding: 7px 14px;
              border-radius: 10px;
              background: linear-gradient(135deg, rgba(244, 63, 94, 0.22), rgba(225, 29, 72, 0.15));
              border: 1px solid rgba(244, 63, 94, 0.55);
              color: #fecdd3;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.18s ease;
              box-shadow: 0 2px 10px rgba(244, 63, 94, 0.2);
              white-space: nowrap;

              &:hover {
                background: linear-gradient(135deg, rgba(244, 63, 94, 0.35), rgba(225, 29, 72, 0.25));
                border-color: #fb7185;
                color: #ffffff;
                transform: translateY(-1px);
                box-shadow: 0 4px 16px rgba(244, 63, 94, 0.4);
              }
            `}
            onClick={onOpenKhansaChat}
            title="Ngobrol langsung dengan Khansaku & racik prompt Antigravity (Shortcut: K)"
          >
            <Crown size={14} />
            <span>Chat Khansaku</span>
          </button>
        )}

        <button
          type="button"
          className={styles.actionBtn()}
          onClick={onOpenTeamDirectory}
          title="Daftar Profil Tim Karyawan AI"
        >
          <span><Users size={13} /></span>
          <span>Tim Karyawan</span>
        </button>

        <button
          type="button"
          className={styles.actionBtn('accent')}
          onClick={onToggleTerminal}
          title="Buka Terminal & Log Stream (Shortcut: T)"
        >
          <span><TerminalSquare size={13} /></span>
          <span>Terminal</span>
        </button>

        {onOpenFigma && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenFigma}
            title="Desain Figma (Shortcut: F)"
          >
            <Palette size={16} />
          </button>
        )}

        {onOpenHelp && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenHelp}
            title="Bantuan Navigasi & Shortcut"
          >
            <Keyboard size={16} />
          </button>
        )}

        <button
          type="button"
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title="Ganti Tema (Dark / Light)"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Mobile Toggle */}
      <button
        type="button"
        className={styles.mobileToggle}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Menu"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className={styles.mobileDrawer}>
          <button
            type="button"
            className={styles.actionBtn('primary')}
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenMissionControl?.();
            }}
          >
            <span><Target size={13} /></span> Mission Control
          </button>
          {onOpenKhansaChat && (
            <button
              type="button"
              className={styles.actionBtn()}
              style={{
                background: 'rgba(244, 63, 94, 0.2)',
                borderColor: 'rgba(244, 63, 94, 0.4)',
                color: '#fecdd3',
              }}
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenKhansaChat();
              }}
            >
              <Crown size={14} />
              <span>Chat Khansaku</span>
            </button>
          )}
          <button
            type="button"
            className={styles.actionBtn()}
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenTeamDirectory?.();
            }}
          >
            <span><Users size={13} /></span> Tim Karyawan
          </button>
          <button
            type="button"
            className={styles.actionBtn('accent')}
            onClick={() => {
              setMobileMenuOpen(false);
              onToggleTerminal?.();
            }}
          >
            <span><TerminalSquare size={13} /></span> Terminal Log
          </button>
        </div>
      )}
    </header>
  );
}
