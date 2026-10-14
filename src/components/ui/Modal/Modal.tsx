'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
  fixedHeight?: string;
}
export const scrollbar = '';


const SIZE_MAP: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[95vw] h-[92vh]',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  maxWidth,
  className = '',
  bodyClassName = '',
  fixedHeight,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex flex-col w-full rounded-2xl bg-[#0d0e12]/95 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-zinc-100 overflow-hidden ${sizeCls} ${className}`}
        style={{
          maxWidth: maxWidth || undefined,
          height: fixedHeight || undefined,
          maxHeight: fixedHeight ? undefined : '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || icon || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {icon && <div className="text-emerald-400 shrink-0">{icon}</div>}
              <div>
                {title && <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>}
                {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-6 py-5 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-white/10 bg-white/[0.02]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
