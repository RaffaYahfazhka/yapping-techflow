'use client';

/**
 * Office group chat ("Warung Kopi TechFlow") — renders authentic WhatsApp / Slack style office chatter.
 * Enhanced with Material Tailwind patterns:
 * - Real WhatsApp bubble alignment: Boss on the right, AI squad on the left.
 * - Live office persona badges (Frontend, Quant, DevOps, UI/UX, etc.)
 * - Timestamp and delivery checkmarks.
 * - Dynamic quick prompts and responsive input bar.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Coffee,
  Users,
  X,
  Zap,
  CheckCheck,
  PartyPopper,
  Sparkles,
} from 'lucide-react';
import type { OfficeEvent } from '@/lib/engine/socialEngine';
import { AGENTS } from '@/lib/data/agents';

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
  khansaku: 'Khansaku',
  arga: 'Arga',
  jajang: 'Jajang',
  kian: 'Kian',
  vani: 'Vani',
  reno: 'Reno',
  'altair-raditya': 'Altair',
  altair: 'Altair',
  'kenzo-danendra': 'Kenzo',
  kenzo: 'Kenzo',
  'damian-prasetya': 'Damian',
  damian: 'Damian',
  raffa: 'Bos Raffa',
};

const AGENT_ROLES: Record<string, string> = {
  raffa: 'Founder & CEO',
  tara: 'Chief of Staff',
  khansaku: 'Chief of Staff',
  jajang: 'Senior Frontend',
  damian: 'Lead Quant Trader',
  'damian-prasetya': 'Lead Quant Trader',
  altair: 'DevOps & Cloud',
  'altair-raditya': 'DevOps & Cloud',
  vani: 'Lead UI/UX',
  kian: 'Senior Backend',
  reno: 'QA & Security',
  arga: 'Software Architect',
  kenzo: 'Risk & Compliance',
  'kenzo-danendra': 'Risk & Compliance',
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
  altair: '#10b981',
  'kenzo-danendra': '#8b5cf6',
  kenzo: '#8b5cf6',
  'damian-prasetya': '#f59e0b',
  damian: '#f59e0b',
  raffa: '#fbbf24',
};

const QUICK_PROMPTS = [
  { label: '☕ Kopi Time', text: 'Break sejenak guys, kopi gratis dari bos! ☕' },
  { label: '🚀 Gas Deploy!', text: 'Gimana progress sprint hari ini? Ada blocker deploy?' },
  { label: '📈 Pantau Market', text: 'Gimana setup crypto hari ini Damian? Candle hijau kah?' },
  { label: '🎨 Cek UI Figma', text: 'Vani, tolong inspect komponen dan spacing layout ya!' },
  { label: '📊 Status Jira', text: 'Tolong update status ticket Jira masing-masing ya squad.' },
];

export default function OfficeGroupChatModal({
  isOpen,
  onClose,
  events,
  onSendUserMessage,
  onTreat,
  onDelegate,
}: OfficeChatModalProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sorted.length, isOpen]);

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    onSendUserMessage(t);
    setDraft('');
  };

  const handleQuickPrompt = (text: string) => {
    onSendUserMessage(text);
  };

  const onlineCount = AGENTS.length + 1; // +1 for Boss

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none"
          role="dialog"
          aria-label="Warung Kopi TechFlow"
          aria-modal="true"
        >
          {/* Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          {/* Ambient Lighting */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[320px] rounded-full bg-emerald-500/[0.06] blur-[120px]" />
          </div>

          {/* Modal Panel - WhatsApp SCBD Modern Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative flex h-[86vh] w-full max-w-2xl flex-col my-auto overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0c0d12]/[0.98] shadow-[0_32px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            {/* Header - WhatsApp Style */}
            <header className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-5 sm:px-6 py-4 shrink-0 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-48 opacity-15 pointer-events-none overflow-hidden">
                <img
                  src="/textures/props/pantry_espresso_bar.jpg"
                  alt="Pantry Espresso Bar"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d12] to-transparent" />
              </div>
              <div className="flex items-center gap-3.5 min-w-0 relative z-10">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)] shrink-0 overflow-hidden relative">
                  <img
                    src="/textures/props/pantry_espresso_bar.jpg"
                    alt="Pantry Espresso Bar"
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                  <Coffee size={20} className="text-amber-400 relative z-10 drop-shadow" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight truncate">
                      Warung Kopi TechFlow ☕
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                      WAG KANTOR
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5 truncate">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                    <span className="font-semibold text-zinc-300">{onlineCount} anggota online</span>
                    <span className="text-zinc-600">•</span>
                    <span className="truncate text-zinc-500">SCBD Penthouse Suite</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Tutup chat"
                >
                  <X size={18} strokeWidth={2.2} />
                </motion.button>
              </div>
            </header>

            {/* Message Feed - WhatsApp Bubble Styling */}
            <div className="flex-1 space-y-3.5 overflow-y-auto px-4 sm:px-6 py-4 scrollbar-thin">
              {sorted.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center my-auto">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
                    <Coffee size={28} className="text-zinc-500" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-300 mb-1">Belum ada obrolan di grup kantor.</p>
                  <p className="text-xs text-zinc-500 max-w-xs mt-1">
                    Kirim sapaan, traktir kopi Kenangan, atau klik tombol cepat di bawah untuk memulai obrolan!
                  </p>
                </div>
              )}

              {sorted.map((ev) => {
                const isBoss = ev.actor === 'raffa';
                const isTreat = ev.kind === 'treat';
                const name = AGENT_NAMES[ev.actor] ?? ev.actor;
                const role = AGENT_ROLES[ev.actor] ?? 'TechFlow Staff';
                const color = AGENT_COLORS[ev.actor] ?? '#94a3b8';
                const timeStr = new Date(ev.at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                // Treat Event: Festive centered banner
                if (isTreat) {
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-center my-3"
                    >
                      <div className="flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs font-semibold shadow-[0_0_24px_rgba(245,158,11,0.18)] max-w-md text-center">
                        <PartyPopper size={18} className="text-amber-400 shrink-0" />
                        <span className="leading-snug">{ev.text}</span>
                      </div>
                    </motion.div>
                  );
                }

                // Boss Message: Aligned Right (WhatsApp user bubble style)
                if (isBoss) {
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end my-1"
                    >
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-emerald-600/25 border border-emerald-500/40 px-4 py-2.5 shadow-[0_4px_16px_rgba(16,185,129,0.12)]">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[10px] font-bold text-amber-300">👑 Bos Raffa (Kamu)</span>
                          <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-300/80">
                            <span>{timeStr}</span>
                            <CheckCheck size={12} className="text-emerald-400" />
                          </div>
                        </div>
                        <p className="text-xs sm:text-[13px] leading-relaxed text-zinc-100 font-normal">
                          {ev.text}
                        </p>
                      </div>
                    </motion.div>
                  );
                }

                // AI Employee Message: Aligned Left (WhatsApp contact bubble style)
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 my-1.5 max-w-[90%] sm:max-w-[82%]"
                  >
                    <div
                      className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs text-white border border-white/20 shadow-md mt-0.5"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}99)`,
                        boxShadow: `0 0 12px ${color}33`,
                      }}
                    >
                      {name.charAt(0)}
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-xs bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 shadow-sm hover:border-white/15 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold tracking-tight truncate" style={{ color }}>
                            {name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-white/[0.06] text-zinc-400 border border-white/[0.06] truncate">
                            {role}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 shrink-0">{timeStr}</span>
                      </div>
                      <p className="text-xs sm:text-[13px] leading-relaxed text-zinc-200 font-normal">
                        {ev.text}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="px-5 sm:px-6 py-2.5 border-t border-white/[0.05] bg-black/40 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Zap size={12} className="text-amber-400" /> Cepat:
              </span>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPrompt(qp.text)}
                  className="px-3 py-1 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-emerald-500/15 hover:border-emerald-500/35 text-zinc-300 hover:text-emerald-300 border border-white/[0.08] transition-all whitespace-nowrap shrink-0 active:scale-95"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={submit}
              className="flex items-center gap-2 sm:gap-2.5 border-t border-white/[0.08] bg-white/[0.02] px-4 sm:px-6 py-3.5 shrink-0"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Tulis pesan ke grup kantor TechFlow…"
                className="flex-1 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/50 focus:bg-white/[0.06] focus:shadow-[0_0_16px_rgba(16,185,129,0.15)] focus:outline-none transition-all"
                aria-label="Pesan"
              />

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onTreat}
                title="Traktir kopi se-kantor (100% Buff)"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 hover:border-amber-400/50 transition-all hover:shadow-[0_0_16px_rgba(251,191,36,0.25)] shrink-0"
                aria-label="Traktir kopi"
              >
                <Coffee size={18} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onDelegate}
                title="Delegasi tugas lewat Khansaku"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20 hover:border-violet-400/50 transition-all hover:shadow-[0_0_16px_rgba(167,139,250,0.25)] shrink-0"
                aria-label="Delegasi"
              >
                <Users size={18} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!draft.trim()}
                className="flex h-10 px-4 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(16,185,129,0.3)] shrink-0"
                aria-label="Kirim"
              >
                <span>Kirim</span>
                <Send size={14} />
              </motion.button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}