"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface HaloButtonProps extends ComponentProps<typeof motion.button> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  isLoading?: boolean;
}

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

  const gradient = useMemo(() => {
    if (variant === "danger") return "linear-gradient(90deg, #f43f5e, #fb7185, #e11d48)";
    if (variant === "secondary") return "linear-gradient(90deg, #8b5cf6, #38bdf8, #10b981)";
    return "linear-gradient(90deg, #10b981, #06b6d4, #38bdf8)";
  }, [variant]);

  return (
    <motion.button
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
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
        "relative inline-flex items-center justify-center rounded-xl p-px font-bold text-xs tracking-wide select-none focus:outline-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-xl opacity-60 blur-sm transition-opacity duration-300"
        style={{
          background: gradient,
          opacity: isHovered ? 0.95 : 0.4,
        }}
      />
      <span className="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c0d14]/90 px-4 py-2 text-zinc-100 border border-white/10 backdrop-blur-xl transition hover:bg-[#121420]/95 hover:text-white">
        {isLoading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        )}
        {children}
      </span>
    </motion.button>
  );
}

export default HaloButton;
