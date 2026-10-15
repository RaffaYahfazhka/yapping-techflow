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
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
  fixedHeight?: string;
}
export const scrollbar = '';


const SIZE_MAP: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  '2xl': 'max-w-7xl',
  full: 'max-w-[96vw] h-[92vh]',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8 bg-black/70 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex flex-col w-full rounded-3xl bg-[#0c0d12]/95 border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.8)] text-zinc-100 overflow-hidden ${sizeCls} ${className}`}
        style={{
          maxWidth: maxWidth || undefined,
          height: fixedHeight || undefined,
          maxHeight: fixedHeight ? undefined : '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || icon || subtitle) && (
          <div className="flex items-center justify-between px-6 py-4.5 md:px-8 md:py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-4">
              {icon && <div className="text-emerald-400 shrink-0 text-lg">{icon}</div>}
              <div>
                {title && <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>}
                {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-7 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 md:px-8 md:py-5 border-t border-white/10 bg-white/[0.02] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
