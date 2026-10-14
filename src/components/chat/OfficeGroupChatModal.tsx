'use client';

/**
 * Office group chat ("Warung Kopi TechFlow") — renders the office event feed.
 * The feed lives in the page state; this modal is presentational + send box.
 * Uses Lucide icons and Tailwind only; no Emotion CSS, no plain authored selectors.
 */

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { MessageSquare, Send, Coffee, Sparkles, Users } from 'lucide-react';
import type { OfficeEvent } from '@/lib/engine/socialEngine';

export interface OfficeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: OfficeEvent[];
  onSendUserMessage: (text: string) => void;
  onTreat: () => void;
  onDelegate: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  tara: '#f472b6',
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

export default function OfficeGroupChatModal({ isOpen, onClose, events, onSendUserMessage, onTreat, onDelegate }: OfficeChatModalProps) {
  const [draft, setDraft] = useState('');
  const sorted = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    onSendUserMessage(t);
    setDraft('');
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-label="Warung Kopi TechFlow">
      <div className="flex h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <MessageSquare size={14} className="text-emerald-400" /> Warung Kopi TechFlow
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-white/10" aria-label="Tutup chat">
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {sorted.length === 0 && <p className="py-6 text-center text-xs text-slate-500">Belum ada aktivitas kantor.</p>}
          {sorted.map((ev) => {
            const Icon = KIND_ICON[ev.kind];
            const color = AGENT_COLORS[ev.actor] ?? '#94a3b8';
            return (
              <div key={ev.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <Icon size={11} style={{ color }} />
                  <span className="font-bold" style={{ color }}>
                    {ev.actor}
                  </span>
                  <span className="text-[9px] text-slate-500">{new Date(ev.at).toLocaleTimeString('id-ID', { hour12: false })}</span>
                </div>
                <p className="text-slate-300">{ev.text}</p>
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tulis sesuatu di warung kopi…"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
            aria-label="Pesan"
          />
          <button type="button" onClick={onTreat} title="Traktir kopi sekantor" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-2 text-amber-300 text-xs hover:bg-amber-400/20" aria-label="Traktir kopi">
            <Coffee size={13} />
          </button>
          <button type="button" onClick={onDelegate} title="Delegasi tugas lewat Khansaku" className="rounded-lg border border-violet-400/30 bg-violet-400/10 px-2 py-2 text-violet-300 text-xs hover:bg-violet-400/20" aria-label="Delegasi">
            <Users size={13} />
          </button>
          <button type="submit" className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-400" aria-label="Kirim">
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}