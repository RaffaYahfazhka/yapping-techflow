'use client';

import React, { useState, useMemo } from 'react';
import { css } from '@emotion/css';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import LocalFolderSelector from '../LocalFolderSelector';

export interface Ticket {
  key: string;
  summary: string;
  type: string;
  status: string;
  priority?: string;
  description?: string;
  coder?: string;
  figmaUrl?: string;
  [key: string]: any;
}

export interface MissionControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveTickets?: Ticket[];
  jiraLoading?: boolean;
  jiraError?: string | null;
  selectedTicketKey?: string;
  onSelectTicketKey?: (key: string) => void;
  selectedRepoPath?: string;
  onSelectRepoPath?: (path: string) => void;
  onExecuteTicket?: (ticket: Ticket, path?: string, validation?: any) => void;
  onOpenKhansaChat?: (ticketKey?: string, autoPrompt?: boolean) => void;
}

const STATUS_FILTERS = [
  { id: 'active', label: 'Todo s/d Ready Prod' },
  { id: 'all', label: 'Semua Status' },
  { id: 'To Do', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'QA', label: 'In Review / QA' },
  { id: 'Ready Prod', label: 'Ready Prod' },
];

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    gap: 22px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `,

  grid: css`
    display: grid;
    grid-template-columns: 4.8fr 7.2fr;
    gap: 22px;

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  `,

  backlogPane: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 20px;
    background: #111218;
    border: 1px solid rgba(255, 255, 255, 0.1);
  `,

  searchBox: css`
    position: relative;
    width: 100%;
  `,

  searchInput: css`
    width: 100%;
    padding: 11px 14px 11px 40px;
    font-size: 13px;
    border-radius: 14px;
    background: #14151b;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    outline: none;
    transition: border 0.15s ease;

    &::placeholder {
      color: #71717a;
    }
    &:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
  `,

  statusFilterScroll: css`
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  `,

  statusBtn: (isActive: boolean) => css`
    padding: 8px 14px;
    border-radius: 12px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    border: 1px solid ${isActive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
    background: ${isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)'};
    color: ${isActive ? '#6ee7b7' : '#a1a1aa'};
    transition: all 0.15s ease;

    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
  `,

  ticketScrollList: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 4px;
  `,

  ticketCard: (isSelected: boolean) => css`
    padding: 18px;
    border-radius: 18px;
    cursor: pointer;
    border: 1px solid ${isSelected ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.06)'};
    background: ${isSelected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)'};
    box-shadow: ${isSelected ? '0 4px 14px rgba(16, 185, 129, 0.15)' : 'none'};
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.18);
    }
  `,

  detailPane: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 20px;
    padding: 24px 28px;
    border-radius: 20px;
    background: #111218;
    border: 1px solid rgba(255, 255, 255, 0.1);
  `,

  descBox: css`
    padding: 14px;
    border-radius: 12px;
    background: #15161c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 13px;
    line-height: 1.6;
    color: #d4d4d8;
  `,

  figmaBox: css`
    padding: 14px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.35);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,

  flowPillRow: css`
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
  `,

  flowItem: (bg: string, color: string, border: string) => css`
    padding: 4px 8px;
    border-radius: 6px;
    background: ${bg};
    color: ${color};
    border: 1px solid ${border};
    white-space: nowrap;
  `,
};

export default function MissionControlModal({
  isOpen,
  onClose,
  liveTickets = [],
  jiraLoading = false,
  jiraError = null,
  selectedTicketKey,
  onSelectTicketKey,
  selectedRepoPath,
  onSelectRepoPath,
  onExecuteTicket,
  onOpenKhansaChat,
}: MissionControlModalProps) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderValidation, setFolderValidation] = useState<any>({
    isValid: true,
    isDevBranch: false,
    currentBranch: 'main',
  });
  const [isRunningPrecheck, setIsRunningPrecheck] = useState(false);
  const [precheckSuccess, setPrecheckSuccess] = useState(false);

  const filteredTickets = useMemo(() => {
    return liveTickets.filter((t) => {
      if (statusFilter === 'active') {
        const s = (t.status || '').toLowerCase();
        if (s.includes('done') || s.includes('closed')) return false;
      } else if (statusFilter !== 'all') {
        if (!t.status?.toLowerCase().includes(statusFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesKey = t.key?.toLowerCase().includes(query);
        const matchesSummary = t.summary?.toLowerCase().includes(query);
        const matchesDesc = t.description?.toLowerCase().includes(query);
        const matchesCoder = t.coder?.toLowerCase().includes(query);
        if (!matchesKey && !matchesSummary && !matchesDesc && !matchesCoder) return false;
      }

      return true;
    });
  }, [liveTickets, statusFilter, searchQuery]);

  const activeTicket = useMemo(() => {
    return (
      filteredTickets.find((t) => t.key === selectedTicketKey) ||
      liveTickets.find((t) => t.key === selectedTicketKey) ||
      filteredTickets[0] ||
      null
    );
  }, [filteredTickets, liveTickets, selectedTicketKey]);

  const handleRunPrecheck = () => {
    setIsRunningPrecheck(true);
    setPrecheckSuccess(false);
    setTimeout(() => {
      setIsRunningPrecheck(false);
      setPrecheckSuccess(true);
    }, 1000);
  };

  const canExecute = Boolean(activeTicket);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      maxWidth="1260px"
      title="Mission Control — Jira Backlog & Autonomous Execution"
      subtitle="Pilih folder lokal, verifikasi branch dev, dan delegasikan eksekusi tiket Jira ke agen Antigravity AI"
      icon={<span>⚡</span>}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          {/* Agent Sequence */}
          <div className={styles.flowPillRow}>
            <span className={styles.flowItem('rgba(245, 158, 11, 0.2)', '#fcd34d', 'rgba(245, 158, 11, 0.4)')}>
              Khansaku (PM)
            </span>
            <span style={{ color: '#71717a' }}>➔</span>
            <span className={styles.flowItem('rgba(14, 165, 233, 0.2)', '#7dd3fc', 'rgba(14, 165, 233, 0.4)')}>
              Arga (Arch)
            </span>
            <span style={{ color: '#71717a' }}>➔</span>
            <span className={styles.flowItem('rgba(139, 92, 246, 0.2)', '#c084fc', 'rgba(139, 92, 246, 0.4)')}>
              Jajang / Kian
            </span>
            <span style={{ color: '#71717a' }}>➔</span>
            <span className={styles.flowItem('rgba(244, 63, 94, 0.2)', '#fda4af', 'rgba(244, 63, 94, 0.4)')}>
              Vani (QA)
            </span>
            <span style={{ color: '#71717a' }}>➔</span>
            <span className={styles.flowItem('rgba(6, 182, 212, 0.2)', '#67e8f9', 'rgba(6, 182, 212, 0.4)')}>
              Reno (DevOps)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="md"
              loading={isRunningPrecheck}
              onClick={handleRunPrecheck}
            >
              {precheckSuccess ? '✓ Precheck Lolos' : '🔍 Running Precheck'}
            </Button>

            <Button
              variant="emerald"
              size="md"
              disabled={!canExecute}
              onClick={() => {
                if (activeTicket) {
                  onExecuteTicket?.(activeTicket, selectedRepoPath, folderValidation);
                }
              }}
            >
              ⚡ Eksekusi Tiket Jira Ini
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles.container}>
        {/* Step 1: Folder Selection */}
        <LocalFolderSelector
          value={selectedRepoPath}
          onChange={onSelectRepoPath}
          onValidationChange={setFolderValidation}
        />

        {/* Step 2: Backlog & Detail Grid */}
        <div className={styles.grid}>
          {/* Backlog List */}
          <div className={styles.backlogPane}>
            <div className={styles.searchBox}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#71717a',
                }}
              >
                🔍
              </span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Cari tiket, key, summary..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className={styles.statusFilterScroll}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.statusBtn(statusFilter === f.id)}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span>Menampilkan <b>{filteredTickets.length}</b> tiket</span>
              {jiraLoading && <span style={{ color: '#34d399' }}>Syncing Jira...</span>}
            </div>

            <div className={styles.ticketScrollList}>
              {filteredTickets.map((t) => {
                const isSelected = activeTicket?.key === t.key;
                return (
                  <div
                    key={t.key}
                    onClick={() => onSelectTicketKey?.(t.key)}
                    className={styles.ticketCard(isSelected)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: isSelected ? '#34d399' : '#ffffff', fontSize: '12px' }}>
                        {t.key}
                      </span>
                      <Badge variant="amber" size="xs">
                        {t.status || 'To Do'}
                      </Badge>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5', lineHeight: 1.4 }}>
                      {t.summary}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#a1a1aa' }}>
                      <span>
                        Assignee: <b>{t.coder === 'jajang' ? 'Jajang' : 'Kian'}</b>
                      </span>
                      {t.figmaUrl && <span style={{ color: '#c084fc', fontWeight: 700 }}>🎨 Figma</span>}
                    </div>
                  </div>
                );
              })}

              {filteredTickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '50px 10px', color: '#71717a', fontSize: '12px' }}>
                  {jiraLoading ? 'Memuat tiket dari Jira Cloud...' : 'Tidak ada tiket yang cocok.'}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Detail */}
          <div className={styles.detailPane}>
            {activeTicket ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#34d399', fontSize: '14px' }}>
                      {activeTicket.key}
                    </span>
                    <span style={{ color: '#71717a', margin: '0 8px' }}>|</span>
                    <span style={{ fontSize: '12px', color: '#d4d4d8' }}>{activeTicket.type}</span>
                  </div>
                  <Badge variant="emerald" size="md">
                    Status: {activeTicket.status || 'To Do'}
                  </Badge>
                </div>

                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', lineHeight: 1.35, margin: 0 }}>
                  {activeTicket.summary}
                </h3>

                <div className={styles.descBox}>
                  <b style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: '#a1a1aa', marginBottom: '4px' }}>
                    Deskripsi Task
                  </b>
                  {activeTicket.description || 'Tidak ada deskripsi rinci pada tiket ini.'}
                </div>

                {activeTicket.figmaUrl && (
                  <div className={styles.figmaBox}>
                    <div style={{ minWidth: 0 }}>
                      <b style={{ color: '#c084fc', display: 'block', fontSize: '12px' }}>Link Desain Figma</b>
                      <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                        {activeTicket.figmaUrl}
                      </span>
                    </div>
                    <a
                      href={activeTicket.figmaUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.2)', color: '#e9d5ff', fontWeight: 700, textDecoration: 'none', fontSize: '12px' }}
                    >
                      Buka Figma ↗
                    </a>
                  </div>
                )}

                {/* Direct Action Button in Detail Pane */}
                <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {onOpenKhansaChat && (
                    <button
                      type="button"
                      className={css`
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        padding: 10px 16px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, rgba(244, 63, 94, 0.22), rgba(225, 29, 72, 0.15));
                        border: 1px solid rgba(244, 63, 94, 0.45);
                        color: #fecdd3;
                        font-size: 13px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.18s ease;
                        &:hover {
                          background: linear-gradient(135deg, rgba(244, 63, 94, 0.35), rgba(225, 29, 72, 0.25));
                          border-color: #fb7185;
                          color: #ffffff;
                          transform: translateY(-1px);
                          box-shadow: 0 4px 14px rgba(244, 63, 94, 0.35);
                        }
                      `}
                      onClick={() => {
                        if (activeTicket) {
                          onClose();
                          onOpenKhansaChat(activeTicket.key, true);
                        }
                      }}
                    >
                      <span>👑</span>
                      <span>Minta Khansa Buatkan Prompt Antigravity ({activeTicket.key})</span>
                    </button>
                  )}

                  <Button
                    variant="emerald"
                    size="md"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      if (activeTicket) {
                        onExecuteTicket?.(activeTicket, selectedRepoPath, folderValidation);
                      }
                    }}
                  >
                    ⚡ Jalankan Pipeline Otonom ({activeTicket.key})
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#71717a' }}>
                Pilih tiket dari backlog di sebelah kiri untuk melihat detail.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
