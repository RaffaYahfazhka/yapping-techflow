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

export default function BossWardrobeModal({
  isOpen,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (preset: WardrobePreset) => void;
}) {
  const [applied, setApplied] = useState<WardrobePreset | null>(null);
  const [preview, setPreview] = useState<WardrobePreset | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApplied(loadApplied());
      setPreview(loadApplied());
    }
  }, [isOpen]);

  const apply = useCallback(
    (id: WardrobePreset) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* in-memory only */
      }
      setApplied(id);
      setPreview(id);
      onApply?.(id);
    },
    [onApply],
  );

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-label="Wardrobe Bos Raffa">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
            ✨ Wardrobe Bos Raffa
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300" aria-label="Tutup wardrobe">
            ✕
          </button>
        </header>

        <p className="mb-4 text-[10px] text-slate-500">Persetelan {BOSS.name} · {applied ? WARDROBE_OPTIONS.find((o) => o.id === applied)?.name : 'belum dipilih'} aktif sekarang</p>

        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {WARDROBE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseEnter={() => setPreview(o.id)}
              onMouseLeave={() => setPreview(applied)}
              onFocus={() => setPreview(o.id)}
              onClick={() => apply(o.id)}
              aria-pressed={applied === o.id}
              className={`rounded-xl border px-3 py-3 text-left text-${o.id === applied ? 'emerald' : 'slate'}-200 transition ${
                applied === o.id ? 'border-emerald-400/60 bg-emerald-500/15' : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md px-1.5 py-0.5 text-base" style={{ background: o.look.shirt, color: o.look.accent }}>{o.emoji}</span>
                <strong className="text-xs">{o.name}</strong>
                {applied === o.id && <Check size={11} className="text-emerald-400" />}
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">{o.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Sparkles size={11} className="text-violet-400" /> Emote Bos Raffa · Shortcut 1-4
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EMOTES.map((e, i) => (
              <button key={e.id} type="button" className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-left text-[10px] text-slate-300 hover:bg-slate-900" aria-label={e.label}>
                <span className="mr-1.5">{e.icon}</span>
                {e.label}
                <span className="ml-1 text-slate-600">[{i + 1}]</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}