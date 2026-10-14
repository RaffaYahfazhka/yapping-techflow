'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { css } from '@emotion/css';
import { AGENTS } from '../lib/data/agents';
import { REPOS } from '../lib/data/repos';
import { TYPE_META, PRIORITY_META } from '../lib/data/tickets';
import LocalFolderSelector from './mission/LocalFolderSelector';

export interface Ticket {
  key: string;
  summary: string;
  type: string;
  status: string;
  priority?: string;
  points?: number;
  description?: string;
  figmaUrl?: string;
  jiraUrl?: string;
  ac?: string[];
  [key: string]: any;
}

export interface SubordinateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAgentId?: string;
  setActiveAgentId?: (id: string) => void;
  tickets?: Ticket[];
  activeTicket?: Ticket | null;
  setActiveTicketKey?: (key: string) => void;
  selectedRepoId?: string;
  setSelectedRepoId?: (id: string) => void;
  customRepoPath?: string;
  setCustomRepoPath?: (path: string) => void;
  figmaUrl?: string;
  setFigmaUrl?: (url: string) => void;
  figmaParseResult?: { ok: boolean; nodeId?: string; fileKey?: string };
  onRunFullPipeline?: () => void;
  onFocusAgentInScene?: (id: string) => void;
  onOpenKhansaChat?: (ticketKey?: string, autoPrompt?: boolean) => void;
}

// -------------------------------------------------------------
// Emotion CSS Styles - Precise, Modern, Ultra-Clear Outlines & Spacing
// -------------------------------------------------------------
const styles = {
  overlay: css`
    position: fixed;
    inset: 0;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(4, 5, 8, 0.75);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  `,

  dialogContainer: css`
    position: relative;
    width: 100%;
    max-width: 1140px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    background: #0d0e12;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 24px;
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `,

  modalHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    background: #121318;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    gap: 16px;
  `,

  agentHero: css`
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  `,

  agentAvatarBox: (borderColor: string) => css`
    width: 52px;
    height: 52px;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid ${borderColor};
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  agentInfoCol: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  `,

  agentTitleLine: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,

  agentFullName: css`
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  `,

  agentRoleTag: (color: string) => css`
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border-radius: 6px;
    background: ${color}20;
    color: ${color};
    border: 1px solid ${color}45;
  `,

  agentIdCode: css`
    font-size: 12px;
    color: #a1a1aa;
    font-family: ui-monospace, monospace;
  `,

  agentDutiesNote: css`
    font-size: 12px;
    color: #d4d4d8;
    line-height: 1.4;
  `,

  headerRightActions: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  `,

  pipelineTriggerBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 12px;
    background: rgba(16, 185, 129, 0.16);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(16, 185, 129, 0.28);
      border-color: #34d399;
      transform: translateY(-1px);
    }
  `,

  closeModalBtn: css`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #a1a1aa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
  `,

  // Subordinate Selector Tabs
  tabNavRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #0f1015;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
    flex-shrink: 0;
  `,

  tabLabel: css`
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    color: #71717a;
    letter-spacing: 0.08em;
    margin-right: 6px;
    flex-shrink: 0;
  `,

  tabPill: (isActive: boolean, activeColor: string) => css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: ${isActive ? 700 : 500};
    color: ${isActive ? '#ffffff' : '#a1a1aa'};
    background: ${isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent'};
    border: 1px solid ${isActive ? activeColor : 'transparent'};
    box-shadow: ${isActive ? `0 2px 10px ${activeColor}25` : 'none'};
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
    }
  `,

  tabThumbImg: (borderColor: string) => css`
    width: 22px;
    height: 22px;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid ${borderColor};
    flex-shrink: 0;
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  // Body Workspace
  scrollBody: css`
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,

  roleBanner: (bgColor: string, borderColor: string, textColor: string) => css`
    padding: 14px 18px;
    border-radius: 16px;
    background: ${bgColor};
    border: 1px solid ${borderColor};
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    color: ${textColor};
    line-height: 1.5;
  `,

  searchFilterRow: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  `,

  searchInputWrap: css`
    position: relative;
    flex: 1;
    min-width: 240px;
  `,

  searchInput: css`
    width: 100%;
    padding: 10px 14px 10px 38px;
    font-size: 13px;
    border-radius: 12px;
    background: #14151b;
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #ffffff;
    outline: none;
    transition: border 0.15s ease;

    &::placeholder {
      color: #71717a;
    }

    &:focus {
      border-color: #f59e0b;
      box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
    }
  `,

  statusFiltersWrap: css`
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
  `,

  statusFilterBtn: (isSelected: boolean) => css`
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    border: 1px solid ${isSelected ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
    background: ${isSelected ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.04)'};
    color: ${isSelected ? '#fcd34d' : '#a1a1aa'};

    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
  `,

  ticketGrid: css`
    display: grid;
    grid-template-columns: 4.5fr 7.5fr;
    gap: 20px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ticketListPane: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #111217;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 14px;
    max-height: 480px;
    overflow-y: auto;
  `,

  ticketItemCard: (isSelected: boolean) => css`
    padding: 14px;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid ${isSelected ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255, 255, 255, 0.06)'};
    background: ${isSelected ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.02)'};
    box-shadow: ${isSelected ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none'};

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.18);
    }
  `,

  ticketDetailPane: css`
    background: #111217;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
  `,

  descBox: css`
    padding: 14px;
    border-radius: 12px;
    background: #15161c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 13px;
    color: #d4d4d8;
    line-height: 1.6;
    max-height: 140px;
    overflow-y: auto;
  `,

  acBox: css`
    padding: 14px;
    border-radius: 12px;
    background: #15161c;
    border: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,

  acItemRow: css`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 12px;
    color: #e4e4e7;
    cursor: pointer;
    user-select: none;
    line-height: 1.5;
  `,

  figmaAttachedBox: css`
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.35);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  `,

  nextStageBtn: (fromColor: string, toColor: string) => css`
    width: 100%;
    padding: 14px 20px;
    border-radius: 14px;
    background: linear-gradient(135deg, ${fromColor}, ${toColor});
    color: #000000;
    font-size: 13px;
    font-weight: 800;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    transition: all 0.18s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      filter: brightness(1.08);
    }
  `,

  codePanel: css`
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #090a0d;
  `,

  codePanelHeader: css`
    padding: 10px 16px;
    background: #14151c;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #a1a1aa;
  `,

  codePreBlock: css`
    padding: 16px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    color: #e4e4e7;
    line-height: 1.6;
    overflow-x: auto;
    max-height: 200px;
    margin: 0;
  `,
};

export default function SubordinateModal({
  isOpen,
  onClose,
  activeAgentId = 'tara',
  setActiveAgentId,
  tickets = [],
  activeTicket = null,
  setActiveTicketKey,
  selectedRepoId,
  setSelectedRepoId,
  customRepoPath = '',
  setCustomRepoPath,
  figmaUrl = '',
  setFigmaUrl,
  figmaParseResult,
  onRunFullPipeline,
  onFocusAgentInScene,
  onOpenKhansaChat,
}: SubordinateModalProps) {
  const [mounted, setMounted] = useState(false);

  // Tara: Search & Status Filters
  const [taraSearch, setTaraSearch] = useState('');
  const [taraStatusFilter, setTaraStatusFilter] = useState('active');

  // Arga: Architecture Blueprint State
  const [blueprintSaved, setBlueprintSaved] = useState(false);

  // Jajang: Slicing State (Manual vs Otomatis dari Tiket Jira)
  const [jajangMode, setJajangMode] = useState<'jira' | 'manual'>('jira');
  const [manualFigmaUrl, setManualFigmaUrl] = useState('');
  const [slicingDone, setSlicingDone] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Kian: API Integration State (Backend input: Screenshot, cURL, or Explanation)
  const [kianInputType, setKianInputType] = useState<'curl' | 'screenshot' | 'spec'>('curl');
  const [kianCurlText, setKianCurlText] = useState(
    `curl -X GET "https://api.etb.co.id/v1/permissions?role=admin" \\\n  -H "Authorization: Bearer dev-token-raffa" \\\n  -H "Content-Type: application/json"`
  );
  const [kianScreenshotUrl, setKianScreenshotUrl] = useState('');
  const [kianSpecText, setKianSpecText] = useState(
    `Endpoint GET /v1/permissions mengembalikan daftar permissions dengan id, name, role, dan allowedActions. Butuh validasi status code 200 dan 401 Unauthorized.`
  );
  const [mockTested, setMockTested] = useState(false);
  const [integratedSchemaDone, setIntegratedSchemaDone] = useState(false);

  // Vani: QA Regression State
  const [precisionScore, setPrecisionScore] = useState(99.8);

  // Reno: Git Flow & Remote Integration State
  const [baseBranch, setBaseBranch] = useState('main');
  const [targetBranch, setTargetBranch] = useState('dev');
  const [customFeatureName, setCustomFeatureName] = useState('');
  const [detectedRemoteUrl, setDetectedRemoteUrl] = useState<string | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<string>('Git Remote');
  const [remoteEditUrl, setRemoteEditUrl] = useState('');
  const [isDetectingRemote, setIsDetectingRemote] = useState(false);
  const [isExecutingGitFlow, setIsExecutingGitFlow] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
    logs?: string[];
  } | null>(null);
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);
  const [mrCreated, setMrCreated] = useState(false);

  // Auto-detect git remote url for current workspace
  useEffect(() => {
    async function detectGitRemote() {
      setIsDetectingRemote(true);
      try {
        const pathQuery = customRepoPath ? `?path=${encodeURIComponent(customRepoPath)}` : '';
        const res = await fetch(`/api/repo/local-inspect${pathQuery}`);
        if (res.ok) {
          const data = await res.json();
          if (data.remoteWebUrl || data.remoteUrl) {
            const url = data.remoteWebUrl || data.remoteUrl;
            setDetectedRemoteUrl(url);
            setRemoteEditUrl(url);
            setDetectedProvider(data.remoteProvider || 'GitHub');
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setIsDetectingRemote(false);
      }
    }
    if (activeAgentId === 'reno' || isOpen) {
      detectGitRemote();
    }
  }, [activeAgentId, customRepoPath, isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const engineeringAgents = AGENTS.filter((a) => a.workspace !== 'trading');
  const currentAgent = engineeringAgents.find((a) => a.id === activeAgentId) || engineeringAgents[0];

  // Derive feature branch & matching release branch
  const featureBranchName = customFeatureName.trim()
    ? customFeatureName.trim()
    : `feat/${(activeTicket?.key || 'FEAT-101').toLowerCase()}`;
  const releaseBranchName = featureBranchName.startsWith('feat/')
    ? featureBranchName.replace(/^feat\//, 'rc/')
    : `rc/${featureBranchName}`;

  // Filtered tickets logic
  const filteredTickets = tickets.filter((t) => {
    if (taraStatusFilter === 'active') {
      const activeStatuses = ['To Do', 'In Progress', 'In Review', 'QA', 'Ready Prod'];
      if (!activeStatuses.includes(t.status)) return false;
    } else if (taraStatusFilter !== 'all' && t.status !== taraStatusFilter) {
      return false;
    }
    if (taraSearch.trim()) {
      const q = taraSearch.toLowerCase();
      return (
        t.key.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const gitFlowCommand = `cd "${customRepoPath || '.'}"
git checkout ${baseBranch} && git pull origin ${baseBranch}
git checkout -b ${featureBranchName}
git add . && git commit -m "feat(${activeTicket?.key || 'UI'}): implement autonomous feature"
git checkout -b ${releaseBranchName}
git merge ${featureBranchName}
git checkout ${targetBranch} && git merge ${releaseBranchName}
git push origin ${featureBranchName} ${releaseBranchName} ${targetBranch}`;

  const handleCopyGitCommand = () => {
    navigator.clipboard.writeText(gitFlowCommand);
    setCopiedGitCmd(true);
    setTimeout(() => setCopiedGitCmd(false), 2000);
  };

  const handleConnectRemote = async () => {
    if (!remoteEditUrl.trim()) return;
    try {
      const res = await fetch('/api/repo/local-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: customRepoPath,
          action: 'set_remote',
          remoteUrl: remoteEditUrl.trim(),
        }),
      });
      const data = await res.json();
      if (data.remoteWebUrl || data.remoteUrl) {
        setDetectedRemoteUrl(data.remoteWebUrl || data.remoteUrl);
        setDetectedProvider(data.remoteProvider || 'GitHub');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteDirectGitFlow = async () => {
    setIsExecutingGitFlow(true);
    setExecutionResult(null);
    try {
      const res = await fetch('/api/repo/local-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: customRepoPath,
          action: 'execute_git_flow',
          baseBranch,
          featureBranch: featureBranchName,
          releaseBranch: releaseBranchName,
          targetBranch,
          commitMessage: `feat(${activeTicket?.key || 'TECH-777'}): autonomous git flow pipeline execution`,
          pushToRemote: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExecutionResult({
          success: true,
          message: data.message || 'Git Flow berhasil dieksekusi langsung!',
          logs: data.logs || [],
        });
        setMrCreated(true);
      } else {
        setExecutionResult({
          success: false,
          message: data.error || 'Gagal mengeksekusi Git Flow',
          logs: data.logs || [],
        });
      }
    } catch (err: any) {
      setExecutionResult({
        success: false,
        message: err.message || 'Terjadi kesalahan sistem',
      });
    } finally {
      setIsExecutingGitFlow(false);
    }
  };

  const handleCopyTailwindCode = () => {
    const code = `// ${activeTicket?.key || 'FEAT-101'}: Sliced Component by Jajang
import { css } from '@emotion/css';

const styles = {
  container: css\`
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 16px;
    background: #111217;
    border: 1px solid rgba(255, 255, 255, 0.1);
  \`,
};

export default function TicketFeatureComponent() {
  return (
    <div className={styles.container}>
      <h2>${activeTicket?.summary || 'Interactive Feature'}</h2>
    </div>
  );
}`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialogContainer} onClick={(e) => e.stopPropagation()}>
        {/* ===================== MODAL HEADER ===================== */}
        <div className={styles.modalHeader}>
          <div className={styles.agentHero}>
            <div className={styles.agentAvatarBox(currentAgent.color || '#f59e0b')}>
              <img
                src={currentAgent.avatar || `/agents/${currentAgent.id}.jpg`}
                alt={currentAgent.fullName || currentAgent.name}
              />
            </div>
            <div className={styles.agentInfoCol}>
              <div className={styles.agentTitleLine}>
                <span className={styles.agentFullName}>
                  {currentAgent.fullName || currentAgent.name}
                </span>
                <span className={styles.agentRoleTag(currentAgent.color || '#f59e0b')}>
                  {currentAgent.role}
                </span>
                <span className={styles.agentIdCode}>[{currentAgent.employeeId || 'EMP-001'}]</span>
              </div>
              <div className={styles.agentDutiesNote}>{currentAgent.duties}</div>
            </div>
          </div>

          <div className={styles.headerRightActions}>
            <button
              type="button"
              className={styles.pipelineTriggerBtn}
              onClick={() => {
                onClose();
                onRunFullPipeline?.();
              }}
              title="Jalankan pipeline otomatis dari Tara sampai Reno"
            >
              <span>⚡ Jalankan Full Pipeline</span>
            </button>
            <button
              type="button"
              className={styles.closeModalBtn}
              onClick={onClose}
              aria-label="Tutup Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ===================== SUBORDINATE TABS BAR ===================== */}
        <div className={styles.tabNavRow}>
          <span className={styles.tabLabel}>Karyawan:</span>
          {engineeringAgents.map((agent) => {
            const isActive = activeAgentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                className={styles.tabPill(isActive, agent.color || '#f59e0b')}
                onClick={() => {
                  setActiveAgentId?.(agent.id);
                  onFocusAgentInScene?.(agent.id);
                }}
              >
                <div className={styles.tabThumbImg(agent.color || '#f59e0b')}>
                  <img
                    src={agent.avatar || `/agents/${agent.id}.jpg`}
                    alt={agent.name}
                  />
                </div>
                <span>{agent.name}</span>
                <span style={{ fontSize: '11px', color: '#71717a' }}>({agent.short})</span>
              </button>
            );
          })}
        </div>

        {/* ===================== AGENT WORKSPACE BODY ===================== */}
        <div className={styles.scrollBody}>
          {/* 1. TARA: Jira Triage & Acceptance Criteria */}
          {activeAgentId === 'tara' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(244, 63, 94, 0.14)',
                  'rgba(244, 63, 94, 0.35)',
                  '#fda4af'
                )}
              >
                <span style={{ fontSize: '26px' }}>👑</span>
                <div>
                  <b style={{ color: '#fb7185', fontSize: '14px', display: 'block', letterSpacing: '0.02em' }}>
                    Khansaku — Corporate Secretary &amp; Permaisuri Bos Raffa
                  </b>
                  Permaisuri cantik andalan Bos Raffa. Satu-satunya perantara komando tertinggi: menerima arahan sprint dari Bos Raffa, memimpin briefing delegasi ke para bawahan (Arga, Jajang, Kian, Vani, Reno), dan memastikan seluruh hasil teruji sempurna sebelum dilaporkan kembali ke meja Bos Raffa.
                </div>
              </div>

              {/* Search & Status Filters */}
              <div className={styles.searchFilterRow}>
                <div className={styles.searchInputWrap}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }}>
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Cari tiket Jira (Key / Summary)..."
                    className={styles.searchInput}
                    value={taraSearch}
                    onChange={(e) => setTaraSearch(e.target.value)}
                  />
                </div>

                <div className={styles.statusFiltersWrap}>
                  {['active', 'To Do', 'In Progress', 'Ready Prod', 'all'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={styles.statusFilterBtn(taraStatusFilter === st)}
                      onClick={() => setTaraStatusFilter(st)}
                    >
                      {st === 'active' ? '⚡ To Do ➔ Ready Prod' : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tickets Grid */}
              <div className={styles.ticketGrid}>
                {/* Left: Ticket List */}
                <div className={styles.ticketListPane}>
                  <div style={{ fontSize: '12px', color: '#a1a1aa', padding: '0 4px 6px' }}>
                    Menampilkan <b>{filteredTickets.length}</b> tiket Jira
                  </div>

                  {filteredTickets.map((t) => {
                    const isSelected = activeTicket?.key === t.key;
                    const typeMeta = TYPE_META[t.type] || { icon: '•', color: '#f59e0b' };
                    return (
                      <div
                        key={t.key}
                        onClick={() => setActiveTicketKey?.(t.key)}
                        className={styles.ticketItemCard(isSelected)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#fbbf24', fontSize: '12px' }}>
                            {t.key}
                          </span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: '#1c1d24', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {t.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', lineHeight: 1.4 }}>
                          {t.summary}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#a1a1aa' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: typeMeta.color }}>{typeMeta.icon}</span> {t.type}
                          </span>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                            {t.points || 3} SP
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {filteredTickets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#71717a', fontSize: '12px' }}>
                      Tidak ada tiket yang cocok dengan filter pencarian.
                    </div>
                  )}
                </div>

                {/* Right: Active Ticket Detail */}
                <div className={styles.ticketDetailPane}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'ui-monospace, monospace' }}>
                        Tiket Terpilih ({activeTicket?.key || 'None'})
                      </span>
                      <a
                        href={
                          activeTicket?.jiraUrl ||
                          `https://etbteam.atlassian.net/browse/${activeTicket?.key || 'TECH-101'}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.35)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Buka di Jira ↗
                      </a>
                    </div>

                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', lineHeight: 1.35, margin: 0 }}>
                      {activeTicket?.summary || 'Pilih tiket dari daftar di sebelah kiri'}
                    </h3>

                    <div className={styles.descBox}>
                      <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#a1a1aa', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: '4px' }}>
                        Deskripsi Tiket:
                      </span>
                      {activeTicket?.description || 'Deskripsi detail tiket yang ditarik langsung dari Jira Cloud.'}
                    </div>

                    <div className={styles.acBox}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#e4e4e7', display: 'block' }}>
                        Acceptance Criteria (INVEST Gate):
                      </span>
                      {(
                        activeTicket?.ac || [
                          'Komponen responsif di desktop & mobile',
                          'Menerapkan styling outline Emotion CSS & bebas CSS collision',
                          'Validasi input & handling error state',
                          'Unit test Vitest minimum 80% coverage',
                        ]
                      ).map((ac, idx) => (
                        <label key={idx} className={styles.acItemRow}>
                          <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b', marginTop: '2px' }} />
                          <span>{ac}</span>
                        </label>
                      ))}
                    </div>

                    {activeTicket?.figmaUrl && (
                      <div className={styles.figmaAttachedBox}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <span style={{ fontSize: '18px' }}>🎨</span>
                          <div style={{ minWidth: 0 }}>
                            <b style={{ color: '#c084fc', display: 'block' }}>Desain Figma Terlampir</b>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'ui-monospace, monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>
                              {activeTicket.figmaUrl}
                            </span>
                          </div>
                        </div>
                        <a
                          href={activeTicket.figmaUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.2)', color: '#e9d5ff', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                        >
                          Buka ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {onOpenKhansaChat && (
                    <button
                      type="button"
                      className={css`
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        padding: 11px 16px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, rgba(244, 63, 94, 0.22), rgba(225, 29, 72, 0.15));
                        border: 1px solid rgba(244, 63, 94, 0.45);
                        color: #fecdd3;
                        font-size: 13px;
                        font-weight: 700;
                        cursor: pointer;
                        margin-top: 10px;
                        margin-bottom: 8px;
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
                        onClose();
                        onOpenKhansaChat(activeTicket?.key, true);
                      }}
                    >
                      <span>👑</span>
                      <span>Ngobrol dengan Khansa &amp; Dapatkan Prompt Antigravity ({activeTicket?.key || 'Tiket Ini'})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.nextStageBtn('#f59e0b', '#fbbf24')}
                    onClick={() => {
                      setActiveAgentId?.('arga');
                      onFocusAgentInScene?.('arga');
                    }}
                  >
                    <span>Lanjut ke Arga: Pilih Folder & Desain Arsitektur ➔</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 2. ARGA: Folder Selection & Architecture Blueprint */}
          {activeAgentId === 'arga' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(56, 189, 248, 0.1)',
                  'rgba(56, 189, 248, 0.25)',
                  '#7dd3fc'
                )}
              >
                <span style={{ fontSize: '24px' }}>📐</span>
                <div>
                  <b style={{ color: '#38bdf8', fontSize: '13px', display: 'block' }}>
                    Arga — Lead Architect
                  </b>
                  Arga membantu Raffa memilih folder repositori target eksekusi di komputer lokal, memindai dependensi, dan merancang kontrak arsitektur modul sebelum slicing.
                </div>
              </div>

              <div className={styles.ticketDetailPane}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', fontFamily: 'ui-monospace, monospace' }}>
                    1. TARGET FOLDER REPOSITORI LOKAL
                  </span>
                  <span style={{ fontSize: '11px', color: '#34d399', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>
                    ✓ Next.js 16 + Emotion CSS
                  </span>
                </div>

                <LocalFolderSelector
                  value={customRepoPath}
                  onChange={(p) => setCustomRepoPath?.(p)}
                />

                <button
                  type="button"
                  className={styles.nextStageBtn('#0284c7', '#38bdf8')}
                  onClick={() => {
                    setBlueprintSaved(true);
                    setActiveAgentId?.('jajang');
                    onFocusAgentInScene?.('jajang');
                  }}
                >
                  <span>Setujui Blueprint & Delegasikan ke Jajang (Slicing) ➔</span>
                </button>
              </div>
            </>
          )}

          {/* 3. JAJANG: Slicing UI (Manual vs Otomatis dari Jira) */}
          {activeAgentId === 'jajang' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(192, 132, 252, 0.1)',
                  'rgba(192, 132, 252, 0.25)',
                  '#e9d5ff'
                )}
              >
                <span style={{ fontSize: '24px' }}>🎨</span>
                <div>
                  <b style={{ color: '#c084fc', fontSize: '13px', display: 'block' }}>
                    Jajang — Senior Frontend Dev (Slicing Specialist)
                  </b>
                  Jajang bertugas slicing UI ke komponen React TSX + Emotion CSS. Kamu bisa memilih: slicing otomatis dari tiket Jira yang dieksekusi, atau slicing manual dari link Figma yang kamu berikan.
                </div>
              </div>

              <div className={styles.ticketDetailPane}>
                {/* Jajang Slicing Mode Selector */}
                <div style={{ display: 'flex', gap: '8px', padding: '4px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: jajangMode === 'jira' ? 'rgba(192, 132, 252, 0.25)' : 'transparent',
                      color: jajangMode === 'jira' ? '#ffffff' : '#a1a1aa',
                      boxShadow: jajangMode === 'jira' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                    }}
                    onClick={() => setJajangMode('jira')}
                  >
                    ⚡ Sesuai Tiket Jira yang Dieksekusi (Otomatis)
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: jajangMode === 'manual' ? 'rgba(192, 132, 252, 0.25)' : 'transparent',
                      color: jajangMode === 'manual' ? '#ffffff' : '#a1a1aa',
                      boxShadow: jajangMode === 'manual' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                    }}
                    onClick={() => setJajangMode('manual')}
                  >
                    🎨 Slicing dari Figma Sendiri (Manual)
                  </button>
                </div>

                {/* Mode 1: Sesuai Tiket Jira */}
                {jajangMode === 'jira' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', borderRadius: '14px', background: '#15161c', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Sumber Tiket Jira:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#fbbf24', fontSize: '13px' }}>
                        {activeTicket?.key || 'TECH-101'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                      {activeTicket?.summary || 'Pilih tiket di Mission Control'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#34d399', fontFamily: 'monospace' }}>
                      {activeTicket?.figmaUrl ? `✓ Figma Link: ${activeTicket.figmaUrl}` : '✓ Mode Auto-Layout dari Story INVEST Ticket Jira'}
                    </div>
                  </div>
                ) : (
                  /* Mode 2: Manual Figma Input */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#d4d4d8' }}>
                      Paste Link Desain Figma Kamu (Manual):
                    </label>
                    <input
                      type="text"
                      className={styles.searchInput}
                      style={{ paddingLeft: '14px', fontFamily: 'ui-monospace, monospace' }}
                      value={manualFigmaUrl || figmaUrl}
                      onChange={(e) => {
                        setManualFigmaUrl(e.target.value);
                        setFigmaUrl?.(e.target.value);
                      }}
                      placeholder="https://www.figma.com/design/.../?node-id=204-12"
                    />
                    <small style={{ color: '#c084fc', fontSize: '11px' }}>
                      Jajang akan mengekstrak token warna, typography, dan layout langsung dari link frame Figma ini.
                    </small>
                  </div>
                )}

                <div className={styles.codePanel}>
                  <div className={styles.codePanelHeader}>
                    <span>
                      Komponen Hasil Slicing: {jajangMode === 'jira' ? (activeTicket?.key || 'TECH-101') : 'ManualFigma'}.tsx (Emotion CSS)
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyTailwindCode}
                      style={{ background: 'transparent', border: 'none', color: '#c084fc', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {copiedCode ? '✓ Tersalin!' : '📋 Salin Kode'}
                    </button>
                  </div>
                  <pre className={styles.codePreBlock}>
{`import { css } from '@emotion/css';

const styles = {
  container: css\`
    max-width: 960px;
    padding: 24px;
    background: #111218;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  \`,
};

export default function ${activeTicket?.key?.replace('-', '') || 'Feature'}Component() {
  return (
    <div className={styles.container}>
      <h2>${activeTicket?.summary || 'Interactive Sliced Component'}</h2>
    </div>
  );
}`}
                  </pre>
                </div>

                <button
                  type="button"
                  className={styles.nextStageBtn('#9333ea', '#c084fc')}
                  onClick={() => {
                    setActiveAgentId?.('kian');
                    onFocusAgentInScene?.('kian');
                  }}
                >
                  <span>Lanjut ke Kian: Hubungkan Kontrak API & Integrasi Backend ➔</span>
                </button>
              </div>
            </>
          )}

          {/* 4. KIAN: API Integration (Screenshot, cURL, or Explanation) */}
          {activeAgentId === 'kian' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(52, 211, 153, 0.1)',
                  'rgba(52, 211, 153, 0.25)',
                  '#a7f3d0'
                )}
              >
                <span style={{ fontSize: '24px' }}>🗄️</span>
                <div>
                  <b style={{ color: '#34d399', fontSize: '13px', display: 'block' }}>
                    Kian Wardhana — Senior Backend Specialist & API Integration
                  </b>
                  Kian yang mengurus seluruh integrasi API untuk Raffa. Cukup berikan salah satu: <b>cURL request</b>, <b>Screenshot endpoint</b>, atau <b>Penjelasan teks API dari backend</b>. Kian akan membuat schema client dan mock response otomatis.
                </div>
              </div>

              <div className={styles.ticketDetailPane}>
                {/* 3 Input Tabs for Backend Integration */}
                <div style={{ display: 'flex', gap: '8px', padding: '4px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: kianInputType === 'curl' ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
                      color: kianInputType === 'curl' ? '#ffffff' : '#a1a1aa',
                    }}
                    onClick={() => setKianInputType('curl')}
                  >
                    💻 Beri cURL Command
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: kianInputType === 'screenshot' ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
                      color: kianInputType === 'screenshot' ? '#ffffff' : '#a1a1aa',
                    }}
                    onClick={() => setKianInputType('screenshot')}
                  >
                    🖼️ Upload / URL Screenshot API
                  </button>

                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'all 0.15s ease',
                      background: kianInputType === 'spec' ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
                      color: kianInputType === 'spec' ? '#ffffff' : '#a1a1aa',
                    }}
                    onClick={() => setKianInputType('spec')}
                  >
                    📝 Penjelasan Teks dari Backend
                  </button>
                </div>

                {/* Input Fields based on Selected Tab */}
                {kianInputType === 'curl' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#d4d4d8' }}>
                      Paste cURL dari Backend atau Postman:
                    </label>
                    <textarea
                      rows={3}
                      className={styles.searchInput}
                      style={{ paddingLeft: '14px', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical' }}
                      value={kianCurlText}
                      onChange={(e) => setKianCurlText(e.target.value)}
                    />
                  </div>
                )}

                {kianInputType === 'screenshot' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#d4d4d8' }}>
                      URL atau Path Gambar Screenshot Postman / Swagger / API Doc:
                    </label>
                    <input
                      type="text"
                      className={styles.searchInput}
                      style={{ paddingLeft: '14px' }}
                      value={kianScreenshotUrl}
                      onChange={(e) => setKianScreenshotUrl(e.target.value)}
                      placeholder="/screenshots/api-response.png atau https://..."
                    />
                    <small style={{ color: '#34d399', fontSize: '11px' }}>
                      Kian akan membaca response payload dan header langsung dari gambar screenshot.
                    </small>
                  </div>
                )}

                {kianInputType === 'spec' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#d4d4d8' }}>
                      Tulis Penjelasan Endpoint dari Tim Backend:
                    </label>
                    <textarea
                      rows={3}
                      className={styles.searchInput}
                      style={{ paddingLeft: '14px', fontSize: '12px', resize: 'vertical' }}
                      value={kianSpecText}
                      onChange={(e) => setKianSpecText(e.target.value)}
                    />
                  </div>
                )}

                {/* Live Schema Generated by Kian */}
                <div className={styles.codePanel}>
                  <div className={styles.codePanelHeader}>
                    <span>Kian Generated Contract Schema (/api/v1/integration)</span>
                    <button
                      type="button"
                      onClick={() => setMockTested(true)}
                      style={{ background: 'transparent', border: 'none', color: '#34d399', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {mockTested ? '✓ Tested (200 OK)' : '▶ Test Endpoint'}
                    </button>
                  </div>
                  <pre className={styles.codePreBlock}>
{`{
  "endpoint": "/api/v1/integration/${activeTicket?.key || 'TECH-101'}",
  "method": "GET",
  "status": 200,
  "data": {
    "ticketKey": "${activeTicket?.key || 'TECH-101'}",
    "inputType": "${kianInputType}",
    "authorized": true,
    "payload": {
      "id": 1,
      "name": "Admin Permissions",
      "roles": ["admin", "superadmin"],
      "updatedAt": "${new Date().toISOString()}"
    }
  }
}`}
                  </pre>
                </div>

                <button
                  type="button"
                  className={styles.nextStageBtn('#059669', '#34d399')}
                  onClick={() => {
                    setActiveAgentId?.('vani');
                    onFocusAgentInScene?.('vani');
                  }}
                >
                  <span>Kirim ke Vani: Uji Pixel Precision & QA Regression ➔</span>
                </button>
              </div>
            </>
          )}

          {/* 5. VANI: QA Pixel Precision Gate */}
          {activeAgentId === 'vani' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(251, 113, 133, 0.1)',
                  'rgba(251, 113, 133, 0.25)',
                  '#fecdd3'
                )}
              >
                <span style={{ fontSize: '24px' }}>🔍</span>
                <div>
                  <b style={{ color: '#fb7185', fontSize: '13px', display: 'block' }}>
                    Vani — QA Sentinel & Guardian
                  </b>
                  Vani memverifikasi presisi UI, memeriksa linting, dan menjalankan unit test Vitest untuk memastikan kode 100% siap dirilis.
                </div>
              </div>

              <div className={styles.ticketDetailPane}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                      Pixel Precision Gate:
                    </span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#34d399', fontSize: '15px' }}>
                      {precisionScore}% (Passed)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: '#1c1d24', overflow: 'hidden' }}>
                    <div style={{ width: `${precisionScore}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {[
                    'Pixel-Diff Alignment (99.8%)',
                    'Zero ESLint / TS Warnings',
                    'Vitest Unit Tests Pass (4/4)',
                    'Responsive All Breakpoints',
                  ].map((chk, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: '#15161c',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ color: '#e4e4e7' }}>{chk}</span>
                      <span style={{ color: '#34d399', fontWeight: 800 }}>✓ Pass</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.nextStageBtn('#e11d48', '#fb7185')}
                  onClick={() => {
                    setActiveAgentId?.('reno');
                    onFocusAgentInScene?.('reno');
                  }}
                >
                  <span>Kirim ke Reno: Eksekusi Git Flow & Buat Merge Request ➔</span>
                </button>
              </div>
            </>
          )}

          {/* 6. RENO: Git Flow Automation */}
          {activeAgentId === 'reno' && (
            <>
              <div
                className={styles.roleBanner(
                  'rgba(34, 211, 238, 0.1)',
                  'rgba(34, 211, 238, 0.25)',
                  '#a5f3fc'
                )}
              >
                <span style={{ fontSize: '24px' }}>🦊</span>
                <div>
                  <b style={{ color: '#22d3ee', fontSize: '13px', display: 'block' }}>
                    Reno — DevOps Dispatcher
                  </b>
                  Reno mengeksekusi Git Flow terstruktur: checkout dari <b>main</b> ➔ buat <b>feat/</b> ➔ release candidate <b>rc/</b> ➔ merge ke branch <b>dev / development</b> ➔ generate Merge Request GitLab.
                </div>
              </div>

              <div className={styles.ticketDetailPane}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>1. Base Branch</span>
                    <select
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                      style={{ background: '#1b1c24', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 750, outline: 'none' }}
                    >
                      <option value="dev">dev</option>
                      <option value="development">development</option>
                      <option value="main">main</option>
                    </select>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>2. Feature Branch</span>
                    <input
                      type="text"
                      value={customFeatureName}
                      placeholder={`feat/${(activeTicket?.key || 'FEAT').toLowerCase()}`}
                      onChange={(e) => setCustomFeatureName(e.target.value)}
                      style={{ background: '#1b1c24', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 750, outline: 'none' }}
                    />
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>3. Release Branch (Otomatis)</span>
                    <b style={{ color: '#f59e0b', fontSize: '12.5px', wordBreak: 'break-all' }}>{releaseBranchName}</b>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '12px', background: '#15161c', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>4. Target Branch</span>
                    <select
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      style={{ background: '#1b1c24', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: 750, outline: 'none' }}
                    >
                      <option value="dev">dev</option>
                      <option value="development">development</option>
                      <option value="staging">staging</option>
                      <option value="main">main</option>
                    </select>
                  </div>
                </div>

                {/* Git Remote Integration Banner */}
                <div style={{ padding: '14px', borderRadius: '12px', background: '#13151c', border: '1px solid rgba(34, 211, 238, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#22d3ee', fontWeight: 700 }}>
                        🔗 Remote Git Repository
                      </span>
                      {detectedRemoteUrl ? (
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                          ✓ Terdeteksi ({detectedProvider})
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                          Belum Terhubung
                        </span>
                      )}
                    </div>
                    {isDetectingRemote && <span style={{ fontSize: '11px', color: '#71717a' }}>Mendeteksi remote…</span>}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={remoteEditUrl}
                      placeholder="https://github.com/RaffaYahfazhka/yapping-tech.git"
                      onChange={(e) => setRemoteEditUrl(e.target.value)}
                      style={{ flex: 1, minWidth: '240px', background: '#1c1e27', color: '#67e8f9', border: '1px solid rgba(34, 211, 238, 0.3)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={handleConnectRemote}
                      style={{ padding: '7px 14px', borderRadius: '8px', background: 'rgba(34, 211, 238, 0.15)', border: '1px solid #22d3ee', color: '#e0f2fe', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Hubungkan Remote
                    </button>
                  </div>

                  {detectedRemoteUrl && (
                    <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      Remote URL aktif:{' '}
                      <a href={detectedRemoteUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', fontFamily: 'monospace' }}>
                        {detectedRemoteUrl}
                      </a>
                    </div>
                  )}
                </div>

                <div className={styles.codePanel}>
                  <div className={styles.codePanelHeader}>
                    <span>Git Flow Terminal Command</span>
                    <button
                      type="button"
                      onClick={handleCopyGitCommand}
                      style={{ background: 'transparent', border: 'none', color: '#22d3ee', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {copiedGitCmd ? '✓ Tersalin!' : '📋 Salin Command'}
                    </button>
                  </div>
                  <pre className={styles.codePreBlock}>
                    {gitFlowCommand}
                  </pre>
                </div>

                {executionResult && (
                  <div style={{ padding: '12px 16px', borderRadius: '12px', background: executionResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${executionResult.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`, color: executionResult.success ? '#6ee7b7' : '#fca5a5', fontSize: '12px' }}>
                    <div style={{ fontWeight: 800, marginBottom: '6px' }}>{executionResult.message}</div>
                    {executionResult.logs && executionResult.logs.length > 0 && (
                      <pre style={{ margin: 0, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', maxHeight: '120px', overflowY: 'auto' }}>
                        {executionResult.logs.join('\n')}
                      </pre>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={isExecutingGitFlow}
                    className={styles.nextStageBtn('#0891b2', '#22d3ee')}
                    style={{ flex: 1, minWidth: '220px', opacity: isExecutingGitFlow ? 0.7 : 1 }}
                    onClick={handleExecuteDirectGitFlow}
                  >
                    <span>{isExecutingGitFlow ? '⏳ Menjalankan Git Flow & Push…' : '🦊 Eksekusi Langsung Git Flow & Push ke Remote'}</span>
                  </button>

                  {detectedRemoteUrl && (
                    <a
                      href={`${detectedRemoteUrl.replace(/\.git$/, '')}/pull/new/${releaseBranchName}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '12px 18px', borderRadius: '14px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', textDecoration: 'none', fontWeight: 700, fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      Buka Pull/Merge Request ↗
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
