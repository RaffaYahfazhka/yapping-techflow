'use client';

import React, { Component, Suspense } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import type { ModelManifestEntry } from '@/lib/data/modelManifest';

interface GlbModelProps {
  entry: ModelManifestEntry;
  position?: [number, number, number];
  rotation?: [number, number, number] | number;
  scale?: [number, number, number] | number;
  onClick?: () => void;
}

class GlbErrorBoundary extends Component<
  { fallbackLabel: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallbackLabel: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      // Accessible non-3D fallback indicator — never render fake visible procedural meshes!
      return (
        <Html center>
          <div
            role="status"
            aria-label={this.props.fallbackLabel}
            className="rounded-lg border border-amber-500/40 bg-black/85 px-2.5 py-1 text-center font-mono text-[10px] text-amber-300 shadow-md backdrop-blur-sm pointer-events-none select-none"
          >
            <span>{this.props.fallbackLabel}</span>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function GlbSceneObject({
  path,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  onClick,
}: {
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number] | number;
  scale?: [number, number, number] | number;
  onClick?: () => void;
}) {
  const gltf = useGLTF(path);
  const rotArr: [number, number, number] =
    typeof rotation === 'number' ? [0, rotation, 0] : rotation;
  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <primitive
      object={gltf.scene.clone()}
      position={position}
      rotation={rotArr}
      scale={scaleArr}
      onClick={onClick}
    />
  );
}

export default function GlbModel({
  entry,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  onClick,
}: GlbModelProps) {
  return (
    <GlbErrorBoundary fallbackLabel={entry.fallbackAriaLabel}>
      <Suspense
        fallback={
          <Html center>
            <div
              role="status"
              aria-label={`Memuat ${entry.name}...`}
              className="rounded bg-black/70 px-2 py-0.5 text-[9px] text-zinc-400 select-none"
            >
              Memuat...
            </div>
          </Html>
        }
      >
        <GlbSceneObject
          path={entry.path}
          position={position}
          rotation={rotation}
          scale={scale}
          onClick={onClick}
        />
      </Suspense>
    </GlbErrorBoundary>
  );
}
