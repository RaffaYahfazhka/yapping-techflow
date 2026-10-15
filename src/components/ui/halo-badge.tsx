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
    primaryBg: "linear-gradient(90deg, #ff0080, #7928ca, #00d4ff, #0070f3)",
    secondaryBg: "linear-gradient(90deg, #ff4d4d, #f9cb28, #ff0080)",
    tertiaryBg: "linear-gradient(90deg, #0070f3, #00d4ff, #7928ca)",
  },
  success: {
    primaryBg: "linear-gradient(90deg, #047857, #059669, #10b981, #14b8a6, #0d9488)",
    secondaryBg: "linear-gradient(90deg, #34d399, #6ee7b7, #2dd4bf, #5eead4)",
    tertiaryBg: "linear-gradient(90deg, #065f46, #047857, #0f766e)",
  },
  destructive: {
    primaryBg: "linear-gradient(90deg, #991b1b, #dc2626, #e11d48, #f43f5e, #be123c)",
    secondaryBg: "linear-gradient(90deg, #fb7185, #fda4af, #f87171, #fecdd3)",
    tertiaryBg: "linear-gradient(90deg, #7f1d1d, #b91c1c, #dc2626)",
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
      <span
        className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-sm transition-opacity duration-300"
        style={{
          background: isHovered && interactive ? gradients.primaryBg : gradients.secondaryBg,
          opacity: isHovered ? 0.9 : 0.45,
        }}
      />
      <span
        className={cn(
          "relative z-10 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border border-white/10",
          translucent ? "bg-[#090b10]/90 backdrop-blur-xl" : "bg-[#0c0d14]"
        )}
      >
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
        <span className="text-zinc-200">{children}</span>
      </span>
    </motion.span>
  );
}

export default HaloBadge;
