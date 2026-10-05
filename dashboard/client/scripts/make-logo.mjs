#!/usr/bin/env node
// Writes the LiMap logo as static SVG files (favicon and README logo) from the same petal numbers that
// src/brand/LogoMark.tsx uses. Run it after changing the petals: `node scripts/make-logo.mjs`.
//
// The mark is a lotus. Each petal row is a height layer of the 2.5D grid, the rows open outward like the resolution rings
// (fine near the centre, coarse far away), the green leaves and water line stand for the ground, and the small dot at
// the base is the vehicle. The static files use literal colours (they live outside src/, so outside the token guard) and
// switch with the viewer's colour scheme.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// Keep in step with PETALS in src/brand/LogoMark.tsx.
const BASE = { x: 32, y: 49 };
const PETALS = [
  { tone: 'leaf', angle: -82, len: 20, wid: 8 },
  { tone: 'leaf', angle: 82, len: 20, wid: 8 },
  { tone: 'outer', angle: -56, len: 27, wid: 11 },
  { tone: 'outer', angle: 56, len: 27, wid: 11 },
  { tone: 'mid', angle: -28, len: 30, wid: 11 },
  { tone: 'mid', angle: 28, len: 30, wid: 11 },
  { tone: 'centre', angle: 0, len: 32, wid: 11.5 },
];

const n = (v) => +v.toFixed(2);
const petal = (len, wid) =>
  `M0 0C${n(-wid * 0.9)} ${n(-len * 0.25)} ${n(-wid * 0.55)} ${n(-len * 0.75)} 0 ${-len}C${n(wid * 0.55)} ${n(-len * 0.75)} ${n(wid * 0.9)} ${n(-len * 0.25)} 0 0Z`;

const petals = PETALS.map(
  (p) => `<path class="${p.tone}" transform="translate(${BASE.x} ${BASE.y}) rotate(${p.angle})" d="${petal(p.len, p.wid)}"/>`,
).join('\n    ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="LiMap">
  <style>
    .leaf { fill: #138808 } .outer { fill: #e8730c } .mid { fill: #f7a65a } .centre { fill: #fff1de }
    path { stroke: #ffffff; stroke-width: .7; stroke-linejoin: round }
    .water { fill: none; stroke: #138808; stroke-width: 2.4; stroke-linecap: round }
    .dot { fill: #0e7490; stroke: #ffffff; stroke-width: .8 }
    @media (prefers-color-scheme: dark) {
      .leaf { fill: #2fae4a } .outer { fill: #ff9933 } .mid { fill: #ffb866 } .centre { fill: #ffe9c9 }
      path { stroke: #111827 }
      .water { stroke: #2fae4a }
      .dot { fill: #22d3ee; stroke: #111827 }
    }
  </style>
  <g>
    ${petals}
  </g>
  <path class="water" d="M9 51.5Q20.5 47.5 32 51.5T55 51.5"/>
  <circle class="dot" cx="${BASE.x}" cy="${BASE.y + 0.5}" r="2.7"/>
</svg>
`;

mkdirSync(join(root, 'public', 'brand'), { recursive: true });
writeFileSync(join(root, 'public', 'favicon.svg'), svg);
writeFileSync(join(root, 'public', 'brand', 'limap-logo.svg'), svg);
console.log('wrote public/favicon.svg and public/brand/limap-logo.svg');
