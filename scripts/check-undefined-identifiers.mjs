#!/usr/bin/env node
// Build gate: fail if FRONTEND code has any TS2304 ("Cannot find name") errors.
//
// A TS2304 in React code is a guaranteed runtime ReferenceError. `vite build`
// (esbuild) does not type-check, so one shipped on 2026-09-03 — frontend/App.tsx
// passed an undefined `toggleGraph` to <CoverageMapPage>, which threw at render
// and, with no ErrorBoundary, blanked the entire app on /coverage and /graphs.
//
// The repo carries other, pre-existing type errors (run `npm run typecheck`), so
// this gate is deliberately scoped to that one class and to the code vite bundles.
import { spawnSync } from 'node:child_process';

const BUNDLED_PREFIXES = ['frontend/', 'shared/', 'index.tsx'];

const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const out = `${res.stdout || ''}${res.stderr || ''}`;

const hits = out
  .split('\n')
  .filter((line) => /error TS2304/.test(line) && BUNDLED_PREFIXES.some((p) => line.startsWith(p)));

if (hits.length) {
  console.error(`\n✖ ${hits.length} undefined identifier(s) in bundled frontend code (TS2304) — these throw at runtime:\n`);
  for (const h of hits) console.error(`  ${h}`);
  console.error('\nFix these before building. Run `npm run typecheck` for the full list of type errors.\n');
  process.exit(1);
}

console.log('✓ check:undefined — no TS2304 errors in frontend/, shared/, index.tsx');
