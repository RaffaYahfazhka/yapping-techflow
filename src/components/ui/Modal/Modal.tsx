'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

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

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 350, damping: 32, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 16,
    filter: 'blur(4px)',
    transition: { duration: 0.2, ease: 'easeIn' as const },
  },
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
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop with frosted glass + subtle noise */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-xl" />

          {/* Top ambient light splash */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[320px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
          </div>

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative flex flex-col w-full overflow-hidden',
              'rounded-[20px] md:rounded-[24px]',
              'bg-[#0c0d12]/[0.97]',
              'border border-white/[0.08]',
              'shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85),0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.04)]',
              'text-zinc-100 outline-none',
              'backdrop-blur-2xl',
              sizeCls,
              className
            )}
            style={{
              maxWidth: maxWidth || undefined,
              height: fixedHeight || undefined,
              maxHeight: fixedHeight ? undefined : '92vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top border accent glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

            {/* Header */}
            {(title || icon || subtitle) && (
              <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-5 border-b border-white/[0.06] bg-white/[0.015] shrink-0">
                <div className="flex items-center gap-3.5">
                  {icon && (
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.12] text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.08)]">
                      {icon}
                    </div>
                  )}
                  <div>
                    {title && (
                      <h2 className="text-[15px] font-bold text-white tracking-[-0.01em]">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onClose}
                  className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors outline-none"
                  aria-label="Tutup"
                >
                  <X size={16} strokeWidth={2.5} />
                </motion.button>
              </div>
            )}

            {/* Body */}
            <div className={cn('flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-7', bodyClassName)}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 md:px-8 md:py-5 border-t border-white/[0.06] bg-white/[0.015] shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Material Tailwind Dialog Compound Components
 */
export function Dialog({
  isOpen,
  onClose,
  size = 'md',
  maxWidth,
  className = '',
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  maxWidth?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizeCls = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-8"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative flex flex-col w-full overflow-hidden',
              'rounded-[24px]',
              'bg-[#0c0d12]/[0.97]',
              'border border-white/[0.1]',
              'shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85),0_0_1px_rgba(255,255,255,0.1)]',
              'text-zinc-100 outline-none backdrop-blur-2xl',
              sizeCls,
              className
            )}
            style={{
              maxWidth: maxWidth || undefined,
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DialogHeader({
  title,
  subtitle,
  icon,
  onClose,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-6 py-4 md:px-8 md:py-5 border-b border-white/[0.08] bg-white/[0.02] shrink-0',
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/[0.1] border border-emerald-500/[0.2] text-emerald-400 shrink-0 shadow-[0_0_16px_rgba(16,185,129,0.12)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {title && <h2 className="text-base font-bold text-white tracking-tight truncate">{title}</h2>}
          {subtitle && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed truncate">{subtitle}</p>}
          {children}
        </div>
      </div>
      {onClose && (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-3 shrink-0"
          aria-label="Tutup"
        >
          <X size={18} strokeWidth={2.2} />
        </motion.button>
      )}
    </div>
  );
}

export function DialogBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-6', className)}>
      {children}
    </div>
  );
}

export function DialogFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 md:px-8 md:py-4.5 border-t border-white/[0.08] bg-white/[0.02] shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
}

