"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type RimVariant = "default" | "success" | "destructive";

const RIM_BLOB_GRADIENTS: Record<
  RimVariant,
  { primaryBg: string; secondaryBg: string; tertiaryBg: string }
> = {
  default: {
    primaryBg: "linear-gradient(120deg, #ff0080, #7928ca, #00d4ff, #0070f3)",
    secondaryBg: "linear-gradient(120deg, #ff4d4d, #f9cb28, #ff0080)",
    tertiaryBg: "linear-gradient(120deg, #0070f3, #00d4ff, #7928ca)",
  },
  success: {
    primaryBg: "linear-gradient(120deg, #047857, #059669, #10b981, #14b8a6, #0d9488)",
    secondaryBg: "linear-gradient(120deg, #34d399, #6ee7b7, #2dd4bf, #5eead4)",
    tertiaryBg: "linear-gradient(120deg, #065f46, #047857, #0f766e)",
  },
  destructive: {
    primaryBg: "linear-gradient(120deg, #991b1b, #dc2626, #e11d48, #f43f5e, #be123c)",
    secondaryBg: "linear-gradient(120deg, #fb7185, #fda4af, #f87171, #fecdd3)",
    tertiaryBg: "linear-gradient(120deg, #7f1d1d, #b91c1c, #dc2626)",
  },
};

export interface HaloBadgeProps
  extends Omit<ComponentProps<typeof motion.span>, "children">,
    VariantProps<typeof badgeVariants> {
  children?: ReactNode;
  live?: boolean;
  layout?: boolean;
  tabularNums?: boolean;
  translucent?: boolean;
  interactive?: boolean;
}

export function HaloBadge({
  variant = "default",
  className,
  children,
  live = false,
  layout = true,
  translucent = true,
  interactive = true,
  onMouseEnter,
  onMouseLeave,
  ...props
}: HaloBadgeProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [isHovered, setIsHovered] = useState(false);

  const gradients = useMemo(() => {
    if (variant === "destructive") return RIM_BLOB_GRADIENTS.destructive;
    return RIM_BLOB_GRADIENTS.default;
  }, [variant]);

  return (
    <motion.span
      layout={layout && !reduceMotion}
      whileHover={interactive ? { scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        onMouseLeave?.(e);
      }}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full p-px text-[11px] font-semibold tracking-wide select-none",
        className
      )}
      {...props}
    >
      {/* Outer halo glow */}
      <span
        className="pointer-events-none absolute inset-0 rounded-full blur-sm transition-all duration-400"
        style={{
          background: isHovered && interactive ? gradients.primaryBg : gradients.secondaryBg,
          opacity: isHovered ? 0.85 : 0.35,
        }}
      />
      {/* Secondary layer for depth */}
      <span
        className="pointer-events-none absolute -inset-[1px] rounded-full blur-md transition-opacity duration-500"
        style={{
          background: gradients.tertiaryBg,
          opacity: isHovered ? 0.3 : 0.1,
        }}
      />
      <span
        className={cn(
          "relative z-10 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border border-white/[0.08]",
          translucent ? "bg-[#090b10]/[0.92] backdrop-blur-xl" : "bg-[#0c0d14]"
        )}
      >
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          </span>
        )}
        <span className="text-zinc-200">{children}</span>
      </span>
    </motion.span>
  );
}

export default HaloBadge;
