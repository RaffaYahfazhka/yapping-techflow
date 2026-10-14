'use client';

import React, { useState } from 'react';
import Modal from '../../ui/Modal';
import AgentIdentityCard from '../AgentIdentityCard';
import { AGENTS, BOSS } from '../../../lib/data/agents';

export interface TeamDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspace?: (id: string) => void;
  onFocusDesk?: (id: string) => void;
}

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
      <div className="flex flex-col gap-4 font-sans select-none">
        {/* Search & Dept Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#14151b] border border-white/10">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-[#0d0e12] border border-white/10 text-white placeholder-zinc-500 outline-none focus:border-emerald-500/50"
              placeholder="Cari nama, role, employee ID, atau skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['all', 'Product', 'Architecture', 'Frontend', 'Backend', 'QA', 'DevOps'].map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setFilterDepartment(dept)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filterDepartment === dept
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {dept === 'all' ? `Semua (${allTeam.length})` : dept}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="py-12 text-center text-zinc-500 italic text-xs">
            Tidak ada profil karyawan yang cocok dengan pencarian "{searchQuery}".
          </div>
        )}
      </div>
    </Modal>
  );
}
