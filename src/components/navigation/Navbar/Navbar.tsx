'use client';

import React, { useState } from 'react';
import {
  Target,
  Crown,
  Users,
  TerminalSquare,
  Palette,
  Keyboard,
  Sun,
  Moon,
  Compass,
  Coffee,
  Shirt,
  Gamepad2,
  Camera,
  Crosshair,
  Building2,
  Sparkles,
  Clock,
  Radio,
  X,
  Menu,
} from 'lucide-react';

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
  onOpenMinimap?: () => void;
  onOpenOfficeChat?: () => void;
  onOpenWardrobe?: () => void;
  onOpenDarts?: () => void;
  onOpenArcade?: () => void;
  onOpenPhotoMode?: () => void;
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
  onOpenMinimap,
  onOpenOfficeChat,
  onOpenWardrobe,
  onOpenDarts,
  onOpenArcade,
  onOpenPhotoMode,
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
      className={`fixed top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-40 max-w-[1920px] mx-auto flex items-center justify-between gap-2 sm:gap-4 md:gap-6 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-2xl md:rounded-3xl bg-[#0a0a0e]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.7)] font-sans select-none overflow-visible ${className}`}
    >
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-violet-500/25 border border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.25)] flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <span className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight leading-tight truncate">
              Yapping Techflow
            </span>
            <span className="text-[9px] sm:text-[10px] md:text-[11px] font-mono font-bold px-1.5 sm:px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0">
              v3.5
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-zinc-400 leading-tight hidden xs:block truncate">Virtual AI Penthouse Suite</span>
        </div>
      </div>

      {/* Center Live Indicators in a Roomy Capsule (Visible on xl+ screens) */}
      <div className="hidden xl:flex items-center gap-2.5 2xl:gap-4 px-3.5 2xl:px-5 py-1.5 2xl:py-2 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner shrink-0">
        <div className="flex items-center gap-2 px-2.5 2xl:px-3.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs font-semibold whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
          <span>9/9 Karyawan AI</span>
        </div>
        <div className="w-px h-3.5 bg-white/15 mx-0.5" aria-hidden="true" />
        <div className={`flex items-center gap-2 px-2.5 2xl:px-3.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${sprintColor}`}>
          <span>Sprint: {missionState}</span>
        </div>
        <div className="w-px h-3.5 bg-white/15 mx-0.5" aria-hidden="true" />
        <div className="flex items-center gap-1.5 px-2.5 2xl:px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 font-mono text-xs font-semibold text-sky-300 whitespace-nowrap">
          <Clock size={12} className="text-sky-400" />
          <span>{clockStr}</span>
        </div>
      </div>

      {/* Right Desktop Actions - Clean Spacing & Adaptive Responsiveness */}
      <div className="hidden md:flex items-center gap-1.5 lg:gap-2.5 shrink-0">
        {/* Cluster 1: Penthouse Quick Toggles (Minimap & Group Chat) */}
        <div className="flex items-center gap-1 lg:gap-1.5 p-1 px-1.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm shrink-0">
          {onOpenMinimap && (
            <button
              type="button"
              onClick={onOpenMinimap}
              title="Radar Minimap Penthouse (Shortcut: M)"
              className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-400/50 hover:shadow-[0_4px_16px_rgba(52,211,153,0.2)] active:scale-95 transition-all whitespace-nowrap"
            >
              <Compass size={14} />
              <span className="hidden lg:inline">Radar</span>
            </button>
          )}

          {onOpenOfficeChat && (
            <button
              type="button"
              onClick={onOpenOfficeChat}
              title="Warung Kopi TechFlow / WAG Kantor (Shortcut: N)"
              className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-400/50 hover:shadow-[0_4px_16px_rgba(251,191,36,0.2)] active:scale-95 transition-all whitespace-nowrap"
            >
              <Coffee size={14} />
              <span className="hidden lg:inline">Warung Kopi</span>
            </button>
          )}
        </div>

        <div className="w-px h-4 bg-white/15 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Cluster 2: Executive & Squad Operations with Responsive Text */}
        <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenMissionControl}
            title="Buka Mission Control Board (Shortcut: J)"
            className="inline-flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 md:py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 border border-emerald-400/40 shadow-[0_4px_16px_rgba(16,185,129,0.35)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0 whitespace-nowrap"
          >
            <Target size={14} />
            <span className="hidden sm:inline">Mission Control</span>
          </button>

          {onOpenKhansaChat && (
            <button
              type="button"
              onClick={onOpenKhansaChat}
              title="Ngobrol langsung dengan Khansaku (Shortcut: K)"
              className="inline-flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 md:py-2 rounded-xl text-xs font-bold text-rose-200 bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/50 hover:bg-rose-500/30 hover:text-white shadow-[0_4px_16px_rgba(244,63,94,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0 whitespace-nowrap"
            >
              <Crown size={14} />
              <span className="hidden sm:inline">Chat Khansaku</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenTeamDirectory}
            title="Daftar Profil Tim Karyawan AI"
            className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 md:py-2 rounded-xl text-xs font-semibold text-zinc-200 bg-white/[0.06] border border-white/10 hover:bg-white/15 hover:text-white transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <Users size={14} />
            <span className="hidden lg:inline">Tim</span>
          </button>

          <button
            type="button"
            onClick={onToggleTerminal}
            title="Buka Terminal & Log Stream (Shortcut: T)"
            className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 md:py-2 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 hover:text-cyan-200 transition-all active:scale-95 shrink-0 whitespace-nowrap"
          >
            <TerminalSquare size={14} />
            <span className="hidden lg:inline">Terminal</span>
          </button>
        </div>

        <div className="w-px h-4 bg-white/15 mx-0.5 shrink-0" aria-hidden="true" />

        {/* Cluster 3: Utilities & Theme */}
        <div className="flex items-center gap-1 p-1 px-1.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm shrink-0">
          {onOpenFigma && (
            <button
              type="button"
              onClick={onOpenFigma}
              title="Desain Figma (Shortcut: F)"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <Palette size={15} />
            </button>
          )}

          {onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              title="Bantuan Navigasi & Shortcut"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <Keyboard size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            title="Ganti Tema (Dark / Light)"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {/* Mobile Toggle - strictly hidden on md and up */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Menu"
        className="flex md:hidden w-9 h-9 items-center justify-center rounded-xl text-zinc-300 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-colors shrink-0"
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 mt-3 p-4 rounded-3xl bg-[#0a0a0e]/98 border border-white/15 backdrop-blur-2xl flex flex-col gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <div className="grid grid-cols-2 gap-2.5 pb-3 border-b border-white/10">
            {onOpenMinimap && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenMinimap();
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25"
              >
                <Compass size={15} /> Radar
              </button>
            )}
            {onOpenOfficeChat && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenOfficeChat();
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/25"
              >
                <Coffee size={15} /> Warung Kopi
              </button>
            )}
            {onOpenDarts && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDarts();
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10"
              >
                <Crosshair size={15} /> Darts
              </button>
            )}
            {onOpenArcade && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenArcade();
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10"
              >
                <Gamepad2 size={15} /> Arcade
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenMissionControl?.();
            }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
          >
            <Target size={16} /> Mission Control
          </button>
          {onOpenKhansaChat && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenKhansaChat();
              }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold text-rose-200 bg-gradient-to-r from-rose-500/20 to-pink-500/20 border border-rose-500/40"
            >
              <Crown size={16} /> Chat Khansaku
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenTeamDirectory?.();
            }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold text-zinc-200 bg-white/5 border border-white/10"
          >
            <Users size={16} /> Tim Karyawan
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onToggleTerminal?.();
            }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30"
          >
            <TerminalSquare size={16} /> Terminal
          </button>
        </div>
      )}
    </header>
  );
}
