#!/usr/bin/env node
// Fails if fabricated / stale claims or retyped benchmark numbers appear in the source or the built bundle.
// Numbers must come from results files or API responses, never from literals in components.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const BANNED = [
  [/DRDO\s+(BOUND|requirement|threshold|limit)/i, 'DRDO published no thresholds'],
  [/\bPROVED\b/, 'unproven "PROVED" claim'],
  [/O\(1\)\s*bound/i, '"O(1) Bound" claim'],
  [/\b5\/5 (VERIFIED|PASSED)|ALL \d+ CRITERIA VERIFIED/i, 'blanket verification claim'],
  [/SAFE TO PASS/i, 'unmeasured pass/fail claim'],
  [/\bBayesian\b/i, 'the code uses Welford variance, not Bayesian fusion'],
  [/Kalman fusion/i, 'Kalman fusion is not implemented in the pipeline'],
  [/\(MOCK\)/, 'mock value shown'],
  [/collision-free/i, 'the hand-built path is an illustration, not planner output'],
  [/Kalman motion prediction/i, 'there is no Kalman motion prediction in the pipeline'],
  [/guarantee[sd]?/i, 'no guarantees are claimed'],
];

// Code that writes user-facing numbers from data must not type them: in these folders a literal like "12 MB",
// "3 FPS", "40 ms", "2.1x" or "99.5%" in a line of code is almost certainly a retyped measurement.
const DATA_ONLY_DIRS = [join('src', 'tour'), join('src', 'features', 'inspector')];
const UNIT_LITERAL = /\d[\d,]*(?:\.\d+)?\s?(?:MB|FPS|ms|×)|\d+\.\d+\s?%/;

// Benchmark numbers that must never be retyped in source (they live in benchmark/*.json).
const STALE = [
  '40.2 FPS', '40.3', '24.8 ms', '99.89', '1,899', '9,335', '41.81', '123,389', '0.04%', '3.42 MB',
  '3,051', '3051', '935.7', '122.1 MB', '58,348', '47,307', '3.94%', '0.14 m',
];

const files = [];
function walk(dir, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'assets' && dir.endsWith('src')) continue;
      walk(p, exts);
    } else if (exts.includes(extname(p))) files.push(p);
  }
}
walk(join(root, 'src'), ['.ts', '.tsx', '.css']);
walk(join(root, 'dist', 'assets'), ['.js']);
const indexHtml = join(root, 'dist', 'index.html');
if (existsSync(indexHtml)) files.push(indexHtml);

let failures = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n');
  const isBundle = f.includes(`${join('dist', 'assets')}`);
  for (const [re, why] of BANNED) {
    const m = re.exec(text);
    if (m) {
      const ln = text.slice(0, m.index).split('\n').length;
      console.error(`HONESTY  ${relative(root, f)}${isBundle ? '' : ':' + ln}  "${m[0].slice(0, 60)}" - ${why}`);
      failures++;
    }
  }
  for (const s of STALE) {
    const idx = text.indexOf(s);
    if (idx >= 0) {
      const ln = text.slice(0, idx).split('\n').length;
      console.error(`STALE    ${relative(root, f)}${isBundle ? '' : ':' + ln}  "${s}" - retyped benchmark number`);
      failures++;
    }
  }
  if (DATA_ONLY_DIRS.some((d) => relative(root, f).startsWith(d))) {
    lines.forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
      const m = UNIT_LITERAL.exec(line);
      if (m) {
        console.error(`UNIT     ${relative(root, f)}:${i + 1}  "${m[0]}" - number with a unit typed in code; read it from data`);
        failures++;
      }
    });
  }
}

if (failures) {
  console.error(`\ncheck-honesty: ${failures} violation(s)`);
  process.exit(1);
}
console.log(`check-honesty: ok (${files.length} files)`);
