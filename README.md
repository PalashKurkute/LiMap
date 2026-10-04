# LiMap: adaptive variable-resolution 2.5D LiDAR mapping

LiMap turns a LiDAR scan into a **2.5D grid with fine cells near the vehicle and coarse cells far away**, held in a
fixed-size memory pool. It was built for problem statement SIH26053 (DRDO): mapping dynamic environments for an
unmanned ground vehicle.

This repository holds the perception pipeline (`core/`), its benchmarks (`benchmark/`), and a dashboard
(`dashboard/`) that shows the pipeline's output and the evidence behind it.

**Take the tour.** The dashboard has a guided tour of every feature: click **Take the tour** in the header (or open it
with `?tour=1`). See [docs/DEMO_RECORDING.md](docs/DEMO_RECORDING.md).

## Run the dashboard

```bash
cd dashboard/client
npm ci
npm run dev            # http://localhost:3000
```

It works with **no backend**: every scene is served from precomputed snapshots committed under
`dashboard/client/public/data/`. A live API is an optional upgrade; to run it, from the repository root:

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # use .venv/bin on Linux and macOS
npm run server         # FastAPI on http://127.0.0.1:8000
```

Production build and preview: `npm run build && npm run preview` (from the repository root, or inside
`dashboard/client`). The build fails on retired claims, retyped benchmark numbers and hard-coded colours; see
[dashboard/client/README.md](dashboard/client/README.md).

## What the dashboard shows

| View | Contents |
|---|---|
| **3D Explore** | The grid cells and raw returns the pipeline produced for a scan, coloured by height, class, resolution ring or Welford variance. A hand-built concept view is kept, labelled as an illustration. |
| **Map Inspector** | A map of every cell, top-down or isometric. Click a cell for its ring, class, point count, height statistics and overhang clearance. Switch foveation presets to watch the fine zone shift, or compare the same scan on a uniform 5 cm grid. |
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
