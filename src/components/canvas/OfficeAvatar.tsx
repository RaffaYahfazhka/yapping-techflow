'use client';

import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type AvatarLook = { skin: string; hair: string; shirt: string; pants: string; hairStyle?: string; accessory?: string };
export type AvatarOutfit = 'stealth-ceo' | 'casual-founder' | 'relaxed-terrace';
export type AvatarEmote = 'cheers' | 'gaze' | 'ceo-gaze' | 'sit' | 'sofa' | 'wave' | null;

export interface OfficeAvatarProps {
  name: string;
  label?: string;
  color: string;
  look: AvatarLook;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  moving?: boolean;
  typing?: boolean;
  outfit?: AvatarOutfit;
  emote?: AvatarEmote;
  companion?: boolean;
  status?: string;
  bubble?: { emoji: string; text: string } | null;
  onClick?: () => void;
  register?: (group: THREE.Group | null) => void;
}

function HairShape({ color, style }: { color: string; style?: string }) {
  const common = { color };
  if (style === 'long') return <><mesh position={[0, 1.48, -0.01]} castShadow><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial {...common} roughness={0.86} /></mesh><mesh position={[0, 1.18, -0.16]} castShadow><boxGeometry args={[0.34, 0.55, 0.14]} /><meshStandardMaterial {...common} roughness={0.86} /></mesh></>;
  if (style === 'spiky') return <mesh position={[0, 1.51, -0.01]} castShadow><coneGeometry args={[0.2, 0.25, 6]} /><meshStandardMaterial {...common} roughness={0.82} /></mesh>;
  if (style === 'buzz' || style === 'taper-fade') return <mesh position={[0, 1.45, -0.015]}><sphereGeometry args={[0.175, 12, 8]} /><meshStandardMaterial {...common} roughness={0.9} /></mesh>;
  return <mesh position={[0, 1.49, -0.02]} castShadow><boxGeometry args={[0.36, 0.17, 0.34]} /><meshStandardMaterial {...common} roughness={0.88} /></mesh>;
}

function Accessory({ type, color }: { type?: string; color: string }) {
  if (type === 'glasses' || type === 'smart-glasses') return <group position={[0, 1.36, 0.15]}><mesh position={[-0.09, 0, 0]}><torusGeometry args={[0.065, 0.012, 6, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.65} /></mesh><mesh position={[0.09, 0, 0]}><torusGeometry args={[0.065, 0.012, 6, 12]} /><meshStandardMaterial color="#94a3b8" metalness={0.65} /></mesh><mesh position={[0, 0, 0]}><boxGeometry args={[0.06, 0.015, 0.014]} /><meshStandardMaterial color="#94a3b8" /></mesh></group>;
  if (type === 'headphones' || type === 'headset') return <group position={[0, 1.4, 0]}><mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.21, 0.025, 6, 16, Math.PI]} /><meshStandardMaterial color={color} metalness={0.25} /></mesh>{[-0.19, 0.19].map((x) => <mesh key={x} position={[x, -0.03, 0]}><boxGeometry args={[0.07, 0.13, 0.09]} /><meshStandardMaterial color="#111827" /></mesh>)}</group>;
  if (type === 'beanie') return <mesh position={[0, 1.48, -0.01]}><sphereGeometry args={[0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>;
  if (type === 'tiara' || type === 'crown') return <group position={[0, 1.61, 0]}><mesh><cylinderGeometry args={[0.17, 0.2, 0.11, 6]} /><meshStandardMaterial color="#fbbf24" metalness={0.85} roughness={0.2} /></mesh><mesh position={[0, 0.075, 0]}><octahedronGeometry args={[0.06]} /><meshStandardMaterial color="#f43f5e" metalness={0.7} roughness={0.15} /></mesh></group>;
  if (type === 'smartwatch') return <mesh position={[0.29, 0.72, 0.06]}><boxGeometry args={[0.09, 0.11, 0.08]} /><meshStandardMaterial color="#fbbf24" metalness={0.8} /></mesh>;
  return null;
}

export default function OfficeAvatar({ name, label, color, look, position, rotation = 0, scale = 1, moving = false, typing = false, outfit, emote = null, companion = false, status, bubble, onClick, register }: OfficeAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const pose = useRef(0);
  const colors = useMemo(() => {
    if (outfit === 'casual-founder') return { shirt: '#9bf5c6', pants: '#111827', accessory: '#10b981' };
    if (outfit === 'relaxed-terrace') return { shirt: '#b45309', pants: '#1f2937', accessory: '#fbbf24' };
    if (outfit === 'stealth-ceo') return { shirt: '#27272a', pants: '#111827', accessory: '#fbbf24' };
    return { shirt: look.shirt, pants: look.pants, accessory: color };
  }, [outfit, look.shirt, look.pants, color]);
  useFrame(({ clock }, dt) => {
    const elapsed = clock.elapsedTime;
    pose.current += dt * (moving ? 11 : typing ? 7 : 2.2);
    if (group.current) {
      group.current.position.set(position[0], position[1] + (moving ? Math.abs(Math.sin(pose.current * 2)) * 0.025 : Math.sin(elapsed * 2) * 0.008), position[2]);
      group.current.rotation.y = rotation;
    }
    const swing = moving ? Math.sin(pose.current) * 0.42 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, swing, 12, dt);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, -swing, 12, dt);
    if (leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, typing ? -0.45 + Math.sin(pose.current) * 0.12 : emote === 'wave' ? -1.4 + Math.sin(elapsed * 8) * 0.2 : emote === 'cheers' ? -1.0 : -swing * 0.75, 10, dt);
    if (rightArm.current) rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, typing ? -0.35 + Math.cos(pose.current) * 0.12 : emote === 'wave' ? -1.4 + Math.sin(elapsed * 8) * 0.2 : emote === 'cheers' ? -1.1 : emote === 'gaze' || emote === 'ceo-gaze' ? -0.1 : -swing * 0.75, 10, dt);
    if (group.current) group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, emote === 'gaze' || emote === 'ceo-gaze' ? -0.04 : 0, 7, dt);
  });
  return <group ref={(node) => { group.current = node; register?.(node); }} position={position} rotation={[0, rotation, 0]} scale={scale} onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
    <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[0.45, 0.58, 0.28]} /><meshStandardMaterial color={colors.shirt} roughness={0.65} /></mesh>
    <mesh position={[0, 1.35, 0.01]} castShadow><boxGeometry args={[0.31, 0.35, 0.29]} /><meshStandardMaterial color={look.skin} roughness={0.72} /></mesh>
    <HairShape color={look.hair} style={look.hairStyle} />
    <mesh position={[0, 0.43, 0]} castShadow><boxGeometry args={[0.4, 0.28, 0.25]} /><meshStandardMaterial color={colors.pants} roughness={0.75} /></mesh>
    <group ref={leftLeg} position={[-0.12, 0.28, 0]}><mesh position={[0, -0.01, 0]} castShadow><boxGeometry args={[0.13, 0.48, 0.14]} /><meshStandardMaterial color={colors.pants} /></mesh><mesh position={[0, -0.25, 0.035]}><boxGeometry args={[0.15, 0.08, 0.23]} /><meshStandardMaterial color="#111827" /></mesh></group>
    <group ref={rightLeg} position={[0.12, 0.28, 0]}><mesh position={[0, -0.01, 0]} castShadow><boxGeometry args={[0.13, 0.48, 0.14]} /><meshStandardMaterial color={colors.pants} /></mesh><mesh position={[0, -0.25, 0.035]}><boxGeometry args={[0.15, 0.08, 0.23]} /><meshStandardMaterial color="#111827" /></mesh></group>
    <group ref={leftArm} position={[-0.28, 1.02, 0]}><mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.12, 0.46, 0.13]} /><meshStandardMaterial color={colors.shirt} /></mesh><mesh position={[0, -0.48, 0.015]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color={look.skin} /></mesh></group>
    <group ref={rightArm} position={[0.28, 1.02, 0]}><mesh position={[0, -0.22, 0]} castShadow><boxGeometry args={[0.12, 0.46, 0.13]} /><meshStandardMaterial color={colors.shirt} /></mesh><mesh position={[0, -0.48, 0.015]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color={look.skin} /></mesh></group>
    <Accessory type={outfit === 'stealth-ceo' ? 'smartwatch' : look.accessory} color={colors.accessory} />
    {outfit === 'relaxed-terrace' && <group position={[0, 1.34, 0.16]}><mesh position={[-0.085, 0, 0]}><boxGeometry args={[0.11, 0.035, 0.025]} /><meshStandardMaterial color="#111827" metalness={0.3} /></mesh><mesh position={[0.085, 0, 0]}><boxGeometry args={[0.11, 0.035, 0.025]} /><meshStandardMaterial color="#111827" metalness={0.3} /></mesh><mesh><boxGeometry args={[0.07, 0.018, 0.02]} /><meshStandardMaterial color="#111827" /></mesh></group>}
    {outfit === 'casual-founder' && <mesh position={[0, 1.06, 0]}><torusGeometry args={[0.2, 0.045, 6, 14, Math.PI]} /><meshStandardMaterial color={colors.shirt} /></mesh>}
    {emote === 'cheers' && <group position={[0.42, 1.28, 0.13]}><mesh><cylinderGeometry args={[0.075, 0.09, 0.13, 10]} /><meshStandardMaterial color="#f8fafc" roughness={0.25} /></mesh><mesh position={[0, 0.1, 0]}><torusGeometry args={[0.09, 0.018, 6, 12]} /><meshStandardMaterial color="#fbbf24" /></mesh></group>}
    {label && <Html center position={[0, 2.08, 0]} distanceFactor={12} style={{ pointerEvents: 'none' }}><div style={{ whiteSpace: 'nowrap', border: `1px solid ${color}77`, borderRadius: 7, background: 'rgba(8,12,20,.9)', color, padding: '3px 8px', fontSize: 10, fontFamily: 'var(--font-geist-sans),sans-serif', boxShadow: `0 0 12px ${color}28` }}>{label}</div></Html>}
    {status && <Html center position={[0, 1.86, 0]} distanceFactor={10} style={{ pointerEvents: 'none' }}><div style={{ borderRadius: 6, background: 'rgba(15,23,42,.87)', color, padding: '2px 6px', fontSize: 9, whiteSpace: 'nowrap' }}>{status}</div></Html>}
    {bubble && <Html center position={[0, 2.45, 0]} distanceFactor={10} style={{ pointerEvents: 'none' }}><div style={{ maxWidth: 220, borderRadius: 9, background: 'rgba(15,23,42,.95)', border: `1px solid ${color}55`, color: '#e2e8f0', padding: '5px 8px', fontSize: 10, lineHeight: 1.3, boxShadow: '0 4px 18px #0008' }}><span style={{ color, marginRight: 5 }}>{bubble.emoji}</span>{bubble.text}</div></Html>}
    <mesh position={[0, 0.88, 0]} visible={false}><capsuleGeometry args={[0.35, 1.2, 4, 8]} /><meshBasicMaterial /></mesh>
  </group>;
}
