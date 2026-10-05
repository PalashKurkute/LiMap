# Changelog

One line per milestone, newest last. Add a line in the same commit as any merged feature. Detail lives in git
(`git show <commit>`); the full pre-2026-10-05 progress log is at tag `docs-before-consolidation` (`docs/progress_log.md`).

| Date | Commit | Milestone | Evidence |
|---|---|---|---|
| 2026-09-26 | 727a297 | Architecture, problem context, competitive audit and agent skills written | — |
| 2026-09-26 | 77f0968 | Core: concentric ring lattice, 32-byte spatial hash, dual-elevation overhang handling | `core/grid/` |
| 2026-09-26 | 43cd5a5 | First React + Three.js telemetry dashboard | `dashboard/client` |
| 2026-09-27 | ede2c83 | Anti-fabrication overhaul after the first skeptical audit; real-dataset benchmark started | — |
| 2026-09-27 | 22c2fda | ROS 2 costmap bridge, package and tests (publisher only) | `core/planning/nav2_bridge.py` |
| 2026-09-27 | 8fd750d | Pretrained SalsaNext ONNX integrated and benchmarked on SemanticKITTI seq 08 | `real_miou_results.json` |
| 2026-09-27 | 256f265 | Semantic-gated moving-object filter, precision/recall with ego-turn check | `real_dynamic_mos_results.json` |
| 2026-09-27 | dd7d3e4 | Planner regret and Fréchet distance on real frames | `real_regret_results.json` |
| 2026-09-27 | a6c0e23 | Edge profiling suite; pre-optimisation baseline 4,069 ms end to end | `edge_hardware_profile.json` |
| 2026-09-28 | cc77383 | Roadmap P1-P4: latency profile (grid + costmap median 57.9 ms), fidelity study, MOS by band script, full-sequence script | `latency_profile_results.json`, `fidelity_study_results.json` |
| 2026-09-28 | 04a4733 | P5 speed/turn foveation presets; P6 Kalman update written (only a test calls it) | `core/grid/fovea_controller.py` |
| 2026-09-29 | 1ceec88 | Vercel deployment config; prototype renamed LiMap | `vercel.json` |
| 2026-10-03 | 8c7135f | External integrity audit and research notes (C1-C6, H1-H12) | `docs/reference/KNOWN_LIMITATIONS.md` §12, `docs/research/` |
| 2026-10-04 | 4a1397d | UI overhaul: fabricated and stale claims removed, honesty and colour-token build guards | `dashboard/client/scripts/` |
| 2026-10-04 | 3396744 | Static snapshot exporter (`--check`), so the dashboard needs no backend | `scripts/export_dashboard_data.py` |
| 2026-10-04 | 2527ce3 | Evidence page reading `benchmark/*.json`; 3D view draws pipeline output | `dashboard/client/src/features/evidence` |
| 2026-10-04 | 52d3500 | Foveation-preset and uniform 5 cm variant snapshots | `docs/DATA_VARIANTS.md` |
| 2026-10-05 | e126a33 | Guided tour, isometric inspector, preset and uniform comparison | — |
| 2026-10-05 | 09f5ad6 | Underpass comparison (one-height vs 2.5D costmap) and fly-through along the planner route | `public/data/planner/` |
| 2026-10-05 | 44e24a0 | Polish and accessibility pass (landmarks, badge contrast, axe-clean states) | `e2e/quality.spec.ts` |
| 2026-10-05 | 03e1207 | Tour cut from 40 to 15 grouped steps; no jump to the centre between steps | `src/tour/` |
| 2026-10-05 | de5984c | Home screen at `/`, dashboard at `/dashboard/`, "?" help icons, first logo | `src/home/`, `src/help/` |
| 2026-10-05 | e6477b2 | API server serves the built two-page site | `dashboard/server/app.py` |
| 2026-10-05 | 70856d0 | "How it fits a robot" section on the home screen | `src/home/RobotFit.tsx` |
| 2026-10-05 | 9d1668d | Analyze your own scan: `POST /api/analyze_scan` and the "Your scan" scene | `dashboard/server/tests/test_analyze_scan.py` |
| 2026-10-05 | — | New logo: LiDAR-scanning vehicle over a 2.5D height grid, light and dark SVGs (replaces the lotus) | `public/brand/` |
| 2026-10-05 | — | Docs consolidated into one reference set, plan and changelog; docs check added (`npm run check:docs`) | `docs/README.md` |

**Audit trail.** Sep 27 - Oct 3: skeptical-judge audit, three follow-up audits, round 4 and 5 fixes, checkpoint audits,
pre-pitch audit, frontend audit, external integrity audit. They were folded into `KNOWN_LIMITATIONS.md` and
`IMPLEMENTATION_PLAN.md` on 2026-10-05; the originals are at tag `docs-before-consolidation` under `docs/audit/`,
`docs/plans/`, `docs/reports/` and `reports/`.
