'use client';

/**
 * BossWardrobeModal - 3 outfit presets + 4 emote triggers.
 * Visual-only; application must be confirmed; applied outfit is persisted after click.
 */

import { useEffect, useState, useCallback } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
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
  { id: 'stealth-ceo', name: 'Stealth CEO', emoji: '💼', description: 'Blazer hitam arang, turtle neck abu-abu, smartwatch emas.', look: { shirt: '#18181b', pants: '#27272a', accessory: 'crown', accent: '#fbbf24' } },
  { id: 'casual-founder', name: 'Casual Founder', emoji: '🚀', description: 'Hoodie mint TechFlow oversized, jogger hitam, sneakers hypebeast.', look: { shirt: '#10b981', pants: '#18181b', accessory: 'crown', accent: '#10b981' } },
  { id: 'relaxed-terrace', name: 'Relaxed Terrace', emoji: '☕', description: 'Kemeja flanel digulung santai, kacamata hitam UV.', look: { shirt: '#78716c', pants: '#292524', accessory: 'glasses', accent: '#94a3b8' } },
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

export default function BossWardrobeModal({ isOpen, onClose, onApply, onEmote }: {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (preset: WardrobePreset) => void;
  onEmote?: (emote: EmoteOption['id']) => void;
}) {
  const [applied, setApplied] = useState<WardrobePreset | null>(null);
  const [preview, setPreview] = useState<WardrobePreset | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = loadApplied();
      setApplied(current);
      setPreview(current);
    }
  }, [isOpen]);

  const apply = useCallback((id: WardrobePreset) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* Keep this selection active for the current session when storage is unavailable. */
    }
    setApplied(id);
    setPreview(id);
    onApply?.(id);
  }, [onApply]);

  if (!isOpen) return null;

  const previewOption = WARDROBE_OPTIONS.find((option) => option.id === preview);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 md:p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="wardrobe-title">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0c0d12]/95 p-6 sm:p-8 shadow-[0_30px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col gap-5">
        <header className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15">
              <Sparkles size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 id="wardrobe-title" className="text-base font-bold text-white tracking-wide">Wardrobe Bos Raffa</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Setelan aktif: <span className="text-emerald-400 font-semibold">{applied ? WARDROBE_OPTIONS.find((option) => option.id === applied)?.name : 'Default'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Tutup wardrobe"
          >
            <X size={18} />
          </button>
        </header>

        {previewOption && (
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4.5" aria-live="polite">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl shadow-inner border border-white/10" style={{ background: previewOption.look.shirt, color: previewOption.look.accent }}>
              {previewOption.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Preview · {previewOption.name}</p>
              <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">{previewOption.description}</p>
            </div>
          </div>
        )}

        <div>
          <span className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Pilihan Setelan Busana
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            {WARDROBE_OPTIONS.map((option) => {
              const isSelected = applied === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onMouseEnter={() => setPreview(option.id)}
                  onMouseLeave={() => setPreview(applied)}
                  onFocus={() => setPreview(option.id)}
                  onBlur={() => setPreview(applied)}
                  onClick={() => apply(option.id)}
                  aria-pressed={isSelected}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                      : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl px-2.5 py-1 text-lg" style={{ background: option.look.shirt, color: option.look.accent }}>
                      {option.emoji}
                    </span>
                    {isSelected && <Check size={16} className="text-emerald-400 shrink-0" />}
                  </div>
                  <div>
                    <strong className="text-xs block text-white font-bold">{option.name}</strong>
                    <p className="text-[11px] leading-relaxed text-zinc-400 mt-1 line-clamp-2">{option.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold block pt-1 border-t border-white/5 ${isSelected ? 'text-emerald-300' : 'text-zinc-500'}`}>
                    {isSelected ? '✓ Aktif Digunakan' : 'Klik untuk pakai'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="mb-3.5 flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
            <Sparkles size={13} className="text-violet-400" /> Pose &amp; Emote Santai Bos Raffa
          </p>
          <div className="grid grid-cols-2 gap-3">
            {EMOTES.map((emote, index) => (
              <button
                key={emote.id}
                type="button"
                onClick={() => onEmote?.(emote.id)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-left transition-all duration-150 hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                aria-label={`${emote.label}: ${emote.description}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>{emote.icon}</span> {emote.label}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                    [{index + 1}]
                  </span>
                </div>
                <span className="mt-1 block text-[11px] text-zinc-400">{emote.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}