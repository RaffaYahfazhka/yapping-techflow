'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

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
  default: 'border-white/10 focus-within:border-emerald-500/50',
  success: 'border-emerald-500/50',
  warning: 'border-amber-500/50',
  error: 'border-rose-500/50',
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  default: 'text-zinc-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-rose-400',
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
  const borderCls = STATUS_BORDER[status] || STATUS_BORDER.default;
  const statusTextColor = STATUS_TEXT_COLOR[status] || STATUS_TEXT_COLOR.default;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span>{label}</span>
          {actionButton}
        </div>
      )}

      <div className={`relative flex items-center rounded-xl bg-black/40 border transition-all ${borderCls} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <select
          id={id}
          name={name}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value, e)}
          className="w-full appearance-none bg-transparent px-3 py-2 text-xs text-zinc-200 outline-none cursor-pointer disabled:cursor-not-allowed font-medium pr-8"
        >
          {placeholder && (
            <option value="" disabled className="bg-zinc-900 text-zinc-500">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
              {opt.label || opt.value}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 text-zinc-400">
          <ChevronDown size={14} />
        </div>
      </div>

      {(statusText || helper) && (
        <div className={`text-[11px] ${statusText ? statusTextColor : 'text-zinc-500'}`}>
          {statusText || helper}
        </div>
      )}
    </div>
  );
}
