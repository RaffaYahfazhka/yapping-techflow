'use client';

/**
 * Declarative R3F penthouse scene: architecture, terrace, WIB sky, wallboard.
 * Loaded via next/dynamic(ssr:false) from OfficeClientBoundary — never SSR'd.
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Html, Float, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { AGENTS, BOSS } from '@/lib/data/agents';
import { CAMERA_OFFSET, ROOM, PALETTE } from '@/lib/engine/constants';
import {
  skyPaletteFor,
  phaseFromMinutes,
  wibMinutesNow,
  type SkyPhase,
  type SkyPalette,
} from '@/lib/engine/skyEngine';

// ─── Zones (shared with the minimap) ────────────────────────────────────────
export { ZONES, type ZoneDef } from '@/lib/data/zones';


// ─── WIB-driven lighting ────────────────────────────────────────────────────

function useWibPhase(): { phase: SkyPhase; palette: SkyPalette } {
  const [minutes, setMinutes] = useState(() => wibMinutesNow());
  useEffect(() => {
    const t = setInterval(() => setMinutes(wibMinutesNow()), 60_000);
    return () => clearInterval(t);
  }, []);
  const phase = phaseFromMinutes(minutes);
  const palette = useMemo(() => skyPaletteFor(phase), [phase]);
  return { phase, palette };
}

function SceneLighting({ palette, shadows }: { palette: SkyPalette; shadows: boolean }) {
  const keyRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    if (keyRef.current && shadows) keyRef.current.shadow.needsUpdate = true;
  }, [palette, shadows]);
  return (
    <>
      <ambientLight color={palette.ambientColor} intensity={palette.ambientIntensity} />
      <directionalLight
        ref={keyRef}
        color={palette.keyColor}
        intensity={palette.keyIntensity}
        position={palette.keyPosition}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />
      <pointLight position={[9.5, 2.5, 0]} color={PALETTE.emerald} intensity={2 * palette.neonIntensity} distance={10} />
      <pointLight position={[-8, 3, -6.5]} color={PALETTE.violet} intensity={1.5 * palette.neonIntensity} distance={12} />
    </>
  );
}

// ─── Static architecture (floor, walls, skyline windows, city glow) ────────

function Architecture({ palette }: { palette: SkyPalette }) {
  const cityGlow = palette.cityGlow;
  const cityLights = useMemo(() => {
    // A deterministic cluster of city blocks outside the back windows.
    const items: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [];
    const colors = ['#f59e0b', '#22d3ee', '#ec4899', '#a78bfa', '#34d399'];
    let seed = 42;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 28; i++) {
      const x = -60 + rand() * 120;
      const z = -70 - rand() * 40; // beyond the back wall (z < -12)
      const h = 8 + rand() * 40;
      items.push({
        pos: [x, h / 2 - 0.3, z],
        size: [4 + rand() * 8, h, 4 + rand() * 8],
        color: colors[i % colors.length],
      });
    }
    return items;
  }, []);


  return (
    <group>
      {/* interior floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.maxX - ROOM.minX, ROOM.maxZ - ROOM.minZ]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={0.85} />
      </mesh>
      {/* rooftop terrace deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, 0.01, 24]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#a47b55" roughness={0.7} />
      </mesh>
      {/* frameless glass balustrade around the terrace */}
      <mesh position={[6, 0.6, 29]}>
        <boxGeometry args={[20, 1.2, 0.08]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.25} roughness={0.05} transmission={0.85} />
      </mesh>
      <mesh position={[-4.1, 0.6, 24]}>
        <boxGeometry args={[0.08, 1.2, 10]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.25} roughness={0.05} transmission={0.85} />
      </mesh>
      <mesh position={[16.1, 0.6, 24]}>
        <boxGeometry args={[0.08, 1.2, 10]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.25} roughness={0.05} transmission={0.85} />
      </mesh>
      {/* panorama window band on the back wall */}
      <mesh position={[0, 3, -12.05]}>
        <planeGeometry args={[30, 6.2]} />
        <meshPhysicalMaterial color="#0b1020" metalness={0.1} roughness={0.05} transmission={0.4} transparent opacity={0.35} />
      </mesh>
      {/* city blocks visible beyond the glass */}
      {cityLights.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color="#0f172a" emissive={b.color} emissiveIntensity={0.32 * cityGlow} roughness={0.9} />
        </mesh>
      ))}
      {/* warm window lights on the city face (instanced-ish strips for glow) */}
      <group>
        {cityLights.slice(0, 14).map((b, i) => (
          <mesh key={`w${i}`} position={[b.pos[0], b.pos[1], b.pos[2] + b.size[2] / 2 + 0.05]} scale={[0.9, 0.9, 0.1]}>
            <planeGeometry args={[b.size[0] * 0.7, b.size[1] * 0.7]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.22 * cityGlow} />
          </mesh>
        ))}
      </group>
      {/* penthouse neon strip */}
      <mesh position={[0, 0.06, 12]}>
        <planeGeometry args={[32, 0.18]} />
        <meshBasicMaterial color={PALETTE.emerald} toneMapped={false} />
      </mesh>
      {/* plants (monstera low-poly) */}
      {[[-12, 10], [-13, -10], [4, 11]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.44]} />
            <meshStandardMaterial color="#e2ddd2" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.75, 0]} castShadow>
            <coneGeometry args={[0.5, 1.1, 6]} />
            <meshStandardMaterial color="#2f6b4f" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── War-room holographic wallboard ─────────────────────────────────────────

function Wallboard({ equity }: { equity: number }) {
  const rings = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rings.current) rings.current.rotation.z += dt * 0.6;
  });
  const up = equity >= 0;
  return (
    <group position={[8, 1.6, -1]}>
      <mesh rotation={[-Math.PI / 3.2, 0, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.16, 32]} />
        <meshStandardMaterial color="#0b1016" roughness={0.3} metalness={0.7} />
      </mesh>
      <group ref={rings}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <torusGeometry args={[1.7, 0.05, 8, 48]} />
          <meshBasicMaterial color={PALETTE.emerald} toneMapped={false} transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
          <torusGeometry args={[1.1, 0.04, 8, 40]} />
          <meshBasicMaterial color={PALETTE.violet} toneMapped={false} transparent opacity={0.6} />
        </mesh>
      </group>
      <Float speed={2.2} floatIntensity={0.5} rotationIntensity={0.2}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[1.3, 1.3, 0.05]} />
          <meshBasicMaterial color={up ? PALETTE.emerald : '#ef4444'} transparent opacity={0.16} />
        </mesh>
      </Float>
      <Html center distanceFactor={10} position={[0, 1.35, 0]}>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(10,14,20,0.85)',
            border: '1px solid rgba(16,185,129,.35)',
            color: up ? '#6ee7b7' : '#fca5a5',
            fontSize: 11,
            fontFamily: 'var(--font-geist-mono), monospace',
            whiteSpace: 'nowrap',
          }}
        >
          PORTFOLIO EQUITY (PAPER): {up ? '+' : ''}
          {equity.toFixed(2)}%
        </div>
      </Html>
      <pointLight position={[0, 1.2, 1]} color={PALETTE.emerald} intensity={1.2} distance={8} />
    </group>
  );
}

// ─── Skyline Suite desks (Altair/Kenzo/Damian) + war-room anchors ──────────

function Desks() {
  const desks = AGENTS.filter((a) => a.workspace === 'trading');
  const engDesks = AGENTS.filter((a) => a.workspace !== 'trading');
  return (
    <group>
      {[...desks, ...engDesks].map((agent) => (
        <group key={agent.id} position={[agent.desk.x, 0, agent.desk.z]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[1.9, 0.1, 1]} />
            <meshStandardMaterial color={PALETTE.desk} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.72, 0.38]}>
            <boxGeometry args={[1.5, 0.55, 0.06]} />
            <meshStandardMaterial color="#111827" emissive={agent.color} emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.5, 4, 8]} />
            <meshStandardMaterial color={agent.look.skin} roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.86, 0]}>
            <sphereGeometry args={[0.19, 12, 12]} />
            <meshStandardMaterial color={agent.look.skin} roughness={0.75} />
          </mesh>
          <Html center distanceFactor={11} position={[0, 2.25, 0]}>
            <div
              style={{
                padding: '3px 8px',
                borderRadius: 7,
                background: 'rgba(8,10,14,0.88)',
                border: `1px solid ${agent.color}55`,
                color: agent.color,
                fontSize: 10,
                fontFamily: 'var(--font-geist-sans), sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {agent.name} · {agent.short}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ─── Player + Companion markers (photo/scene integration lives in Systems phase) ──

function PlayerMarker({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.62, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <Html center distanceFactor={11} position={[0, 1.7, 0]}>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 7,
            background: 'rgba(8,10,14,0.88)',
            border: `1px solid ${color}66`,
            color,
            fontSize: 10,
            fontFamily: 'var(--font-geist-sans), sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── Photo capture (R3F-owned: render target → PNG download) ───────────────

type CaptureFn = () => Promise<{ width: number; height: number }>;

const PHOTO_MAX_MEGAPIXELS = 8.3;

function CaptureBridge({ registerRef }: { registerRef?: OfficeCaptureRef }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!registerRef) return;
    const capture: CaptureFn = async () => {
      const srcW = gl.domElement.width;
      const srcH = gl.domElement.height;
      const scale = Math.min(1, Math.sqrt((PHOTO_MAX_MEGAPIXELS * 1_000_000) / (srcW * srcH)));
      const w = Math.max(1, Math.floor(srcW * scale));
      const h = Math.max(1, Math.floor(srcH * scale));

      const target = new THREE.WebGLRenderTarget(w, h);
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const prevTarget = gl.getRenderTarget();
      const buffer = new Uint8Array(w * h * 4);
      try {
        gl.setRenderTarget(target);
        gl.render(scene, camera);
        gl.setRenderTarget(prevTarget);
        gl.readRenderTargetPixels(target, 0, 0, w, h, buffer);
      } finally {
        gl.setRenderTarget(prevTarget);
        target.dispose();
      }

      // readRenderTargetPixels is bottom-up; flip rows for a 2D canvas.
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('2D canvas unavailable for capture');
      const image = ctx.createImageData(w, h);
      const rowBytes = w * 4;
      for (let y = 0; y < h; y++) {
        const src = (h - 1 - y) * rowBytes;
        image.data.set(buffer.subarray(src, src + rowBytes), y * rowBytes);
      }
      ctx.putImageData(image, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kantor-raffa-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { width: w, height: h };
    };
    registerRef.current = capture;
    return () => {
      if (registerRef.current === capture) registerRef.current = null;
    };
  }, [gl, scene, camera, registerRef]);

  return null;
}

// ─── Canvas root ────────────────────────────────────────────────────────────

export type OfficeCaptureRef = { current: CaptureFn | null };

export interface OfficeCanvasProps {
  /** Paper equity percent for the wallboard (from the v2 ledger). */
  equityPct: number;
  onClose?: () => void;
  /** Receives the R3F PNG capture function while mounted; cleared on unmount. */
  captureRef?: OfficeCaptureRef;
}

export default function OfficeCanvas({ equityPct, captureRef }: OfficeCanvasProps) {
  const { palette } = useWibPhase();
  const shadows = true;
  const dpr: [number, number] = [1, 1.5];

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      camera={{ position: [CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z], fov: 50, zoom: 1 }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      className="pointer-events-none"
    >
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 18, 90]} />
      <SceneLighting palette={palette} shadows={shadows} />
      <Sparkles count={palette.cityGlow > 0.5 ? 100 : 30} scale={[110, 60, 110]} position={[0, 18, -30]} size={2} speed={0.35} opacity={palette.cityGlow > 0.5 ? 0.9 : 0.25} color="#cbd5ff" />
      {palette.cityGlow <= 0.5 && (
        <Sky turbidity={8} rayleigh={palette.cityGlow > 0 ? 2 : 1} sunPosition={palette.keyPosition} mieCoefficient={0.005} mieDirectionalG={0.85} />
      )}
      <Architecture palette={palette} />
      <Desks />
      <Wallboard equity={equityPct} />
      <CaptureBridge registerRef={captureRef} />
      <PlayerMarker position={[BOSS.spawn.x, 0, BOSS.spawn.z]} color={BOSS.color} label="Bos Raffa 👑" />
      <PlayerMarker position={[BOSS.spawn.x + 1.25, 0, BOSS.spawn.z + 0.6]} color="#f43f5e" label="Khansaku 💖" />
      {/* keep pointer events off the canvas surface; the DOM overlay owns input */}
      <mesh position={[0, -10, 0]} visible={false}>
        <boxGeometry />
        <meshBasicMaterial />
      </mesh>
    </Canvas>
  );
}