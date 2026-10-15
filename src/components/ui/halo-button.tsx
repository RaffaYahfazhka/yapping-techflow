"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface HaloButtonProps extends ComponentProps<typeof motion.button> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
}

const GRADIENT_MAP: Record<string, string> = {
  primary: "linear-gradient(135deg, #10b981, #06b6d4, #38bdf8)",
  secondary: "linear-gradient(135deg, #8b5cf6, #a855f7, #ec4899)",
  danger: "linear-gradient(135deg, #f43f5e, #fb7185, #e11d48)",
  ghost: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
};

export function HaloButton({
  children,
  className,
  variant = "primary",
  isLoading = false,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...props
}: HaloButtonProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [isHovered, setIsHovered] = useState(false);

  const gradient = GRADIENT_MAP[variant] || GRADIENT_MAP.primary;

  return (
    <motion.button
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      disabled={disabled || isLoading}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        onMouseLeave?.(e);
      }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl p-px font-bold text-xs tracking-wide select-none focus:outline-none disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {/* Outer glow layer */}
      <span
        className="pointer-events-none absolute inset-0 rounded-xl blur-sm transition-all duration-400"
        style={{
          background: gradient,
          opacity: isHovered ? 0.9 : 0.3,
        }}
      />
      {/* Deeper glow for hover state */}
      <span
        className="pointer-events-none absolute -inset-[2px] rounded-xl blur-md transition-opacity duration-500"
        style={{
          background: gradient,
          opacity: isHovered ? 0.25 : 0,
        }}
      />
      <span className={cn(
        "relative z-10 flex w-full items-center justify-center gap-2",
        "rounded-[10px] bg-[#0c0d14]/[0.92] px-4 py-2",
        "text-zinc-100 border border-white/[0.06] backdrop-blur-xl",
        "transition-all duration-200",
        "hover:bg-[#111320]/[0.95] hover:text-white"
      )}>
        {isLoading && (
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round"
              className="opacity-20"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </span>
    </motion.button>
  );
}

export default HaloButton;
