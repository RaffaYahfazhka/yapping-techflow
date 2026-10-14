'use client';

import React, { useState } from 'react';
import { css } from '@emotion/css';
import Modal from '../../ui/Modal';
import AgentIdentityCard from '../AgentIdentityCard';
import { AGENTS, BOSS } from '../../../lib/data/agents';

export interface TeamDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspace?: (id: string) => void;
  onFocusDesk?: (id: string) => void;
}

const styles = {
  filterRow: css`
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border-radius: 16px;
    background: #14151b;
    border: 1px solid rgba(255, 255, 255, 0.08);
    flex-wrap: wrap;
  `,

  searchBox: css`
    position: relative;
    flex: 1;
    min-width: 240px;
  `,

  searchInput: css`
    width: 100%;
    padding: 10px 14px 10px 38px;
    border-radius: 12px;
    font-size: 13px;
    background: #0d0e12;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffffff;
    outline: none;

    &::placeholder {
      color: #71717a;
    }

    &:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }
  `,

  deptTabs: css`
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
  `,

  deptBtn: (isSelected: boolean) => css`
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    border: 1px solid ${isSelected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
    background: ${isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)'};
    color: ${isSelected ? '#6ee7b7' : '#a1a1aa'};
    transition: all 0.15s ease;

    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
  `,

  cardsGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 18px;
    padding-top: 4px;
  `,

  emptyNotice: css`
    text-align: center;
    padding: 50px 20px;
    color: #71717a;
    font-size: 13px;
    font-style: italic;
  `,
};

export default function TeamDirectoryModal({
  isOpen,
  onClose,
  onOpenWorkspace,
  onFocusDesk,
}: TeamDirectoryModalProps) {
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTeam = [BOSS, ...AGENTS];

  const filteredTeam = allTeam.filter((member) => {
    const matchesDept =
      filterDepartment === 'all' ||
      (member.department || '').toLowerCase().includes(filterDepartment.toLowerCase()) ||
      (member.role || '').toLowerCase().includes(filterDepartment.toLowerCase());

    const matchesSearch =
      searchQuery.trim() === '' ||
      (member.fullName || member.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.skills || []).some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesDept && matchesSearch;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Kartu Identitas Karyawan AI"
      subtitle="Daftar profil resmi, ID badge & kredensial autonomous squad Kantor Raffa"
      icon={<span>🪪</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div className={styles.filterRow}>
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
              placeholder="Cari nama, role, employee ID, atau skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.deptTabs}>
            {['all', 'Product', 'Architecture', 'Frontend', 'Backend', 'QA', 'DevOps'].map((dept) => (
              <button
                key={dept}
                type="button"
                className={styles.deptBtn(filterDepartment === dept)}
                onClick={() => setFilterDepartment(dept)}
              >
                {dept === 'all' ? `Semua (${allTeam.length})` : dept}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.cardsGrid}>
          {filteredTeam.map((agent) => (
            <AgentIdentityCard
              key={agent.id}
              agent={agent}
              onOpenWorkspace={(id) => {
                onClose?.();
                onOpenWorkspace?.(id);
              }}
              onFocusDesk={(id) => {
                onClose?.();
                onFocusDesk?.(id);
              }}
            />
          ))}
        </div>

        {filteredTeam.length === 0 && (
          <div className={styles.emptyNotice}>
            Tidak ada profil karyawan yang cocok dengan pencarian "{searchQuery}".
          </div>
        )}
      </div>
    </Modal>
  );
}
