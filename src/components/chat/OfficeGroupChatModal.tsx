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
      className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Warung Kopi TechFlow"
    >
      <div className="flex h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b0c11]/95 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-amber-500/[0.03] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
              <Hash size={14} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-white tracking-tight">Warung Kopi TechFlow</h2>
              <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                {onlineCount} karyawan online
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 transition-colors"
            aria-label="Tutup chat"
          >
            <X size={16} />
          </button>
        </header>

        {/* Message Feed */}
        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 scrollbar-thin">
          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Coffee size={24} className="text-zinc-600" />
              </div>
              <p className="text-xs font-medium text-zinc-500">Belum ada aktivitas kantor.</p>
              <p className="mt-1 text-[10px] text-zinc-600">Traktir kopi atau kirim pesan untuk memulai.</p>
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
                className={`group rounded-xl border border-white/[0.04] px-3.5 py-2.5 transition-colors hover:border-white/[0.08] ${KIND_BG[ev.kind] ?? 'bg-white/[0.02]'} ${isTreat ? 'border-amber-500/20' : ''}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  {/* Avatar circle */}
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {name.charAt(0)}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color }}>
                    {name}
                  </span>
                  {isBoss && <span className="text-[9px]">👑</span>}
                  {isTreat && <span className="text-[9px]">🎉</span>}
                  <span className="ml-auto text-[9px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(ev.at).toLocaleTimeString('id-ID', { hour12: false })}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-300 pl-7">{ev.text}</p>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/[0.08] bg-white/[0.01] px-4 py-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tulis sesuatu di warung kopi…"
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:bg-white/[0.04] focus:outline-none transition-colors"
            aria-label="Pesan"
          />
          <button
            type="button"
            onClick={onTreat}
            title="Traktir kopi sekantor"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:border-amber-400/40 transition-all hover:shadow-[0_0_12px_rgba(251,191,36,0.1)]"
            aria-label="Traktir kopi"
          >
            <Coffee size={14} />
          </button>
          <button
            type="button"
            onClick={onDelegate}
            title="Delegasi tugas lewat Khansaku"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20 hover:border-violet-400/40 transition-all hover:shadow-[0_0_12px_rgba(167,139,250,0.1)]"
            aria-label="Delegasi"
          >
            <Users size={14} />
          </button>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_16px_rgba(52,211,153,0.2)]"
            aria-label="Kirim"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}