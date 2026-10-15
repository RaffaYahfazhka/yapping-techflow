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
  useSpring,
  useTransform,
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
        className={cn(
          "flex items-center gap-2 p-2 rounded-2xl bg-[#0a0a0e]/95 backdrop-blur-2xl border border-white/20 shadow-[0_18px_48px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]",
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
  const dock = useDock();

  const widthSync = useTransform(dock.mouseX, (val) => {
    const bounds = itemRef.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    const distance = val - bounds.x - bounds.width / 2;
    const clamped = Math.max(-120, Math.min(120, distance));
    const scale = Math.cos((clamped / 120) * (Math.PI / 2));
    return 36 + Math.pow(Math.max(0, scale), 6) * 14;
  });

  const size = useSpring(widthSync, { mass: 0.1, stiffness: 240, damping: 14 });

  return (
    <motion.button
      ref={itemRef}
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "relative flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 font-medium text-xs text-zinc-300 transition-colors hover:text-white hover:bg-white/10 active:scale-95",
        className
      )}
      style={{ minHeight: size }}
    >
      {children}
    </motion.button>
  );
}

export default Dock;
