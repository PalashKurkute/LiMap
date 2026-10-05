# Docs: index and upkeep

## Index
| Doc | What it is for |
|---|---|
| [../README.md](../README.md) | The product, how to run it, the checks |
| [../AGENTS.md](../AGENTS.md) | Rules for contributors and AI agents (`CLAUDE.md` imports it; `.agents/` points to it) |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | The design; section 6 is what is built today |
| [reference/PROBLEM_STATEMENT.md](reference/PROBLEM_STATEMENT.md) | SIH26053 word for word, the SIH process, operating context, sensors, datasets |
| [reference/STANDARDS_TO_BEAT.md](reference/STANDARDS_TO_BEAT.md) | The bar set by the best public entries, with our status per row |
| [reference/COMPETITORS.md](reference/COMPETITORS.md) | Rival repositories and their self-reported claims, dated |
| [reference/KNOWN_LIMITATIONS.md](reference/KNOWN_LIMITATIONS.md) | What is not done, every figure with its results file, and the open audit findings (§12) |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Original blueprint, roadmap P1-P15 with status, next steps, rules of engagement |
| [CHANGELOG.md](CHANGELOG.md) | One line per milestone |
| [DEMO_RECORDING.md](DEMO_RECORDING.md) | Recording setup, the 15 tour steps, the video script, judge Q&A |
| [DATA_VARIANTS.md](DATA_VARIANTS.md) | Format of the preset, uniform and planner snapshot files |
| [research/](research/) | Literature and benchmark notes with sources: mapping baselines, perception and MOS, deployment and datasets |
| [../dashboard/client/README.md](../dashboard/client/README.md) | Dashboard developer guide: structure, tour, help, honesty rules, tests |

## Keeping the docs current

**One home per fact; link, don't copy.**
- Numbers: `benchmark/*.json` (shown on the Evidence page). Quote them with the file name; never retype a different value.
- Limits and open issues: `reference/KNOWN_LIMITATIONS.md`. Plan status: `IMPLEMENTATION_PLAN.md`.
- Product behaviour: `../README.md` and the dashboard README. History: git and `CHANGELOG.md`.

**Update in the same commit when:**
| This changes | Update |
|---|---|
| A results file in `benchmark/` | KNOWN_LIMITATIONS figures, the plan's status column, the judge Q&A in DEMO_RECORDING if it quotes it |
| A capability is added or removed | KNOWN_LIMITATIONS, ARCHITECTURE section 6, the plan status |
| A UI feature or tour step | README, dashboard README, DEMO_RECORDING (step table and script) |
| A rival is re-checked | COMPETITORS (re-date the row), STANDARDS_TO_BEAT status if affected |
| Any merged feature | One line in CHANGELOG |

**At each milestone and before judging:**
1. `npm run check:docs` (links, banned phrases, retired figures, size budgets).
2. Compare KNOWN_LIMITATIONS with the Evidence page; fix any number that differs.
3. Refresh the plan's status column and the open audit findings (KNOWN_LIMITATIONS §12).
4. Re-check and re-date the rivals that matter.
5. Keep CHANGELOG to milestones, one line each.

**Size.** Budgets live at the top of `scripts/check-docs.mjs` (about 4 bytes per token). `AGENTS.md` loads into every
agent session, so it stays near 1.5k tokens. When a doc outgrows its budget, compress it; do not split it into a new file.
A new doc needs a row in the index above and a budget in the script.

**Style.** Date snapshot facts ("as of 2026-10-03"), name the source file for every number, label figures MEASURED,
CALCULATED or DATASET, one topic per file, plain short sentences.

## Old docs

Everything that existed before 2026-10-05 is kept at git tag `docs-before-consolidation`:
`git show docs-before-consolidation:<old path>` (or browse the tag on GitHub).

| Old path | Now in |
|---|---|
| `docs/reference/PROBLEM_STATEMENT_CONTEXT.md` | `reference/PROBLEM_STATEMENT.md` |
| `docs/reference/SIH26053_Standards_To_Beat.md` | `reference/STANDARDS_TO_BEAT.md` |
| `docs/reference/Competitive_Audit_And_Architecture_Comparison.md`, `docs/competitive_matrix.md` | `reference/COMPETITORS.md` (wrong claims dropped, see KNOWN_LIMITATIONS §12 C5) |
| `research_notes/.../sih_statement_and_competitors.md` | `reference/PROBLEM_STATEMENT.md` (Q1-Q2), `reference/COMPETITORS.md` (Q3-Q4) |
| `research_notes/.../{mapping_baselines_sota,perception_mos_benchmarks,deployment_datasets_robustness}.md` | `research/` (unchanged) |
| `reports/LiMap SIH26053 external benchmarks.md` | KNOWN_LIMITATIONS §12 (findings), IMPLEMENTATION_PLAN C (gap matrix, finale plan), COMPETITORS (positioning) |
| `docs/ROADMAP.md`, `docs/archive/ROADMAP.md` | `IMPLEMENTATION_PLAN.md` (B and A) |
| `docs/plans/*` (brief, FPS plan, fix plan, round 3, phase 4, frontend plan, PPT content plan) | `IMPLEMENTATION_PLAN.md` (rules, outcomes, open items); PPT Q&A refreshed in `DEMO_RECORDING.md` |
| `docs/perception_upgrade_plan.md` | `IMPLEMENTATION_PLAN.md` C |
| `docs/master_task_tracker.md` | History only (every item done) |
| `docs/audit/*`, `docs/reports/checkpoint_report_A.md` | Open findings in KNOWN_LIMITATIONS (§5, §12) and IMPLEMENTATION_PLAN C; the rest is history |
| `docs/progress_log.md` | `CHANGELOG.md` |
| `benchmark/BENCHMARK_REPORT.md` (+ `generate_report.py`) | Removed: its figures contradicted the results files; the Evidence page reads `benchmark/*.json` |
| `dashboard/client/e2e/PARITY.md`, `e2e/__baseline__/` | Removed: pre-redesign checklist and screenshots |
| `dashboard/client/parked-upstream/` | Removed: unused code (commits 097298d..3634111) |
| `.agents/AGENTS.md`, `.agents/skills/{claude_council,ui_ux_pro_max}` | `../AGENTS.md` (kept rules); the two skills described a product that does not exist |
