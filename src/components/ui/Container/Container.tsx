'use client';

import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  glass?: boolean;
  elevated?: boolean;
  bordered?: boolean;
  padded?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function Container({
  children,
  className = '',
  glass = true,
  elevated = false,
  bordered = true,
  padded = true,
  onClick,
  ...props
}: ContainerProps) {
  const glassCls = glass
    ? 'bg-[rgba(17,18,24,0.88)] backdrop-blur-xl'
    : 'bg-[#111218]';
  const borderCls = bordered
    ? 'border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]'
    : 'border-0';
  const padCls = padded ? 'p-5' : 'p-0';
  const elevatedCls = elevated
    ? 'hover:border-emerald-500/40 hover:shadow-[0_20px_45px_rgba(0,0,0,0.55)] hover:-translate-y-0.5'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl transition-all duration-200 ${glassCls} ${borderCls} ${padCls} ${elevatedCls} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
