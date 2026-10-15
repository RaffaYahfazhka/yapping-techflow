"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export interface SpeechBubbleProps {
  children: ReactNode;
  className?: string;
  showCursor?: boolean;
}

export function SpeechBubbleRoot({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="speech-bubble" className={cn("relative my-1", className)} {...props} />;
}

export function SpeechBubbleBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="speech-bubble-body"
      className={cn(
        "relative flex w-fit items-center rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-2.5 text-zinc-100 shadow-md backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}

export function SpeechBubbleTail({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      data-slot="speech-bubble-tail"
      aria-hidden="true"
      className={cn("absolute right-[-10px] bottom-1 h-3.5 w-3.5", className)}
      fill="none"
      viewBox="0 0 53 45"
      {...props}
    >
      <path
        className="fill-white/10"
        d="M44 0H0V0C0 24.8528 20.1472 45 45 45H53V45C47.1396 36.535 44 26.4842 44 16.1886V0Z"
      />
    </svg>
  );
}

export function SpeechBubbleText({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="speech-bubble-text"
      className={cn("relative text-xs leading-relaxed text-zinc-200", className)}
      {...props}
    />
  );
}

export function SpeechBubbleCursor({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="speech-bubble-cursor"
      className={cn("relative ml-1.5 inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400", className)}
      {...props}
    />
  );
}

export function SpeechBubble({ children, className, showCursor = false }: SpeechBubbleProps) {
  return (
    <SpeechBubbleRoot className={className}>
      <SpeechBubbleBody>
        <SpeechBubbleTail />
        <SpeechBubbleText>{children}</SpeechBubbleText>
        {showCursor ? <SpeechBubbleCursor /> : null}
      </SpeechBubbleBody>
    </SpeechBubbleRoot>
  );
}

export default SpeechBubble;
