"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  MotionValue,
  useMotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

interface DockContextType {
  width: number;
  hovered: boolean;
  setIsZooming: (value: boolean) => void;
  zoomLevel: MotionValue<number>;
  mouseX: MotionValue<number>;
  animatingIndexes: number[];
  setAnimatingIndexes: (indexes: number[]) => void;
}

const DockContext = createContext<DockContextType | null>(null);

export const useDock = () => {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("useDock must be used within Dock");
  return ctx;
};

export interface DockProps {
  className?: string;
  children: ReactNode;
}

export function Dock({ className, children }: DockProps) {
  const [hovered, setHovered] = useState(false);
  const [width, setWidth] = useState(0);
  const dockRef = useRef<HTMLDivElement>(null);
  const isZooming = useRef(false);
  const [animatingIndexes, setAnimatingIndexes] = useState<number[]>([]);

  const setIsZooming = useCallback((value: boolean) => {
    isZooming.current = value;
    setHovered(!value);
  }, []);

  const zoomLevel = useMotionValue(1);
  const mouseX = useMotionValue(Infinity);

  useEffect(() => {
    const updateWidth = () => setWidth(dockRef.current?.clientWidth || 0);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return (
    <DockContext.Provider
      value={{
        hovered,
        setIsZooming,
        width,
        zoomLevel,
        mouseX,
        animatingIndexes,
        setAnimatingIndexes,
      }}
    >
      <motion.div
        ref={dockRef}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
        className={cn(
          "flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2 px-3 sm:px-4 sm:py-2.5 rounded-full",
          "bg-[#0a0a0e]/[0.94] backdrop-blur-2xl",
          "border border-white/[0.12]",
          "shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.08)]",
          className
        )}
        onMouseMove={(e) => {
          mouseX.set(e.pageX);
          if (!isZooming.current) {
            setHovered(true);
          }
        }}
        onMouseLeave={() => {
          mouseX.set(Infinity);
          setHovered(false);
        }}
        style={{
          scale: zoomLevel,
        }}
      >
        {children}
      </motion.div>
    </DockContext.Provider>
  );
}

export interface DockItemProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function DockItem({ children, className, onClick, title }: DockItemProps) {
  const itemRef = useRef<HTMLButtonElement>(null);

  return (
    <motion.button
      ref={itemRef}
      type="button"
      onClick={onClick}
      title={title}
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex shrink-0 items-center justify-center whitespace-nowrap",
        "rounded-full px-2.5 py-1.5 sm:px-3 sm:py-1.5 font-medium text-xs",
        "border border-transparent bg-transparent",
        "text-zinc-400 transition-colors duration-150",
        "outline-none cursor-pointer select-none",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

export default Dock;
