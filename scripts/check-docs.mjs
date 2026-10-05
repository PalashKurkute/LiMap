#!/usr/bin/env node
/**
 * Docs check (`npm run check:docs`): keeps the Markdown docs linked, honest and small.
 *   1. every relative link in a tracked .md file resolves;
 *   2. banned phrases stay out of product docs;
 *   3. retired (wrong) figures stay out of every doc;
 *   4. each file stays within its byte budget (about 4 bytes per token).
 * Edit the tables below when a doc is added or its budget changes (see docs/README.md). Not part of `npm run build`,
 * so a docs slip never blocks a demo build.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const KB = 1024;
const BUDGETS = {
  'README.md': 9 * KB,
  'AGENTS.md': 6 * KB,
  'CLAUDE.md': 1 * KB,
  'ARCHITECTURE.md': 22 * KB,
  'docs/README.md': 9 * KB,
  'docs/CHANGELOG.md': 7 * KB,
  'docs/IMPLEMENTATION_PLAN.md': 20 * KB,
  'docs/DEMO_RECORDING.md': 16 * KB,
  'docs/DATA_VARIANTS.md': 11 * KB,
  'docs/reference/PROBLEM_STATEMENT.md': 12 * KB,
  'docs/reference/STANDARDS_TO_BEAT.md': 16 * KB,
  'docs/reference/COMPETITORS.md': 30 * KB,
  'docs/reference/KNOWN_LIMITATIONS.md': 16 * KB,
  'dashboard/client/README.md': 16 * KB,
};
const RESEARCH_BUDGET = 40 * KB; // docs/research/*.md: cited literature, never trimmed of sources
const DEFAULT_BUDGET = 8 * KB;

// Phrases the project retired; rival and standards docs may quote others, research notes quote the literature.
const BANNED = ['DRDO bound', 'provably', 'PROVED', 'near-zero regret', '5/5 stress'];
const BANNED_EXEMPT = [/^AGENTS\.md$/, /^docs\/IMPLEMENTATION_PLAN\.md$/,/^docs\/research\//, /^docs\/reference\/COMPETITORS\.md$/, /^docs\/reference\/STANDARDS_TO_BEAT\.md$/];
// Figures that were wrong or superseded (see docs/reference/KNOWN_LIMITATIONS.md); quote benchmark/*.json instead.
const RETIRED = ['323.74', '84.83', '3.42 MB', '61.75', '65 frames'];
const RETIRED_EXEMPT = [/^docs\/research\//];

const root = execSync('git rev-parse --show-toplevel').toString().trim();
const files = execSync('git ls-files -co --exclude-standard "*.md"', { cwd: root })
  .toString()
  .split('\n')
  .filter((f) => f && !f.includes('node_modules/') && existsSync(path.join(root, f)));

const problems = [];
let bytes = 0;
const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<((?:\.{0,2}\/)?[\w./-]+\.(?:md|json|py|ts|tsx|mjs|svg|png))>/g;

for (const f of files) {
  const text = readFileSync(path.join(root, f), 'utf8');
  const size = statSync(path.join(root, f)).size;
  bytes += size;
  const budget = BUDGETS[f] ?? (f.startsWith('docs/research/') ? RESEARCH_BUDGET : DEFAULT_BUDGET);
  if (size > budget) problems.push(`${f}: ${(size / KB).toFixed(1)} KB is over its ${budget / KB} KB budget (compress it)`);

  const prose = text.replace(/```[\s\S]*?```/g, '');
  for (const m of prose.matchAll(linkRe)) {
    let target = m[1] ?? m[2];
    if (/^(https?:|mailto:|file:|#)/.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]);
    if (!target) continue;
    const resolved = target.startsWith('/') ? path.join(root, target) : path.join(root, path.dirname(f), target);
    if (!existsSync(resolved)) problems.push(`${f}: broken link -> ${target}`);
  }

  if (!BANNED_EXEMPT.some((re) => re.test(f))) {
    for (const phrase of BANNED) {
      if (prose.toLowerCase().includes(phrase.toLowerCase())) problems.push(`${f}: banned phrase "${phrase}"`);
    }
  }
  if (!RETIRED_EXEMPT.some((re) => re.test(f))) {
    for (const fig of RETIRED) if (prose.includes(fig)) problems.push(`${f}: retired figure "${fig}" (quote benchmark/*.json)`);
  }
}

if (problems.length) {
  console.error(`check-docs: ${problems.length} problem(s)\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-docs: ok (${files.length} files, ${(bytes / KB).toFixed(0)} KB, about ${Math.round(bytes / 4 / 1000)}k tokens)`);
