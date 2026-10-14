'use client';

import React, { useState } from 'react';
import { Target, Crown, Users, TerminalSquare, Palette, Keyboard, Sun, Moon } from 'lucide-react';

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

  const isRunning = missionState === 'RUNNING';
  const isCompleted = missionState === 'COMPLETED';

  const sprintColor = isRunning
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    : isCompleted
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-white/10 bg-white/5 text-zinc-400';

  return (
    <header
      id="hud-header"
      className={`fixed top-3 left-3.5 right-3.5 z-40 flex items-center justify-between gap-4 px-4 py-2 rounded-2xl bg-[#0a0a0e]/90 backdrop-blur-xl border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.55)] font-sans select-none ${className}`}
    >
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 64 64" width="20" height="20" aria-hidden="true">
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

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white tracking-tight leading-tight">Kantor Raffa</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              v2.5 TS
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 leading-tight">Autonomous Mission Control</span>
        </div>
      </div>

      {/* Center Live Indicators */}
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
          <span>6/6 Karyawan Aktif</span>
        </div>
        <span className="text-white/20 text-xs">|</span>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${sprintColor}`}>
          <span>Sprint: {missionState}</span>
        </div>
        <span className="text-white/20 text-xs">|</span>
        <span className="font-mono text-xs font-semibold text-sky-400">⏱ {clockStr}</span>
      </div>

      {/* Right Desktop Actions */}
      <div className="hidden md:flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMissionControl}
          title="Buka Mission Control Board (Shortcut: J)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400/40 shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:brightness-110 hover:-translate-y-0.5 transition-all"
        >
          <Target size={13} />
          <span>Mission Control</span>
        </button>

        {onOpenKhansaChat && (
          <button
            type="button"
            onClick={onOpenKhansaChat}
            title="Ngobrol langsung dengan Khansaku (Shortcut: K)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-200 bg-gradient-to-r from-rose-500/20 to-rose-600/20 border border-rose-500/50 hover:bg-rose-500/30 hover:text-white shadow-[0_2px_10px_rgba(244,63,94,0.2)] hover:-translate-y-0.5 transition-all"
          >
            <Crown size={13} />
            <span>Chat Khansaku</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenTeamDirectory}
          title="Daftar Profil Tim Karyawan AI"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
        >
          <Users size={13} />
          <span>Tim Karyawan</span>
        </button>

        <button
          type="button"
          onClick={onToggleTerminal}
          title="Buka Terminal & Log Stream (Shortcut: T)"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
        >
          <TerminalSquare size={13} />
          <span>Terminal</span>
        </button>

        {onOpenFigma && (
          <button
            type="button"
            onClick={onOpenFigma}
            title="Desain Figma (Shortcut: F)"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Palette size={16} />
          </button>
        )}

        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title="Bantuan Navigasi & Shortcut"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Keyboard size={16} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          title="Ganti Tema (Dark / Light)"
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Mobile Toggle */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Menu"
        className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 mt-2 p-3 rounded-2xl bg-[#0a0a0e]/95 border border-white/10 backdrop-blur-xl flex flex-col gap-2 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenMissionControl?.();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600"
          >
            <Target size={14} /> Mission Control
          </button>
          {onOpenKhansaChat && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenKhansaChat();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/20"
            >
              <Crown size={14} /> Chat Khansaku
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenTeamDirectory?.();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-200 bg-white/5"
          >
            <Users size={14} /> Tim Karyawan
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onToggleTerminal?.();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10"
          >
            <TerminalSquare size={14} /> Terminal
          </button>
        </div>
      )}
    </header>
  );
}
