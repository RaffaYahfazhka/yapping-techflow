'use client';

import React from 'react';
import { css } from '@emotion/css';

export interface Agent {
  id: string;
  name: string;
  fullName?: string;
  role: string;
  department?: string;
  employeeId?: string;
  duties?: string;
  color?: string;
  avatar?: string;
  skills?: string[];
  [key: string]: any;
}

export interface AgentIdentityCardProps {
  agent: Agent;
  onOpenWorkspace?: (id: string) => void;
  onFocusDesk?: (id: string) => void;
  className?: string;
  compact?: boolean;
}

const styles = {
  card: (color: string) => css`
    position: relative;
    border-radius: 20px;
    padding: 20px;
    background: #111218;
    border: 1px solid ${color}40;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    transition: all 0.22s ease;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px ${color}20;
      border-color: ${color}70;
    }
  `,

  topGlowBar: (color: string) => css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, ${color}, #ffffff80, ${color});
  `,

  badgeHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  empIdText: css`
    font-family: ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #a1a1aa;
    letter-spacing: 0.05em;
  `,

  activePill: css`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    font-weight: 800;
    color: #34d399;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 2px 8px;
    border-radius: 6px;

    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
    }
  `,

  profileRow: css`
    display: flex;
    align-items: center;
    gap: 14px;
  `,

  avatarBox: (color: string) => css`
    width: 58px;
    height: 58px;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid ${color};
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  avatarInitials: (color: string) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: ${color};
    background: ${color}22;
  `,

  namesCol: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  `,

  nameText: css`
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.01em;
  `,

  rolePill: (color: string) => css`
    display: inline-block;
    font-size: 10px;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    text-transform: uppercase;
    color: ${color};
    background: ${color}20;
    border: 1px solid ${color}45;
    padding: 2px 8px;
    border-radius: 6px;
    align-self: flex-start;
  `,

  dutiesText: css`
    font-size: 12px;
    color: #a1a1aa;
    line-height: 1.5;
  `,

  skillsWrap: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,

  skillBadge: css`
    font-size: 10px;
    font-family: ui-monospace, monospace;
    font-weight: 600;
    color: #d4d4d8;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 2px 8px;
    border-radius: 6px;
  `,

  actionsRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  `,

  primaryBtn: (color: string) => css`
    flex: 1;
    padding: 9px 14px;
    border-radius: 10px;
    background: ${color}25;
    border: 1px solid ${color}60;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;

    &:hover {
      background: ${color}40;
      border-color: ${color};
    }
  `,

  deskBtn: css`
    padding: 9px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #d4d4d8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }
  `,
};

function getAgentInitials(agent: Agent) {
  const source = String(agent.fullName || agent.name || agent.id || '').replace(/[()]/g, ' ');
  const words = source.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function AgentIdentityCard({
  agent,
  onOpenWorkspace,
  onFocusDesk,
  className = '',
  compact = false,
}: AgentIdentityCardProps) {
  if (!agent) return null;
  const color = agent.color || '#10b981';

  return (
    <div className={`${styles.card(color)} ${className}`}>
      <div className={styles.topGlowBar(color)} />

      {/* Header ID */}
      <div className={styles.badgeHeader}>
        <span className={styles.empIdText}>
          {agent.employeeId || `EMP-${agent.id?.toUpperCase()}`}
        </span>
        <span className={styles.activePill}>ACTIVE</span>
      </div>

      {/* Profile info */}
      <div className={styles.profileRow}>
        <div className={styles.avatarBox(color)}>
          {agent.avatar ? (
            <img src={agent.avatar} alt={agent.fullName || agent.name} />
          ) : (
            <span className={styles.avatarInitials(color)} aria-hidden="true">
              {getAgentInitials(agent)}
            </span>
          )}
        </div>
        <div className={styles.namesCol}>
          <div className={styles.nameText}>{agent.fullName || agent.name}</div>
          <div className={styles.rolePill(color)}>{agent.role}</div>
        </div>
      </div>

      {/* Duties description */}
      <div className={styles.dutiesText}>{agent.duties}</div>

      {/* Skills list */}
      {agent.skills && agent.skills.length > 0 && (
        <div className={styles.skillsWrap}>
          {agent.skills.map((s, idx) => (
            <span key={idx} className={styles.skillBadge}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.actionsRow}>
        {onOpenWorkspace && (
          <button
            type="button"
            className={styles.primaryBtn(color)}
            onClick={() => onOpenWorkspace(agent.id)}
          >
            Buka Workspace
          </button>
        )}
        {onFocusDesk && (
          <button
            type="button"
            className={styles.deskBtn}
            onClick={() => onFocusDesk(agent.id)}
            title="Sorot meja di scene 3D"
          >
            Meja 🎯
          </button>
        )}
      </div>
    </div>
  );
}
