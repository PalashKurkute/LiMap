# Known limitations

What LiMap does not do, or does only in part, stated up front. Every figure is read from a results file in
`benchmark/` (named beside it). Update this file in the same commit as any change to a capability or a results file.

---

## 1. Segmentation: a real model, measured off-repo

- `core/perception/segmentation_infer.py` runs a pretrained **SalsaNext** ONNX model (SemanticKITTI weights, HDL-64E
  spherical projection 64 x 2048, sensor mean/std normalisation, 20 learning classes mapped back to SemanticKITTI ids).
- **The model file is not in the repository** (`*.onnx` is git-ignored; it lived at `models/salsanext-onnx-float/` on the
  team's machine). Without it the engine falls back to a rule-based geometric classifier, and every scan labelled that way
  is marked `heuristic`.
- Measured on 100 frames of sequence 08, 11,068,624 points (`real_miou_results.json`, MEASURED): overall accuracy
  **88.96%**, mIoU **42.25%** (53.52% over classes present). By band: R0 0-10 m **37.96%**, R1 10-25 m **44.04%**,
  R2 25-50 m **30.93%**, R3 50-100 m no points. Mean CPU inference 532.59 ms per frame in that run.
- Not done: no comparison against another model, no check that seq 08 was outside the weights' training split, no
  off-road or Indian-road classes (RELLIS-3D, IDD-3D not used; plan in `docs/IMPLEMENTATION_PLAN.md`).

## 2. Real data: one sequence, run on the team's machine

- The loader reads SemanticKITTI `.bin` / `.label`. Sequence 08 was run end to end with `scripts/run_seq08.py` (500
  frames, 61,968,377 points, no crashes, pool stayed at 3.2616 MB). That output (`data/real/seq08_run_results.json`) and
  the frames are git-ignored, so they are not in the repository.
- Frames 108-129 of the local copy were missing; no second real sequence (e.g. 00 or 07) has been run.
- **Far field is sparse by physics.** The HDL-64E's 0.2 degree beam divergence spreads returns about 35 cm apart
  vertically at 100 m; in the evaluated windows no labelled points reached ring 3 (50-100 m), so ring 3 has no accuracy
  figure. That is sensor physics, not a foveation error.
- The dashboard's real scene is a **5,000-point sample** of one frame, coloured with dataset labels.
- Synthetic scenes are generated (`scripts/generate_synthetic.py`) and labelled as synthetic everywhere.

## 3. ROS 2 / Nav2: a bridge, not a Nav2 run

- `core/planning/nav2_bridge.py` converts the costmap to a `nav_msgs/OccupancyGrid` (or a plain dict without ROS 2);
  `ros2_ws/src/foveagrid_nav2/` holds a node and a launch file; `benchmark/test_nav2_bridge.py` tests resolution, the
  `map` frame, the lethal threshold (254 -> 100) and inflation without ROS 2 installed.
- **Not done:** the package has not been run inside ROS 2 here, and no Nav2 planner has been compared on the foveated
  costmap. The planner used everywhere is this project's own Hybrid A*.

## 4. Speed: CPU only, no embedded hardware

All of it runs on an x86_64 CPU (Numba JIT, ONNX Runtime CPU). From `latency_profile_results.json` (MEASURED, 100 frames
of seq 08, 95 warm):

| Stage | Warm mean | Median |
|---|---|---|
| Spatial-hash insert | 53.3 ms | 18.8 ms |
| Costmap rasterisation | 68.7 ms | 41.4 ms |
| Grid + costmap | 122.0 ms (8.2 FPS) | 57.9 ms (17.3 FPS) |
| Dual-rate async fast path | 45.6 ms (21.9 FPS) | 48.8 ms |
| Full pipeline with ONNX segmentation | 3,229 ms (0.31 FPS) | 2,189 ms |

- First frame including JIT compile: 7.7 s. The warm mean is inflated by CPU thermal throttling in back-to-back runs.
- Pre-optimisation baseline (`edge_hardware_profile.json`): 4,069 ms end to end (costmap 2,864 ms, insert 1,186 ms).
- **Not done:** no Jetson / TensorRT run and no sustained full-sequence real-time run. Sustained 10 Hz with segmentation
  needs a GPU or the multi-rate split (segmentation at a few Hz, grid and costmap every frame).

## 5. Height model: Welford, not Kalman; helpers that are not per-frame

- Each cell keeps a Welford running mean and variance of height, a ground height and an overhead height
  (`DualElevationExtractor`, used inside `SpatialHashGrid` insertion).
- **Kalman elevation fusion is not wired in.** `WelfordElevationAccumulator.kalman_elevation_update`
  (`core/grid/welford_fusion.py`) exists but is called only by `benchmark/test_bayesian_elevation.py`. Say "Welford", not
  "Kalman" or "Bayesian". A real per-cell uncertainty overlay depends on this.
- Chan's parallel-variance merge (`SpatialHashGrid.coarsen_cells`) and PCA ground fitting (`fit_local_ground`) exist as
  grid methods and are tested by `benchmark/test_phase2_integration.py`; they are not run on every frame.

## 6. Planner regret: five frames and one synthetic underpass

- `benchmark/evaluate_real_regret.py`, Hybrid A* on seq 08 frames 0, 5, 10, 20 and 30 (`real_regret_results.json`,
  MEASURED): mean regret **3.45%**, max **10.52%**; mean discrete Fréchet distance 0.584 m, max 1.626 m. On these
  frames the naive 2D baseline scored the same as the 2.5D grid (there is no underpass in them).
- 935.7x (3,051.8 MB dense 3D vs 3.2616 MB) is a **CALCULATED capacity** ratio, not measured use; the measured
  occupied-cell ratio against a uniform 5 cm grid is 1.41x (`fidelity_study_results.json`).
- **Not done:** regret through a Nav2 planner or MPPI, and more than five frames.

## 7. Moving objects: a first version

- `core/tracking/mos_filter.py`: semantic-gated range disparity between consecutive scans (threshold 0.35 m) plus a
  constant-velocity Kalman object tracker (`core/tracking/kalman_tracker.py`) used in that evaluation.
- `evaluate_dynamic_mos.py` on 50 real frames, 5,988,201 points (`real_dynamic_mos_results.json`, MEASURED): precision
  **61.6%**, recall **47.65%**, F1 53.74%, static false-positive rate **1.10%**. Turning (6 frames) FPR 1.54% vs straight
  (44 frames) 1.05%. 1,130 tracks formed, 509 ghost cells carved.
- By range band (checkpoint report of 2026-09-28; its results file was never committed, so treat as unverified): ring 0
  recall 38.43%, precision 88.08%, FPR 0.232%; fast near-field objects move too far between sweeps for the disparity window.
- **Not done:** recall by range band (`benchmark/mos_banded_recall.py` exists, its results file does not), and the
  dashboard's traffic scene is one synthetic scan, so it shows flagged cells, not trail removal over time.

---

## 8. Synthetic data

`data/synthetic/` is git-ignored and regenerated deterministically with `python scripts/generate_synthetic.py`.

---

## 9. Dashboard: foveation presets and the uniform comparison

- **Presets are single-scan re-runs, not drives.** The Map Inspector's city, highway and turn views run one scan through
  the grid with the controller's input for that preset (`docs/DATA_VARIANTS.md`). They show where the fine zone sits; they
  do not show behaviour over time. Hazard- or uncertainty-driven foveation is planned, not built.
- **Turning presets: reach differs slightly from the configured value.** The controller configures a forward reach of
  12.0 m, which is the reach through the fovea centre (y = 1.5 m). Along the vehicle axis the fine zone reaches about
  11.89 m. The dashboard shows the computed reach (CALCULATED) and the configured value in a tooltip.
- **Drawn cells are a sample.** Each variant file stores at most 20,000 evenly spaced cells to keep the repository small,
  so the preset and comparison views look sparser than the full grid. Every count shown is exact (counted before
  sampling) and the view says when it is drawing a sample.
- **The uniform reference uses a larger evaluation pool.** It is built like `benchmark/fidelity_study.py` (a 500,000-cell
  pool). The memory shown for it is the calculated capacity of a full uniform 5 cm grid, not that pool.
- **The real scene is a 5,000-point sample** in this repository, so its presets and comparison hold few cells.

---

## 10. Dashboard: the underpass comparison and the fly-through

- **One scenario.** The underpass comparison replays `benchmark_bridge_underpass` on the synthetic bridge scene, from (5, 0)
  to (28, 0). It says nothing about other scenes, vehicles or planners. Only the bridge scene has it.
- **The one-height grid is this project's own baseline.** It is the costmap generator with `ignore_overhang_clearance=True`
  (anything overhead makes a cell impassable). It is not a third-party planner and the dashboard does not call it one.
- **The 2.5D path is not free.** It costs more than the same route on an empty map; the panel shows both. Cost is the
  planner's own: path length plus risk and steering penalties, not metres.
- **Why not a cell-level comparison.** In this scan only a small number of cells, along the deck's two edges, hold both a
  road and a deck; the deck's interior is separate cells at deck height. A one-height grid at the same cell size would
  therefore look almost the same as the 2.5D one, so the comparison is made where it matters, at the costmap the planner
  actually uses.
- **The fly-through is a camera shot.** The route is the planner's path and the scenery is the grid's cells and returns; it
  is not a recorded drive. The eye height and speed are camera settings. With reduced motion it is a still pose, not a
  flight, and the drag, wheel, camera change or `R` ends it.

---

## 11. Dashboard: analysing your own scan

- **Only a SemanticKITTI-style `.bin`, labelled by a heuristic, on the local API, up to a size cap.** `POST /api/analyze_scan`
  reads one raw SemanticKITTI / Velodyne `.bin` (float32 x, y, z, intensity; no `.label` file and no other format). Its
  labels come from the geometric heuristic unless an ONNX model is present, so they are not ground truth. It needs the
  local FastAPI server: the static and serverless deployment cannot run it, so the button stays disabled there. The file
  size is capped at `MAX_SCAN_BYTES` (8 MB, published by `/api/health`), and one scan is analysed at a time.

---

## 12. Open findings from the external integrity audit (2026-10-03)

An outside-style audit of the repo listed six critical (C) and twelve high (H) findings. Full text with file:line evidence
and literature: `git show docs-before-consolidation:"reports/LiMap SIH26053 external benchmarks.md"`. Status as checked on
2026-10-05; "not re-checked" means the audit's finding stands until someone verifies it.

| # | Finding | Status | Fix |
|---|---|---|---|
| C1 | Invented "DRDO" thresholds and a 0.04% regret figure in a scorecard | **Fixed**: scorecard removed, no threshold text in the UI, and the code keys are now `within_pool_budget` and `memory_budget_mb` (3.5 MB is the team's own design budget; the pool is 3.2616 MB). The edge profile kept its measured values; only the two key names changed | — |
| C2 | Ground-truth leakage: `full_sequence_eval.py` defaults to GT labels (`stride_onnx=0`), so its 100% moving recall is label lookup; regret also uses GT labels | **Open** (default still 0) | Predicted labels by default; fail if labels 252-259 reach `mos_filter`; report IoU_MOS |
| C3 | ROS 2 package lists a DRDO maintainer e-mail the team does not own (`ros2_ws/src/foveagrid_nav2/package.xml:7`, `setup.py:18-19`) | **Fixed**: the maintainer is now a team member (Ved Jadhav) in both files | — |
| C4 | One pipeline quoted with four latencies and three accuracies across docs | **Fixed** in this consolidation: docs quote only `benchmark/*.json` | Keep it that way (`npm run check:docs`) |
| C5 | False claims about rivals in the old competitive matrix | **Fixed**: matrix removed; `COMPETITORS.md` is self-reported and dated | — |
| C6 | Docs cited files that do not exist (`full_sequence_results.json`, `mos_banded_results.json`, `JUDGE_QA.md`, ...) | Mostly fixed by this consolidation; not every code comment re-checked | Remove or commit any cited file |
| H1 | "Multi-factor" foveation not implemented: rings by radius, five speed/turn presets | **Open** (stated in §9) | Hazard-driven refinement; measure far-range obstacle recall |
| H2 | Not real-time with segmentation; the async fast path drops stale labels when point counts differ | **Open** (§4) | GPU/TensorRT run; re-project stale labels by pose or drop the path |
| H3 | Accumulation windows are not registered to a common frame, so static structure smears | Not re-checked | Register with GT poses, then LiDAR odometry; report ATE/RPE |
| H4 | Spatial hash: silent drops (no counter), `uint8` count saturates at 255 while Welford keeps updating, overhang returns share ground statistics, first-point semantics, pool (106,875 cells) is about 22% of full ring coverage (about 479k) | **Open** (count is `uint8`, no drop counter) | Drop and occupancy counters, wider count, separate overhang stats, semantic vote |
| H5 | Seam proof checks properties true by construction | Not re-checked | Point-conservation invariant and boundary-overlap tests |
| H6 | 935.7x is a calculated strawman; the measured gain is 1.41x; about 26x fewer cells at full coverage is a fairer structural ratio | Stated (§6) | Lead with structural and measured ratios; add an OctoMap/UFOMap run |
| H7 | Ghost eraser casts about 1 ray in 1,024, resets cells to a constant height | Not re-checked | Vectorised ray casting over all returns; SA/DA/AA metrics |
| H8 | MOS P 61.6% / R 47.65% is about 36.7% IoU_MOS (CALCULATED): above geometric baselines, below learned methods | Stated (§7) | Multi-frame residuals or a learned MOS head |
| H9 | Segmentation: 100-frame subset, no kNN, licence (CC BY-NC-SA weights), no off-road data, Indian classes only pseudo-labelled | **Open** (§1) | Full seq 08 with kNN; GOOSE / RELLIS-3D; licence plan |
| H10 | Regret: 5 frames, own Hybrid A*, a 2D "3D reference", GT labels | **Open** (§6) | Nav2 Smac on 200+ start/goal pairs with predicted labels |
| H11 | ROS 2 node creates a publisher only (no PointCloud2 subscription, TF or timer), no ament `resource/` marker, stamped `map` not `odom`, never built with colcon | **Open** (publisher only, no `resource/`) | Subscribe, look up TF, publish in `odom`; rosbag launch and Docker |
| H12 | Negative obstacles: fixed z thresholds, synthetic validation, curb survival fails in rings 1 and 3 (`fidelity_study_results.json`) | **Open** | Gap/shadow detection, upper-bound layer, hazard P/R by band |

Medium and low findings (same audit): no CI or Dockerfile (a root LICENSE, Apache-2.0, has since been added) and an incomplete `requirements.txt` (M1); tests
that need generated fixtures and a parity test that never runs (M2); deployment cannot stream (M3); "full sequence" was
976 of 4,071 scans (M4); no per-band elevation RMSE or coverage metric (M5); no corruption, weather or SOTIF framing (M6);
mixed names LiMap / FoveaGrid (L1); no related-work statement (L2); no determinism test (L3).
