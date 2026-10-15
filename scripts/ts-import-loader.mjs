/**
 * Minimal Node ESM loader that lets plain `node` import this repo's TypeScript
 * engine sources without tsc, ts-node, a bundler, or a duplicate JS copy.
 *
 * Why this exists: `node --experimental-strip-types` only removes types — it still
 * cannot resolve this codebase's extensionless (`./constants`) or `./x.js`
 * specifiers, so a bare `node scripts/verify-movement.mjs` fails with
 * ERR_MODULE_NOT_FOUND. This loader closes that gap:
 *
 *   1. resolve: relative specifiers that omit an extension, or that use a `.js`
 *      suffix for a `.ts` file, are re-pointed at the real `.ts` file.
 *   2. load: `.ts` sources are stripped with `node:module`'s
 *      `stripTypeScriptTypes()` and returned as ESM.
 *
 * Bare specifiers (`three`, `next/server`, `node:*`) are left untouched so Node
 * resolves them normally from node_modules. Dependency-free by design.
 */
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const TS_FILE = /\.(?:ts|tsx|mts|cts)$/;
const RELATIVE = /^\.{1,2}\//;
const JS_SUFFIX = /\.(?:js|mjs|cjs)$/;

export async function resolve(specifier, context, nextResolve) {
  if (RELATIVE.test(specifier) && !TS_FILE.test(specifier)) {
    const candidates = [
      specifier.replace(JS_SUFFIX, '') + '.ts',
      specifier.replace(JS_SUFFIX, '') + '.tsx',
      specifier + '.ts',
      specifier + '.tsx',
      specifier + '/index.ts',
      specifier + '/index.tsx',
    ];
    for (const candidate of candidates) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // not this candidate — fall through to the next one
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && TS_FILE.test(new URL(url).pathname)) {
    const source = readFileSync(new URL(url), 'utf8');
    return {
      format: 'module',
      shortCircuit: true,
      source: stripTypeScriptTypes(source, { mode: 'strip' }),
    };
  }
  return nextLoad(url, context);
}
