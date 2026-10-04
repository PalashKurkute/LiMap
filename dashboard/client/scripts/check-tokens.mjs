#!/usr/bin/env node
// Theme guard: components must use semantic tokens, never raw colours, so the light/dark toggle
// reaches every surface. Fails the build on:
//   - hex colours, rgb()/hsl()/oklch() literals
//   - Three.js 0xRRGGBB colours
//   - Tailwind palette utilities (bg-slate-900, text-white, ...)
//   - a filled bg-accent used as a fixed dark panel is NOT flagged here (see PANEL rule in README of theme/)
// Allow-list: theme/tokens.css (the source of truth) and theme/colormaps.ts (data colours).
// Escape hatch: add `// theme-guard-ignore-next-line <reason>` on the line above.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = join(root, 'src');
const ALLOW = new Set(['theme/tokens.css', 'theme/colormaps.ts'].map((p) => p.split('/').join(sep)));

const FAMS = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RULES = [
  [/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b(?![\w-])/, 'hex colour literal'],
  [/\b0x[0-9a-fA-F]{6}\b/, 'Three.js hex colour'],
  [/\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/, 'colour function literal'],
  [new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|caret|decoration|shadow|placeholder)-(${FAMS})-\\d{2,3}\\b`), 'Tailwind palette utility'],
  [/(?<![\w-])(?:[a-z0-9-]+:)*(bg|text|border|ring|fill|stroke|accent|caret|decoration|placeholder)-(white|black)\b/, 'bg/text-white|black utility'],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'assets' || name === '__tests__') continue;
      walk(p, out);
    } else if (['.ts', '.tsx', '.css'].includes(extname(p))) out.push(p);
  }
  return out;
}

let violations = 0;
const report = process.argv.includes('--report-only');
for (const file of walk(src)) {
  const rel = relative(src, file);
  if (ALLOW.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (i > 0 && /theme-guard-ignore-next-line/.test(lines[i - 1])) return;
    // ignore pure comment lines
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const [re, why] of RULES) {
      const m = re.exec(line);
      if (m) {
        console.error(`${rel}:${i + 1}  ${why}: ${m[0]}`);
        violations++;
        break;
      }
    }
  });
}

if (violations) {
  console.error(`\ncheck-tokens: ${violations} violation(s)${report ? ' (report-only)' : ''}`);
  process.exit(report ? 0 : 1);
}
console.log('check-tokens: ok');
