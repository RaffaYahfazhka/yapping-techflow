/**
 * cn - Cult UI-compatible class-merging helper (clsx + tailwind-merge).
 * Imported by the shiv primitives below; use everywhere to compose Tailwind classes.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}