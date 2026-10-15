'use client';

/**
 * Office group chat ("Warung Kopi TechFlow") — renders the office event feed.
 * The feed lives in the page state; this modal is presentational + send box.
 * Uses Lucide icons and Tailwind only; no Emotion CSS, no plain authored selectors.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MessageSquare, Send, Coffee, Sparkles, Users, X, Hash, Smile } from 'lucide-react';
import type { OfficeEvent } from '@/lib/engine/socialEngine';
import { AGENTS, BOSS } from '@/lib/data/agents';

export interface OfficeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: OfficeEvent[];
  onSendUserMessage: (text: string) => void;
  onTreat: () => void;
  onDelegate: () => void;
}

const AGENT_NAMES: Record<string, string> = {
  tara: 'Khansaku',
  arga: 'Arga',
  jajang: 'Jajang',
  kian: 'Kian',
  vani: 'Vani',
  reno: 'Reno',
  'altair-raditya': 'Altair',
  'kenzo-danendra': 'Kenzo',
  'damian-prasetya': 'Damian',
  raffa: 'Bos Raffa',
  khansaku: 'Khansaku',
};

const AGENT_COLORS: Record<string, string> = {
  tara: '#f472b6',
  khansaku: '#f472b6',
  arga: '#38bdf8',
  jajang: '#a78bfa',
  kian: '#22d3ee',
  vani: '#06b6d4',
  reno: '#22d3ee',
  'altair-raditya': '#10b981',
  'kenzo-danendra': '#8b5cf6',
  'damian-prasetya': '#f59e0b',
  raffa: '#fbbf24',
};

const KIND_ICON = {
  status: MessageSquare,
  ghibah: Sparkles,
  treat: Coffee,
  delegation: Users,
} as const;

const KIND_BG: Record<string, string> = {
  status: 'bg-white/[0.03]',
  ghibah: 'bg-violet-500/[0.04]',
  treat: 'bg-amber-500/[0.05]',
  delegation: 'bg-cyan-500/[0.04]',
};

export default function OfficeGroupChatModal({ isOpen, onClose, events, onSendUserMessage, onTreat, onDelegate }: OfficeChatModalProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sorted.length, isOpen]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    onSendUserMessage(t);
    setDraft('');
  };

  if (!isOpen) return null;

  const onlineCount = AGENTS.length + 1; // +1 for Boss

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 md:p-6 backdrop-blur-md"
      role="dialog"
      aria-label="Warung Kopi TechFlow"
    >
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0c0d12]/95 shadow-[0_30px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-amber-500/[0.04] px-6 sm:px-8 py-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <Hash size={19} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Warung Kopi TechFlow</h2>
              <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                {onlineCount} karyawan online
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Tutup chat"
          >
            <X size={18} />
          </button>
        </header>

        {/* Message Feed */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-6 sm:px-8 py-5 scrollbar-thin">
          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Coffee size={28} className="text-zinc-500" />
              </div>
              <p className="text-sm font-medium text-zinc-400">Belum ada aktivitas kantor.</p>
              <p className="mt-1 text-xs text-zinc-500">Traktir kopi atau kirim pesan untuk memulai percakapan.</p>
            </div>
          )}
          {sorted.map((ev) => {
            const Icon = KIND_ICON[ev.kind] ?? MessageSquare;
            const color = AGENT_COLORS[ev.actor] ?? '#94a3b8';
            const name = AGENT_NAMES[ev.actor] ?? ev.actor;
            const isBoss = ev.actor === 'raffa';
            const isTreat = ev.kind === 'treat';

            return (
              <div
                key={ev.id}
                className={`group rounded-2xl border border-white/[0.06] px-4.5 py-3.5 transition-all hover:border-white/[0.12] ${KIND_BG[ev.kind] ?? 'bg-white/[0.02]'} ${isTreat ? 'border-amber-500/25' : ''}`}
              >
                <div className="mb-1.5 flex items-center gap-2.5">
                  {/* Avatar circle */}
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm"
                    style={{ background: color }}
                  >
                    {name.charAt(0)}
                  </div>
                  <span className="text-xs font-bold" style={{ color }}>
                    {name}
                  </span>
                  {isBoss && <span className="text-[10px]">👑</span>}
                  {isTreat && <span className="text-[10px]">🎉</span>}
                  <span className="ml-auto text-[10px] font-mono text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(ev.at).toLocaleTimeString('id-ID', { hour12: false })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-zinc-200 pl-8.5">{ev.text}</p>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={submit} className="flex items-center gap-3.5 border-t border-white/[0.08] bg-white/[0.015] px-6 sm:px-8 py-4.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tulis sesuatu di warung kopi…"
            className="flex-1 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4.5 py-3 text-xs md:text-sm text-slate-200 placeholder:text-zinc-500 focus:border-emerald-400/50 focus:bg-white/[0.06] focus:outline-none transition-colors"
            aria-label="Pesan"
          />
          <button
            type="button"
            onClick={onTreat}
            title="Traktir kopi sekantor"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:border-amber-400/40 transition-all hover:shadow-[0_0_12px_rgba(251,191,36,0.15)] shrink-0"
            aria-label="Traktir kopi"
          >
            <Coffee size={18} />
          </button>
          <button
            type="button"
            onClick={onDelegate}
            title="Delegasi tugas lewat Khansaku"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20 hover:border-violet-400/40 transition-all hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] shrink-0"
            aria-label="Delegasi"
          >
            <Users size={18} />
          </button>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_16px_rgba(52,211,153,0.25)] shrink-0 font-bold"
            aria-label="Kirim"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}