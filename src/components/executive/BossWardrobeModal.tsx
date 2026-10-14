'use client';

/**
 * BossWardrobeModal - 3 outfit presets + 4 emote triggers.
 * Visual-only; application must be confirmed; applied outfit is persisted after click.
 */

import { useEffect, useState, useCallback } from 'react';
import { Check, Sparkles } from 'lucide-react';
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
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="wardrobe-title">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 id="wardrobe-title" className="flex items-center gap-2 text-sm font-bold text-slate-200"><Sparkles size={14} className="text-violet-400" /> Wardrobe Bos Raffa</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300" aria-label="Tutup wardrobe">✕</button>
        </header>
        <p className="mb-3 text-[10px] text-slate-400" aria-live="polite">Setelan aktif: {applied ? WARDROBE_OPTIONS.find((option) => option.id === applied)?.name : 'belum dipilih'} · Pilih setelan untuk menerapkannya.</p>
        {previewOption && <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3" aria-live="polite"><span className="grid h-12 w-12 place-items-center rounded-lg text-2xl" style={{ background: previewOption.look.shirt, color: previewOption.look.accent }}>{previewOption.emoji}</span><div><p className="text-xs font-bold text-white">Preview · {previewOption.name}</p><p className="text-[10px] text-slate-400">{previewOption.description}</p></div></div>}
        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {WARDROBE_OPTIONS.map((option) => (
            <button key={option.id} type="button" onMouseEnter={() => setPreview(option.id)} onMouseLeave={() => setPreview(applied)} onFocus={() => setPreview(option.id)} onBlur={() => setPreview(applied)} onClick={() => apply(option.id)} aria-pressed={applied === option.id} className={`rounded-xl border px-3 py-3 text-left transition ${applied === option.id ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/25'}`}>
              <div className="mb-1 flex items-center gap-2"><span className="rounded-md px-1.5 py-0.5 text-base" style={{ background: option.look.shirt, color: option.look.accent }}>{option.emoji}</span><strong className="text-xs">{option.name}</strong>{applied === option.id && <Check size={11} className="text-emerald-400" />}</div>
              <p className="text-[10px] leading-relaxed text-slate-400">{option.description}</p>
              <span className="mt-2 block text-[9px] font-semibold text-emerald-300">{applied === option.id ? 'Aktif' : 'Terapkan setelan'}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-300"><Sparkles size={11} className="text-violet-400" /> Emote Bos Raffa</p>
          <div className="grid grid-cols-2 gap-2">{EMOTES.map((emote, index) => <button key={emote.id} type="button" onClick={() => onEmote?.(emote.id)} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-left text-[10px] text-slate-300 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label={`${emote.label}: ${emote.description}`}><span className="mr-1.5">{emote.icon}</span>{emote.label}<span className="ml-1 text-slate-600">[{index + 1}]</span><span className="mt-1 block text-slate-500">{emote.description}</span></button>)}</div>
        </div>
      </div>
    </div>
  );
}