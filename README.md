<p align="center"><img src="dashboard/client/public/brand/limap-logo.svg" alt="LiMap logo: a lotus" width="96"></p>

# LiMap: adaptive variable-resolution 2.5D LiDAR mapping

LiMap turns a LiDAR scan into a **2.5D grid with fine cells near the vehicle and coarse cells far away**, held in a
fixed-size memory pool. It was built for problem statement SIH26053 (DRDO): mapping dynamic environments for an
unmanned ground vehicle.

This repository holds the perception pipeline (`core/`), its benchmarks (`benchmark/`), and a dashboard
(`dashboard/`) that shows the pipeline's output and the evidence behind it.

**Take the tour.** The site opens on a home screen; **Open the dashboard** goes to `/dashboard/`. The dashboard has a
15-step guided tour of every feature: click **Take the tour** in its header, or open `/dashboard/?tour=1`. Small **?**
icons next to the tools explain each one on hover. See [docs/DEMO_RECORDING.md](docs/DEMO_RECORDING.md).

## Run the dashboard

```bash
cd dashboard/client
npm ci
npm run dev            # home screen at http://localhost:3000, dashboard at http://localhost:3000/dashboard/
```

It works with **no backend**: every scene is served from precomputed snapshots committed under
`dashboard/client/public/data/`. A live API is an optional upgrade; to run it, from the repository root:

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # use .venv/bin on Linux and macOS
npm run server         # FastAPI on http://127.0.0.1:8000
```

After `npm run build`, that server also serves the built site itself (home at `/`, dashboard at `/dashboard/`), so one
process is enough on a demo machine.

With the server running, **Analyze your own scan** (top left of the 3D view) takes a SemanticKITTI / Velodyne `.bin` file,
runs it through the same grid code as the snapshots and shows it as a "Your scan" scene, with the analysis time measured
on that run. It needs the local API (the button is disabled without it), keeps the scan in memory only, and labels it with
the geometric heuristic unless an ONNX model is present. See `docs/reference/KNOWN_LIMITATIONS.md` section 11.

Production build and preview: `npm run build && npm run preview` (from the repository root, or inside
`dashboard/client`). The build fails on retired claims, retyped benchmark numbers and hard-coded colours; see
[dashboard/client/README.md](dashboard/client/README.md).

## What the dashboard shows

| View | Contents |
|---|---|
| **3D Explore** | The grid cells and raw returns the pipeline produced for a scan, coloured by height, class, resolution ring or Welford variance. **Fly under the bridge** is a one-click camera shot along the route the planner found through the underpass. A hand-built concept view is kept, labelled as an illustration. |
| **Map Inspector** | A map of every cell, top-down or isometric. Click a cell for its ring, class, point count, height statistics and overhang clearance. Switch foveation presets to watch the fine zone shift, or compare the same scan on a uniform 5 cm grid. **Underpass** shows the bridge scan as two costmaps, from a one-height grid and from the 2.5D grid, with what the planner did with each. |
| **Evidence** | Memory, fidelity by ring, segmentation by distance, speed, moving-object filtering and planner regret, each read from `benchmark/*.json` with its checksum and tagged MEASURED, CALCULATED or DATASET. Ends with what the dashboard does *not* show. |

Every number on screen is read from data (a snapshot, the API or a results file). Synthetic scenes, the concept view and
the sparse real sample are labelled wherever they appear. The real scene here is a 5,000-point sample of a
SemanticKITTI scan, because the full frames and the segmentation model are not stored in the repository.

## Repository map

| Path | What it is |
|---|---|
| `core/` | The pipeline: ingestion, grid (nested lattice, spatial hash, foveation controller), perception, tracking, planning bridge |
| `benchmark/` | Scripts and result files for every measured number (fidelity, latency, segmentation, moving objects, planner regret) |
| `dashboard/client/` | The React + Three.js dashboard. Start with its [README](dashboard/client/README.md) |
| `dashboard/server/` | FastAPI server for the optional live API |
| `scripts/export_dashboard_data.py` | Runs the real pipeline offline and writes the dashboard's static snapshots; `--check` fails if they are stale |
| `docs/` | Roadmap, progress log, audits, known limitations, [variant data](docs/DATA_VARIANTS.md), [demo recording](docs/DEMO_RECORDING.md) |
| `ARCHITECTURE.md` | Technical architecture of the pipeline |

## Checks

```bash
.venv/Scripts/python -m pytest dashboard/server/tests -q           # API and exporter tests
.venv/Scripts/python scripts/export_dashboard_data.py --check      # committed snapshots match the pipeline
cd dashboard/client && npm run build                                # type check, token guard, honesty guard
cd dashboard/client && npx playwright test                          # browser tests (slow without a GPU)
```

## Scope and limits

Stated in [docs/reference/KNOWN_LIMITATIONS.md](docs/reference/KNOWN_LIMITATIONS.md) and on the Evidence page. In short:
everything runs on a CPU, scans are processed one at a time rather than as a live stream, nothing has been run on an
embedded board, and the foveation controller uses speed and turn presets (hazard-driven foveation is planned).
