'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Users, Sparkles, Filter, Briefcase } from 'lucide-react';
import Modal from '../../ui/Modal';
import AgentIdentityCard from '../AgentIdentityCard';
import { AGENTS, BOSS } from '../../../lib/data/agents';

export interface TeamDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkspace?: (id: string) => void;
  onFocusDesk?: (id: string) => void;
}

const DEPARTMENTS = [
  { id: 'all', label: 'Semua Divisi' },
  { id: 'Product', label: 'Product & Strategy' },
  { id: 'Architecture', label: 'Architecture' },
  { id: 'Frontend', label: 'Frontend' },
  { id: 'Backend', label: 'Backend' },
  { id: 'QA', label: 'QA & Security' },
  { id: 'DevOps', label: 'DevOps & Infra' },
];

export default function TeamDirectoryModal({
  isOpen,
  onClose,
  onOpenWorkspace,
  onFocusDesk,
}: TeamDirectoryModalProps) {
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTeam = useMemo(() => [BOSS, ...AGENTS], []);

  const filteredTeam = useMemo(() => {
    return allTeam.filter((member) => {
      const matchesDept =
        filterDepartment === 'all' ||
        (member.department || '').toLowerCase().includes(filterDepartment.toLowerCase()) ||
        (member.role || '').toLowerCase().includes(filterDepartment.toLowerCase());

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        (member.fullName || member.name).toLowerCase().includes(q) ||
        (member.role || '').toLowerCase().includes(q) ||
        (member.employeeId || '').toLowerCase().includes(q) ||
        (member.skills || []).some((s) => s.toLowerCase().includes(q));

      return matchesDept && matchesSearch;
    });
  }, [allTeam, filterDepartment, searchQuery]);

  // Dept counts
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTeam.length };
    allTeam.forEach((member) => {
      DEPARTMENTS.slice(1).forEach((dept) => {
        if (
          (member.department || '').toLowerCase().includes(dept.id.toLowerCase()) ||
          (member.role || '').toLowerCase().includes(dept.id.toLowerCase())
        ) {
          counts[dept.id] = (counts[dept.id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [allTeam]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Direktori Skuad Autonomous AI"
      subtitle="Katalog identitas, kredensial eksekutif, dan status operasional real-time seluruh tim Yapping Techflow"
      icon={<Users size={18} className="text-emerald-400" />}
    >
      <div className="flex flex-col gap-6 font-sans select-none">
        {/* Top Control Bar: Search & Quick Stats */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121319]/90 p-4 md:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          {/* Subtle ambient background glow */}
          <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-emerald-500/[0.06] blur-[50px]" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-violet-500/[0.05] blur-[50px]" />

          <div className="relative flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 group">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-emerald-400"
              />
              <input
                type="text"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs bg-white/[0.04] border border-white/[0.08] text-white placeholder-zinc-500 outline-none transition-all duration-200 focus:bg-white/[0.06] focus:border-emerald-500/50 focus:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                placeholder="Cari agen berdasarkan nama, role, employee ID, atau tech stack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Summary Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] shrink-0 text-xs text-zinc-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>Menampilkan:</span>
              <strong className="text-white font-mono">{filteredTeam.length}</strong>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500 font-mono">{allTeam.length} personel</span>
            </div>
          </div>

          {/* Department Filter Tabs */}
          <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1.5 mr-1">
              <Filter size={12} /> Filter:
            </span>
            {DEPARTMENTS.map((dept) => {
              const active = filterDepartment === dept.id;
              const count = deptCounts[dept.id] || 0;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setFilterDepartment(dept.id)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                      : 'bg-white/[0.03] text-zinc-400 border border-white/[0.06] hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <span>{dept.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                      active
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-white/[0.05] text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTeam.map((agent) => (
              <motion.div
                key={agent.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <AgentIdentityCard
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredTeam.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-white/[0.06] bg-[#121319]/40"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400 mb-3 shadow-inner">
              <Search size={24} className="text-zinc-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Tidak ada personil yang cocok</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              Tidak ditemukan profil karyawan dengan kata kunci "{searchQuery}" pada filter{' '}
              {DEPARTMENTS.find((d) => d.id === filterDepartment)?.label}.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterDepartment('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/10 transition-colors"
            >
              Reset Pencarian & Filter
            </button>
          </motion.div>
        )}
      </div>
    </Modal>
  );
}
