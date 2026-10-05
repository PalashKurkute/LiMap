# Variant snapshots

The dashboard is static-first: every scene is a precomputed snapshot in `dashboard/client/public/data/`, produced by the
real pipeline in `scripts/export_dashboard_data.py`. **Variant snapshots** extend that with the same scan re-run two
other ways, so the Map Inspector can show them without a backend:

| Variant id | What it is | Used by |
|---|---|---|
| `fovea_city_cruise` | the scan re-run with the controller input for city speed | Fovea preset "City" |
| `fovea_highway_extended` | highway speed | "Highway" |
| `fovea_turning_left` / `fovea_turning_right` | a turn | "Turn left" / "Turn right" |
| `uniform_5cm` | the same scan on a uniform 5 cm grid out to 100 m (the reference) | "Compare with uniform 5 cm" |

"Stationary" is the scene's own snapshot (`NOMINAL`), so it has no variant file. The exporter asserts that the NOMINAL
cells equal the base snapshot's cells.

Files live at `public/data/variants/<scene_id>/<variant_id>.json`: 5 scenes x 5 variants = 25 files, about 20 MB in
total. They are fetched only when a user picks a preset or turns the comparison on, so page load is unaffected.

## How a preset is produced

Each preset runs through the real `DynamicFoveaController` (`core/grid/fovea_controller.py`). The exporter feeds the
controller an ego velocity and yaw rate and **asserts** that it selects the intended preset, so a change to the
controller's thresholds fails the export instead of silently relabelling a file:

| Preset | vx (m/s) | vy (m/s) | yaw rate (rad/s) |
|---|---|---|---|
| NOMINAL | 0 | 0 | 0 |
| CITY_CRUISE | 5 | 0 | 0 |
| HIGHWAY_EXTENDED | 12 | 0 | 0 |
| TURNING_LEFT | 5 | 0 | +0.3 |
| TURNING_RIGHT | 5 | 0 | -0.3 |

`SpatialHashGrid.insert_points` uses the controller's shift **only to decide which ring a point belongs to**
(`warp_coordinates` subtracts `(shift_x, shift_y)` before ring assignment); cell indices still come from the real
position. So exported cells decode with the normal lattice table and no position change, and ring *k* is exactly the set
of points with `r_inner <= |p - (shift_x, shift_y)| < r_outer`. That is why the dashed fovea outline in the inspector is
a set of circles centred on the shift.

### Known discrepancy: turning presets

The turning presets store `forward_reach_m = 12.0`, the controller's configured value (`shift_x + 10`, the reach through
the fovea centre at y = 1.5 m). Along the vehicle axis (y = 0) the fine zone actually reaches
`shift_x + sqrt(r0^2 - shift_y^2)`, which is about 11.89 m for these presets (a 0.11 m difference). City and highway
match their configured values exactly. The inspector shows the **computed** reach, labelled CALCULATED, and puts the
configured value in a tooltip.

## The uniform reference grid

`uniform_5cm` is built like the reference in `benchmark/fidelity_study.py`: a `NestedLattice` with a single 5 cm ring out
to 100 m and a 500,000-cell pool (15.26 MB). `SpatialHashGrid.__init__` asserts the pool is under 3.5 MB (the product's
bound), so the exporter builds a normal grid and then swaps in the larger array. The assert deliberately applies only to
the product pool. The "reserved memory" shown for the uniform grid is the **calculated** capacity of a full uniform 5 cm
grid (`theoretical_capacity_mb`, from `calculate_baselines()`), not the 500k evaluation pool.

## File format: `limap.variant/1`

```jsonc
{
  "schema": "limap.variant/1",
  "meta": {
    "scene_id": "scene_a_bridge",
    "variant": "fovea_turning_left",
    "kind": "fovea_preset",              // or "uniform_reference"
    "generated_at": "...", "git_sha": "...", "label_source": "gt",
    "base_inputs_sha256": { "<input file>": "<sha256>" },   // same inputs as the base snapshot
    "points_raw": 0,
    "lattice": [ { "ring_id": 0, "res_m": 0.05, "r_inner": 0, "r_outer": 10 } /* ... */ ],
    "pool": { "capacity": 106875, "cell_bytes": 32, "mb": 3.2616, "active_cells": 0 },
    "fovea": {                            // null for the uniform reference
      "preset": "TURNING_LEFT",
      "input": { "vx_mps": 5, "vy_mps": 0, "yaw_rate_rads": 0.3 },
      "shift_x_m": 2.0, "shift_y_m": 1.5, "forward_reach_m": 12.0, "stretch_ratio": 1.2
    },
    "uniform": {                          // null for fovea presets
      "res_m": 0.05, "r_outer_m": 100.0, "pool_capacity": 500000, "pool_mb": 15.2588,
      "theoretical_capacity_mb": 122.07
    },
    "stats": {                            // counted on the FULL grid before any sampling
      "active_cells": 0,
      "cells_per_ring": [0, 0, 0, 0],
      "cells_per_band": [0, 0, 0, 0],    // by real range from the vehicle; the last band is open-ended (>= 50 m)
      "ring0_ahead": 0, "ring0_behind": 0
    }
  },
  "cells": { /* same columnar shape as the scene snapshot's cells: n, sampled, ix, iy, ring, sem, ... */ }
}
```

- **Sampling.** Drawn cells are capped at 20,000 per variant (`MAX_VARIANT_CELLS`), stride-sampled evenly, with
  `cells.sampled = true` when capped. The `stats` block is always exact. The inspector says so when it is drawing a sample.
  The real scene is the 5,000-point sample, so none of its variants are capped.
- **Bands.** The last distance band is open-ended because a shifted fovea can admit cells up to about 105 m, and the
  bands must sum to `active_cells`.
- **Manifest.** `public/data/manifest.json` has a `variants` block `{scene: {variant: {file, bytes, active_cells}}}`. The
  client reads it first and fetches only files it lists, so a missing variant is "unavailable" (the control is disabled)
  and never a 404 in the console.

## Planner snapshot: the underpass (`limap.planner/1`)

`public/data/planner/scene_a_bridge.json` records what the project's own planner does with the bridge scene when the same
scan is turned into a costmap by two kinds of grid. `scripts/export_dashboard_data.py` (`planner_snapshot`) replays
`benchmark/regret_benchmark.py::benchmark_bridge_underpass` on the grid built from the scene the dashboard itself exports:
a 70 m square costmap from `CostmapGenerator`, `HybridAStarPlanner(step_size_m=0.5, xy_resolution_m=0.25)`, from
(5, 0) to (28, 0).

- **Two grids.** `aware` is the 2.5D grid (`ignore_overhang_clearance=False`): a cell with a deck above it is passable when
  the clearance is enough for the vehicle. `naive` is this project's own height-collapse baseline
  (`ignore_overhang_clearance=True`): any cell with something overhead is impassable. It is the project's baseline, not a
  third-party system.
- **Nothing is asserted about the outcome.** Whether each plan was found is recorded as measured and the dashboard reads
  it from the file. `test_export_planner.py` pins that this export agrees with the benchmark function on the same
  generated files (the same found / blocked verdicts and costs).
- **Cost** is the planner's: path length plus risk and steering penalties. `reference` is the same start and goal on an
  empty map.
- **Costmaps are sparse.** Only non-zero cells are stored (`ix`, `iy`, `v`, row-major) because the maps are more than 99%
  free. A cell's centre is `origin + (index + 0.5) * resolution`. `v` runs from 1 to `lethal`; lethal cells are impassable.
- **Format.**

```
{ schema: "limap.planner/1",
  meta: { scene_id, scenario, generated_at, git_sha, label_source, base_inputs_sha256,
          costmap: { resolution_m, origin_x_m, origin_y_m, nx, ny, vehicle_height_m, lethal },
          planner: { name, step_size_m, xy_resolution_m },
          start: [x, y, heading], goal: [x, y, heading],
          grids: { naive: { label, ignore_overhang_clearance, lethal_cells }, aware: { ... } } },
  maps: { naive: { n, ix[], iy[], v[] }, aware: { ... } },
  results: { naive: { traversable, cost, waypoints, path }, aware: { ... },
             reference: { traversable, cost, waypoints } } }
```

  `cost` and `path` are `null` when no path was found (JSON has no infinity).
- **Manifest.** A `planner` block `{scene: {file, bytes}}`. The client reads it first (`src/data/manifest.ts`, shared with
  the variant loader) and fetches only files it lists, so a scene without one is "unavailable" and never a 404.
- **Where it is used.** The Map Inspector's underpass comparison (two costmaps side by side, the path, a card with these
  figures) and the 3D view's fly-through (the camera follows `results.aware.path`).
- **Limits.** One scenario on one synthetic scene with the planner's own settings. It says nothing about any other
  planner, vehicle or scene (see `docs/reference/KNOWN_LIMITATIONS.md` section 10).

## Regenerating and checking

```bash
.venv/Scripts/python scripts/export_dashboard_data.py           # write snapshots and variants
.venv/Scripts/python scripts/export_dashboard_data.py --check   # fail if anything committed is stale
.venv/Scripts/python -m pytest dashboard/server/tests -q        # includes test_export_variants.py
```

`--check` compares variant files, the planner file and their manifest blocks against a fresh export, ignoring `generated_at` and `git_sha`;
it also reports missing or unexpected variant and planner files. It checks each committed `bytes` against the file on disk rather
than the regenerated size, because the abbreviated git sha embedded in each file can change length.

`dashboard/server/tests/test_export_variants.py` covers: each input selects its intended preset; NOMINAL equals the base
snapshot; every exported cell's ring agrees with its distance from the shift; the fovea pool stays at 3.2616 MB and never
exceeds capacity; the uniform lattice is one 5 cm ring; the uniform grid has at least as many occupied cells as
FoveaGrid; the bands sum to the active count; inside 10 m the two grids hold identical cells at NOMINAL; the export is
deterministic; the manifest lists exactly the files that exist.
