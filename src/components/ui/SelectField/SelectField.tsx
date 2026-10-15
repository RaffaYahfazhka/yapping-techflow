'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label?: string;
  [key: string]: unknown;
}

export interface SelectFieldProps {
  label?: string;
  value?: string;
  onChange?: (val: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  status?: 'default' | 'success' | 'warning' | 'error';
  statusText?: string;
  helper?: string;
  actionButton?: React.ReactNode;
  className?: string;
  id?: string;
  name?: string;
}

const STATUS_BORDER: Record<string, string> = {
  default: 'border-white/[0.08] focus-within:border-emerald-500/40 focus-within:shadow-[0_0_12px_rgba(16,185,129,0.06)]',
  success: 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.06)]',
  warning: 'border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.06)]',
  error: 'border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.06)]',
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  default: 'text-zinc-500',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
};

const STATUS_ICON: Record<string, string> = {
  default: '',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export default function SelectField({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih salah satu...',
  disabled = false,
  status = 'default',
  statusText = '',
  helper = '',
  actionButton = null,
  className = '',
  id,
  name,
}: SelectFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const borderCls = STATUS_BORDER[status] || STATUS_BORDER.default;
  const statusTextColor = STATUS_TEXT_COLOR[status] || STATUS_TEXT_COLOR.default;
  const statusIcon = STATUS_ICON[status] || '';

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className={cn(
              'text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200',
              isFocused ? 'text-zinc-200' : 'text-zinc-500'
            )}
          >
            {label}
          </label>
          {actionButton}
        </div>
      )}

      <div
        className={cn(
          'relative flex items-center rounded-xl',
          'bg-white/[0.025] backdrop-blur-sm',
          'border transition-all duration-200',
          borderCls,
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange?.(e.target.value, e)}
          className={cn(
            'w-full appearance-none bg-transparent px-3.5 py-2.5',
            'text-xs text-zinc-200 outline-none cursor-pointer',
            'disabled:cursor-not-allowed font-medium pr-9',
            'transition-colors duration-200'
          )}
        >
          {placeholder && (
            <option value="" disabled className="bg-[#0c0d12] text-zinc-600">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#0c0d12] text-zinc-200">
              {opt.label || opt.value}
            </option>
          ))}
        </select>

        {/* Custom chevron with rotation animation */}
        <motion.div
          animate={{ rotate: isFocused ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="pointer-events-none absolute right-3 text-zinc-500"
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </motion.div>
      </div>

      <AnimatePresence>
        {(statusText || helper) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'flex items-center gap-1 text-[11px]',
              statusText ? statusTextColor : 'text-zinc-600'
            )}
          >
            {statusIcon && <span className="text-[10px]">{statusIcon}</span>}
            <span>{statusText || helper}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
