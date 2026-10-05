# Agent and contributor rules: LiMap

LiMap is Team Abhedya's prototype for SIH26053 (DRDO): a LiDAR scan becomes a 2.5D grid with fine cells near the vehicle
and coarse cells far away (5/10/25/50 cm out to 10/25/50/100 m) in a fixed 3.2616 MB pool, with a ground and an overhead
height per cell. A React + Three.js dashboard shows the pipeline's output and the evidence behind it.

## Repository map
| Path | What |
|---|---|
| `core/` | Pipeline: `ingestion/`, `grid/` (lattice, spatial hash, Welford, dual elevation, foveation presets), `perception/` (SalsaNext ONNX + rule-based fallback), `tracking/` (moving objects, ghost eraser), `planning/` (costmap, Hybrid A*, ROS 2 bridge) |
| `benchmark/` | Scripts and `*.json` results: the only source of numbers |
| `dashboard/server/app.py` | FastAPI: live API, `POST /api/analyze_scan`, serves the built site |
| `dashboard/client/` | Vite multi-page app: home `/`, dashboard `/dashboard/`, tour, help; see its README |
| `scripts/export_dashboard_data.py` | Writes the dashboard's static snapshots (`--check` fails if stale) |
| `ros2_ws/` | ROS 2 package for the costmap bridge (not built with colcon yet) |
| `docs/` | Start at `docs/README.md` |

## Commands (Windows; plain `python` is not on PATH)
```bash
npm --prefix dashboard/client run lint                       # 0 errors
npm --prefix dashboard/client run build                      # tsc + colour-token guard + honesty guard
.venv/Scripts/python -m pytest dashboard/server/tests -q
.venv/Scripts/python scripts/export_dashboard_data.py --check
npm run check:docs                                           # docs links, banned phrases, retired figures, budgets
npm run server                                               # API on :8000 (serves dist/ after a build)
```
Playwright: build, `npx vite preview --port <free port>`, then `BASE_URL=http://127.0.0.1:<port> npx playwright test <spec>`.
Check which process owns a port before testing on it; heavy specs time out when other jobs load the CPU.

## Standing rules
- **Zero bluffing.** Every number shown or written comes from data (`benchmark/*.json`, a snapshot or the API), tagged
  MEASURED, CALCULATED or DATASET. Never type a figure into UI copy (`dashboard/client/scripts/check-honesty.mjs` fails
  the build). Never write "DRDO bound/requirement", "provably", "near-zero regret", or name rivals in product copy.
- **Colours** only from tokens in `src/theme/tokens.css` (`check-tokens.mjs`).
- **Snapshots** are static-first; after pipeline changes run the exporter and keep `--check` green.
- **Reduced motion** is honoured everywhere. The tour advances only on Next; app shortcuts are off while it runs.
- **Memory.** No allocation in the per-frame loop; 32-byte cells; Welford for running stats (no raw height arrays);
  ring scale factors stay whole numbers so rings nest without seams; ROS REP 103/105 frames.
- **Python.** Type-annotated, vectorised (NumPy / Numba), no per-point Python loops.
- **Git.** Short commit messages, no Co-Authored-By trailer, never force-push, never `--no-verify`.

## Before merging a change, red-team it
Overhangs and underpasses, thin poles, potholes and curbs at range, moving objects leaving ghosts, sensor dropout, memory
bound, latency, and whether every on-screen claim still matches its results file.

## Docs
Read `docs/README.md` before editing docs: it lists each doc's job, the update triggers and the size budgets.
`docs/reference/KNOWN_LIMITATIONS.md` changes in the same commit as any capability or results-file change.
