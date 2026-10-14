'use client';

import React, { useRef, useEffect } from 'react';

export interface TerminalLogItem {
  time?: string;
  agent?: 'tara' | 'arga' | 'jajang' | 'kian' | 'vani' | 'reno' | 'sys' | string;
  level?: 'info' | 'warn' | 'error' | 'success';
  text?: string;
  message?: string;
  [key: string]: unknown;
}

export interface GitDiffItem {
  path: string;
  diff: string;
}

export interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs?: TerminalLogItem[];
  onClearLogs?: () => void;
  simSpeed?: number;
  onSpeedToggle?: () => void;
  termTab?: 'logs' | 'diff';
  setTermTab?: (tab: 'logs' | 'diff') => void;
  diffData?: GitDiffItem[];
  selectedDiffIndex?: number;
  setSelectedDiffIndex?: (index: number) => void;
}

const AGENT_COLORS: Record<string, string> = {
  tara: '#fbbf24',
  arga: '#38bdf8',
  jajang: '#c084fc',
  kian: '#34d399',
  vani: '#fb7185',
  reno: '#22d3ee',
  sys: '#94a3b8',
};

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-zinc-300',
  warn: 'text-amber-400',
  error: 'text-rose-400',
  success: 'text-emerald-400',
};

export default function TerminalDrawer({
  isOpen,
  onClose,
  logs = [],
  onClearLogs,
  simSpeed = 1,
  onSpeedToggle,
  termTab = 'logs',
  setTermTab,
  diffData = [],
  selectedDiffIndex = 0,
  setSelectedDiffIndex,
}: TerminalDrawerProps) {
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom on new output
  useEffect(() => {
    if (logScrollRef.current && termTab === 'logs') {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs, termTab]);

  return (
    <aside
      aria-label="Terminal Drawer"
      className={`fixed bottom-0 right-0 z-40 w-full max-w-2xl h-[380px] flex flex-col bg-[#09090b]/95 backdrop-blur-2xl border-t border-l border-r border-white/10 rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.6)] font-mono transition-transform duration-250 ease-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xs text-zinc-400">
            raffa@kantor:<span className="text-emerald-400 font-bold">~/mission</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSpeedToggle}
            title="Kecepatan Simulasi"
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ⚡ {simSpeed}×
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            title="Bersihkan Log"
            className="px-2 py-0.5 rounded text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            clear
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Terminal"
            className="px-1.5 py-0.5 rounded text-xs text-zinc-400 hover:text-white hover:bg-rose-500/20 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-black/20 border-b border-white/5 select-none text-xs">
        <button
          type="button"
          onClick={() => setTermTab?.('logs')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-colors ${
            termTab === 'logs' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="text-emerald-400">$</span> Output Logs ({logs.length})
        </button>

        <button
          type="button"
          onClick={() => setTermTab?.('diff')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-colors ${
            termTab === 'diff' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="text-amber-400">±</span> Git Diffs {diffData?.length ? `(${diffData.length})` : ''}
        </button>
      </div>

      {/* Tab 1: Live Terminal Log Streams */}
      {termTab === 'logs' ? (
        <div ref={logScrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs text-zinc-300">
          {logs.map((item, idx) => {
            const agentKey = (item.agent || 'sys').toLowerCase();
            const color = AGENT_COLORS[agentKey] || '#a1a1aa';
            const logMsg = item.text || item.message || JSON.stringify(item);
            const levelColor = LEVEL_COLORS[item.level || 'info'] || 'text-zinc-300';

            return (
              <div key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-zinc-600 select-none text-[11px] shrink-0">{item.time || '»'}</span>
                <span className="font-bold text-[11px] shrink-0" style={{ color }}>
                  [{item.agent?.toUpperCase() || 'SYS'}]
                </span>
                <span className={`break-words ${levelColor}`}>{logMsg}</span>
              </div>
            );
          })}

          {logs.length === 0 && (
            <div className="text-zinc-600 italic py-8 text-center text-xs">
              Terminal standby. Tidak ada log eksekusi saat ini. Jalankan task di Mission Control untuk melihat log live streaming.
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Git Diff View */
        <div className="flex-1 overflow-y-auto p-4">
          {diffData && diffData.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 border-b border-white/5">
                {diffData.map((f, i) => (
                  <button
                    key={f.path || i}
                    type="button"
                    onClick={() => setSelectedDiffIndex?.(i)}
                    className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                      selectedDiffIndex === i
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.path}
                  </button>
                ))}
              </div>

              <pre className="p-3 rounded-lg bg-black/60 border border-white/5 text-[11px] leading-relaxed text-zinc-300 overflow-x-auto whitespace-pre">
                {diffData[selectedDiffIndex]?.diff || 'Tidak ada konten diff.'}
              </pre>
            </div>
          ) : (
            <div className="text-zinc-600 italic py-8 text-center text-xs">
              Belum ada file diff dari repositori aktif.
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
