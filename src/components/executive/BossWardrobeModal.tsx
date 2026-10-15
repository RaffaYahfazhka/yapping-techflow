'use client';

/**
 * BossWardrobeModal - 3 outfit presets + 4 emote triggers.
 * Visual-only; application must be confirmed; applied outfit is persisted after click.
 * Overhauled with Framer Motion spring physics, neon glassmorphic aesthetics,
 * interactive outfit preview with holographic aura, and keyboard navigation.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Sparkles, X, Crown, Shirt, Palette } from 'lucide-react';
import { BOSS } from '@/lib/data/agents';

export type WardrobePreset = 'stealth-ceo' | 'casual-founder' | 'relaxed-terrace';

export interface WardrobeOption {
  id: WardrobePreset;
  name: string;
  emoji: string;
  description: string;
  look: { shirt: string; pants: string; accessory: string; accent: string };
}

export const WARDROBE_OPTIONS: WardrobeOption[] = [
  {
    id: 'stealth-ceo',
    name: 'Stealth CEO',
    emoji: '💼',
    description: 'Blazer hitam arang, turtle neck abu-abu, smartwatch emas.',
    look: { shirt: '#18181b', pants: '#27272a', accessory: 'crown', accent: '#fbbf24' },
  },
  {
    id: 'casual-founder',
    name: 'Casual Founder',
    emoji: '🚀',
    description: 'Hoodie mint TechFlow oversized, jogger hitam, sneakers hypebeast.',
    look: { shirt: '#10b981', pants: '#18181b', accessory: 'crown', accent: '#10b981' },
  },
  {
    id: 'relaxed-terrace',
    name: 'Relaxed Terrace',
    emoji: '☕',
    description: 'Kemeja flanel digulung santai, kacamata hitam UV.',
    look: { shirt: '#78716c', pants: '#292524', accessory: 'glasses', accent: '#94a3b8' },
  },
];

export interface EmoteOption {
  id: 'cheers' | 'gaze' | 'sit' | 'wave';
  label: string;
  icon: string;
  description: string;
}

export const EMOTES: EmoteOption[] = [
  { id: 'cheers', label: 'Bersulang Kopi', icon: '🥂', description: 'Angkat cangkir kopi ke arah kamera' },
  { id: 'gaze', label: 'Pose Eksekutif', icon: '🤵', description: 'Bersedekap menatap panorama' },
  { id: 'sit', label: 'Duduk Santai', icon: '🪑', description: 'Duduk sofa teras bersama Khansaku' },
  { id: 'wave', label: 'Wave & Sapa', icon: '👋', description: 'Melambaikan tangan menyapa tim' },
];

const STORAGE_KEY = 'kantor-raffa.boss-wardrobe';

function loadApplied(): WardrobePreset | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'stealth-ceo' || raw === 'casual-founder' || raw === 'relaxed-terrace') return raw;
    return 'stealth-ceo';
  } catch {
    return null;
  }
}

export default function BossWardrobeModal({
  isOpen,
  onClose,
  onApply,
  onEmote,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (preset: WardrobePreset) => void;
  onEmote?: (emote: EmoteOption['id']) => void;
}) {
  const [applied, setApplied] = useState<WardrobePreset | null>(null);
  const [preview, setPreview] = useState<WardrobePreset | null>(null);
  const [activeEmoteId, setActiveEmoteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = loadApplied();
      setApplied(current);
      setPreview(current);
    }
  }, [isOpen]);

  const apply = useCallback(
    (id: WardrobePreset) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* Keep this selection active for current session */
      }
      setApplied(id);
      setPreview(id);
      onApply?.(id);
    },
    [onApply]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= EMOTES.length) {
        const emote = EMOTES[num - 1];
        if (emote) {
          triggerEmote(emote.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const triggerEmote = (id: EmoteOption['id']) => {
    setActiveEmoteId(id);
    onEmote?.(id);
    setTimeout(() => setActiveEmoteId(null), 1000);
  };

  const previewOption = WARDROBE_OPTIONS.find((option) => option.id === preview);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wardrobe-title"
        >
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Top ambient aura */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[300px] rounded-full bg-violet-500/[0.08] blur-[100px]" />
          </div>

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative flex w-full max-w-3xl flex-col my-auto overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0c0d12]/[0.98] shadow-[0_32px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top gradient highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

            {/* Header */}
            <header className="flex items-center justify-between px-6 sm:px-8 py-4.5 border-b border-white/[0.08] bg-white/[0.015] shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
                  <Crown size={20} className="text-violet-400" />
                </div>
                <div>
                  <h2 id="wardrobe-title" className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Wardrobe Bos Raffa
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      FOUNDER
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Setelan aktif:{' '}
                    <span className="text-emerald-400 font-semibold">
                      {applied ? WARDROBE_OPTIONS.find((option) => option.id === applied)?.name : 'Default'}
                    </span>
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Tutup wardrobe"
              >
                <X size={18} strokeWidth={2.2} />
              </motion.button>
            </header>

            {/* Scrollable Dialog Body */}
            <div className="flex-1 overflow-y-auto max-h-[75vh] px-6 sm:px-8 py-5 space-y-5 scrollbar-thin">
              {/* Executive Suite Backdrop Preview Banner */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-black/40 h-28 sm:h-32 group">
                <img
                  src="/textures/props/boss_executive_desk.jpg"
                  alt="Executive Boss Desk Suite"
                  className="w-full h-full object-cover object-center opacity-65 group-hover:opacity-85 transition-opacity duration-300 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                      SCBD Executive Penthouse Suite
                    </span>
                    <h3 className="text-sm font-bold text-white drop-shadow-md">
                      Meja Bos Raffa & Panoramic Skyline
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-black/60 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                    LIVE 3D SUITE
                  </span>
                </div>
              </div>

              {/* Live Holographic Preview Card */}
              {previewOption && (
                <motion.div
                  layout
                  className="flex items-center gap-4.5 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent p-4 sm:p-5 shadow-inner backdrop-blur-sm"
                  aria-live="polite"
                >
                  <div
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl shadow-lg border border-white/20"
                    style={{
                      background: `linear-gradient(135deg, ${previewOption.look.shirt}, #111)`,
                      boxShadow: `0 0 24px ${previewOption.look.accent}33`,
                    }}
                  >
                    {previewOption.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white">Preview · {previewOption.name}</p>
                      <div className="flex items-center gap-2 ml-auto">
                        <span
                          className="h-3 w-3 rounded-full border border-white/30 shadow-sm"
                          style={{ background: previewOption.look.shirt }}
                          title="Warna pakaian"
                        />
                        <span
                          className="h-3 w-3 rounded-full border border-white/30 shadow-sm"
                          style={{ background: previewOption.look.accent }}
                          title="Aksen warna"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{previewOption.description}</p>
                  </div>
                </motion.div>
              )}

              {/* Pilihan Setelan Busana */}
              <div>
                <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <Shirt size={14} className="text-emerald-400" /> Pilihan Setelan Busana
                </span>
                <div className="grid gap-3 sm:grid-cols-3">
                  {WARDROBE_OPTIONS.map((option) => {
                    const isSelected = applied === option.id;
                    const isHovered = preview === option.id;

                    return (
                      <motion.button
                        key={option.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onMouseEnter={() => setPreview(option.id)}
                        onMouseLeave={() => setPreview(applied)}
                        onFocus={() => setPreview(option.id)}
                        onBlur={() => setPreview(applied)}
                        onClick={() => apply(option.id)}
                        aria-pressed={isSelected}
                        className={`relative rounded-2xl border p-4.5 text-left transition-all duration-200 flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                            : isHovered
                            ? 'border-white/30 bg-white/[0.07] text-white shadow-sm'
                            : 'border-white/[0.08] bg-white/[0.025] text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="rounded-xl px-2.5 py-1 text-lg shadow-sm border border-white/10"
                            style={{ background: option.look.shirt, color: option.look.accent }}
                          >
                            {option.emoji}
                          </span>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className="mb-3">
                          <strong className="text-xs block text-white font-bold mb-1">{option.name}</strong>
                          <p className="text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
                            {option.description}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold block pt-2 border-t border-white/[0.06] ${
                            isSelected ? 'text-emerald-300' : 'text-zinc-500'
                          }`}
                        >
                          {isSelected ? '✓ Aktif Digunakan' : 'Klik untuk pakai'}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Pose & Emote Santai Bos Raffa */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <p className="mb-3.5 flex items-center justify-between text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-violet-400" /> Pose &amp; Emote Santai Bos Raffa
                  </span>
                  <span className="text-[10px] text-zinc-500 lowercase font-normal">Shortcut keyboard [1-4]</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EMOTES.map((emote, index) => {
                    const isActive = activeEmoteId === emote.id;
                    return (
                      <motion.button
                        key={emote.id}
                        type="button"
                        whileHover={{ scale: 1.01, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => triggerEmote(emote.id)}
                        className={`group rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                          isActive
                            ? 'border-violet-400/60 bg-violet-500/20 shadow-[0_0_16px_rgba(139,92,246,0.3)]'
                            : 'border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/20'
                        }`}
                        aria-label={`${emote.label}: ${emote.description}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white flex items-center gap-2 min-w-0 truncate">
                            <span className="text-base group-hover:scale-125 transition-transform shrink-0">{emote.icon}</span>
                            <span className="truncate">{emote.label}</span>
                          </span>
                          <span className="font-mono text-[9px] text-zinc-400 font-bold bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                            [{index + 1}]
                          </span>
                        </div>
                        <span className="block text-[11px] text-zinc-400 leading-tight mt-0.5">
                          {emote.description}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}