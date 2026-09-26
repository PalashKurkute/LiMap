# SIH26053 Skeptical Judge Audit — FoveaGrid 2.5D Repository

**Auditor posture:** Cold-call SIH judge. No prior context. No benefit of the doubt.  
**Date:** 2026-09-26  
**Files inspected:** Every `.py`, `.tsx`, `.ts`, `.css`, `.toml`, `.md`, and config in the repo (42+ source files).

---

## Task 1 — Full Repo Component Pass

### A. Grid Engine (`core/grid/`)

| File | What it mechanically does | Real data? |
|:---|:---|:---|
| [nested_lattice.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/nested_lattice.py) | Defines 4 concentric rings (5/10/25/50 cm). `assign_rings()` bins by radial distance; `verify_zero_seam_gaps()` tests 4M random points against integer lattice alignment. | Runs on **synthetic random coordinates**, never on SemanticKITTI data. |
| [spatial_hash.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/spatial_hash.py) | Open-addressing hash table, 106,875 × 32-byte cells = 3.26 MiB. Inserts points per-ring with linear probing; fuses via Welford inside the hash loop. | Tested only on synthetic `.bin` files (which **don't exist** — see below). |
| [welford_fusion.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/welford_fusion.py) | Textbook Welford single-update and Chan parallel merge. Correct math. | Unit-tested against `np.var` — this is the most verifiable module. |
| [dual_elevation.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/dual_elevation.py) | Column-wise analysis: splits Z-values into ground and overhead, computes clearance, classifies traversability. | Exercised only by synthetic Z arrays constructed in test code. |
| [fovea_controller.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/fovea_controller.py) | Shifts ring center along velocity vector. `warp_coordinates()` just subtracts an offset. | This is a coordinate translation, not true elliptical foveation. The name oversells it. |
| [local_plane.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/local_plane.py) | PCA ground plane fit on local patches. `verify_slope_immunity()` generates a synthetic sloped road and checks FP rate. | **100% synthetic** — the "8% downgrade, 0/25K FP" number is from self-generated perfectly planar data with 1.5cm Gaussian noise. It tests whether PCA can fit a plane to its own generated plane. |
| [fast_ops.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/fast_ops.py) | Numba JIT versions of hash insertion and costmap rasterization. `benchmark_compiled_speedup()` profiles JIT execution on 60K random points. | The "2.57 ms / 0.62 ms" latency in BENCHMARK_REPORT.md appears **actually measured** from running this script (timestamped 2026-09-26 23:19:19). This is one of the few numbers that traces to real code execution. |
| [baselines.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/baselines.py) | Pure arithmetic: calculates memory for dense 3D, uniform 2.5D, and FoveaGrid. | The "3051.8 MB / 122.1 MB / 3.26 MB" numbers are **correct arithmetic** — no empirical data needed. Defensible. |

### B. Ingestion (`core/ingestion/`)

| File | What it does | Real data? |
|:---|:---|:---|
| [loader.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/ingestion/loader.py) | Loads SemanticKITTI `.bin`/`.label` format, sanitizes (NaN/range filter), computes azimuth timestamps. | **Would work** on real SemanticKITTI data. But no real data is present in the repo. |
| [odometry.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/ingestion/odometry.py) | KISS-ICP wrapper + fallback NumPy point-to-point ICP. SVD-based registration with convergence check. | KISS-ICP import is `try/except` guarded and almost certainly **never ran** (no KISS-ICP output artifacts). Fallback ICP is untested against ground truth. |
| [transforms.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/ingestion/transforms.py) | SE(3) helpers, Rodrigues rotation, constant-velocity deskewing. | Correct math. Unit-tested in `test_phase1.py`. |

### C. Perception (`core/perception/`)

| File | What it does | Real data? |
|:---|:---|:---|
| [segmentation_infer.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/perception/segmentation_infer.py) | ONNX inference path for SalsaNext + geometric heuristic fallback. | **No ONNX model file exists in this repo.** The ONNX path is dead code. Every actual execution falls through to `_geometric_heuristic_infer()`, which classifies purely by hard-coded Z thresholds (ground: Z in [-1.95, -1.45], overhead: Z > 0.3, etc.). **This is not semantic segmentation — it's a height-band slicer.** |
| [range_projection.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/perception/range_projection.py) | Spherical projection to (64, 2048, 5) range image and unprojection. | Mechanically correct, properly handles depth-sorted overwrite. |
| [idd3d_bridge.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/perception/idd3d_bridge.py) | 12-class Indian taxonomy definition + OBB-based pseudo-labeler. `generate_synthetic_idd3d_scene()` creates a hand-placed autorickshaw and cow. | **No actual IDD-3D data is loaded anywhere.** The "pseudo-labeler" labels synthetic points it generates itself. The "1,289 autorickshaw points" in the report are from self-generated random boxes — not from IDD-3D sensor data. |

### D. Tracking (`core/tracking/`)

| File | What it does | Real data? |
|:---|:---|:---|
| [mos_filter.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/tracking/mos_filter.py) | Semantic label check (class 252-259) + range disparity vs previous frame. | Tested only on synthetic Scene C frames (which **don't exist on disk**). |
| [kalman_tracker.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/tracking/kalman_tracker.py) | Euclidean clustering → Kalman filter (constant-velocity 4-state). Greedy association by distance. | Correct implementation. Never tested on real multi-object data. |
| [free_space_eraser.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/tracking/free_space_eraser.py) | Per-beam ray marching to clear ghost cells. Steps at 10cm intervals from sensor origin to hit point. | The test in `test_phase4.py` manually plants a single ghost cell then fires rays through it. This is a unit test of the mechanism, not a validation of anti-ghosting on a real dynamic sequence. |

### E. Planning (`core/planning/`)

| File | What it does | Real data? |
|:---|:---|:---|
| [costmap_generator.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/planning/costmap_generator.py) | Renders SpatialHashGrid → (ny, nx) uint8 costmap. Has an `ignore_overhang_clearance` flag to simulate naive 2D collapse. Includes **uncertainty cost** (variance × weight). | Mechanically correct. The `uncertainty_weight` parameter implements Standard 2.3 in code. |
| [hybrid_a_star.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/planning/hybrid_a_star.py) | Kinematic Hybrid-A* with bicycle model, 5 steering primitives, heuristic-weighted search. | This is a **standalone, non-Nav2** planner. The standards ask for **actual Nav2 integration** (§7.2). This is an in-repo toy planner, not a ROS 2 node. No `CMakeLists.txt`, no `setup.py` for a ROS 2 package, no `grid_map_msgs`. |

### F. Benchmarks (`benchmark/`)

| File | What it does | Real data? |
|:---|:---|:---|
| [regret_benchmark.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/regret_benchmark.py) | Plans on FoveaGrid costmap vs "naive 2D" costmap. Computes regret as `(cost_fovea - cost_ideal) / cost_ideal`. The "ideal 3D" cost is **simply the straight-line Euclidean distance** (L67: `cost_ideal_3d = float(dist_direct)`). This is not a full 3D planner comparison — it's comparing against a ruler. | Synthetic only. |
| [banded_metrics.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/banded_metrics.py) | **CRITICAL:** Lines 67-68 hardcode published_base_miou = `{0: 74.8, 1: 67.2, 2: 54.1, 3: 41.5}` and published_base_recall = `{0: 97.4, 1: 91.2, 2: 83.6, 3: 74.1}`. Lines 106-109 generate the speed-recall matrix by **pure linear formula**: `96.5 - spd * 0.42`. **These numbers are entirely fabricated — they are not computed from any data.** |
| [eval_segmentation.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/eval_segmentation.py) | Standard IoU computation by distance band. Mechanically correct. | Runs the geometric heuristic (not a trained model) against synthetic labels. The resulting "56.89% mIoU" measures how well a Z-threshold classifier matches Z-threshold-generated labels. |
| [stress_harness.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/stress_harness.py) | Injects noise/dropout/absorption into synthetic data, checks memory stays < 3.5 MB. | Only tests memory bounds — never tests whether output quality degrades meaningfully. Every test checks `telem["under_drdo_bound"]` and nothing about map accuracy. |
| [generate_report.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/generate_report.py) | Orchestrates all benchmarks and writes BENCHMARK_REPORT.md. | This is the sole script that produces all claimed numbers. |
| [BENCHMARK_REPORT.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md) | The generated report with all headline metrics. | Timestamped 2026-09-26 23:19:19 — appears to have been successfully generated. |

### G. Data (`data/`)

**`data/synthetic/` directory does not exist.** Only `data/__init__.py` and `data/generate_synthetic.py` are present. The synthetic data generator (`generate_synthetic.py`) has never been run, or its output was never committed. **Every test and benchmark in the repo depends on these missing files and will crash with `FileNotFoundError`.** The BENCHMARK_REPORT.md exists, so the generator was presumably run once, but the artifacts were not committed/retained.

### H. Dashboard (`dashboard/`)

The FastAPI server and React/Three.js client exist with substantial code (~46KB in ThreeViewport alone). However:
- No `dist/` build output exists
- The server hardcodes fallback to synthetic scene files (which are missing)
- The footer hardcodes "PIPELINE LATENCY: 13.4 ms" and "SEAM GAPS: 0.00% (PROVED OVER 4M PTS)" as static strings

### I. Documentation

| File | Issue |
|:---|:---|
| [ARCHITECTURE.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/ARCHITECTURE.md) | Describes a C++ `FoveaCell` struct (L158-173) that **does not exist in the repo** — all code is Python. Claims SalsaNext TensorRT at "18ms on Jetson AGX Orin" — no TensorRT code, no Jetson profile. Describes a "Multi-Factor Foveation Policy Engine" with a Dynamic Hazard Index formula — the actual implementation is simple concentric rings with a linear center-shift. |
| [Competitive_Audit_And_Architecture_Comparison.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/Competitive_Audit_And_Architecture_Comparison.md) | Not inspected in detail — duplicate of `docs/competitive_matrix.md`. |
| [docs/competitive_matrix.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/docs/competitive_matrix.md) | Claims "Verified 0.0% Regret (< 1.5%)" in the table (L18, L37-38). The actual BENCHMARK_REPORT.md says **10.1%** regret on bridge underpass and **1.2%** on pothole field. The doc claims 0.0%, the generated data says 10.1%. **Direct contradiction.** |

---

## Task 2 — Authenticity Audit

| Bucket | % Estimate | Justification |
|:---|:---|:---|
| **VERIFIED** | **~12%** | Memory arithmetic (baselines.py ✓), Welford math (matches numpy ✓), Numba JIT latency profile (timestamped, reproducible ✓), 32-byte cell struct assert (compile-time ✓), nested lattice seam-gap test logic (correct random test ✓). |
| **PLAUSIBLE BUT UNVERIFIED** | **~38%** | Grid insertion pipeline exists and should work on real data. Hybrid-A* planner is structurally correct. ICP odometry code is correct in isolation. Dual-elevation column analysis logic is sound. Range projection/unprojection is correct. MOS filter logic is correct. Costmap rasterization with uncertainty cost exists. These modules *would* produce results if given real data — but no real-data run artifacts exist. |
| **FABRICATED / PLACEHOLDER** | **~45%** | See detailed list below. |
| **COPIED** | **~5%** | Architecture doc's Multi-Factor Foveation Hazard Index formula appears adapted from dossier/standards language. Welford algorithm is public domain. No evidence of direct code copying from VRgrid/sih_053 repos. Structural inspiration is clear but not plagiarism. |

### Detailed FABRICATED / PLACEHOLDER Inventory

| Claim | Location | Why fabricated |
|:---|:---|:---|
| **banded_metrics.py mIoU numbers** (74.8%, 67.2%, 54.1%, 41.5%) | [banded_metrics.py:67-68](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/banded_metrics.py#L67-L68) | Hardcoded constants. Not computed from any data at all. Presented as "published baseline" but mixed into the FoveaGrid performance reporting. |
| **Speed-recall matrix** (96.5 - spd × 0.42, etc.) | [banded_metrics.py:106-109](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/banded_metrics.py#L106-L109) | Pure linear formula with made-up coefficients. No simulation or data. |
| **"56.89% mIoU" segmentation result** | [BENCHMARK_REPORT.md:42](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L42) | Geometric Z-threshold heuristic evaluated against its own synthetic Z-threshold labels. Circular validation. This is not a segmentation model evaluation. |
| **Semantic segmentation — no trained model** | [segmentation_infer.py:46](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/perception/segmentation_infer.py#L46) | No `.onnx` file exists. The "inference engine" always falls to height-threshold heuristics. Any mIoU claimed is meaningless. |
| **IDD-3D pseudo-labeling "CLEARED"** | [BENCHMARK_REPORT.md:92](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L92) | No IDD-3D data loaded. Self-generated synthetic autorickshaw/cattle boxes labeling self-generated random points. The "bridge" has no actual IDD-3D data flowing through it. |
| **"0.0% regret" in competitive matrix** | [competitive_matrix.md:37-38](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/docs/competitive_matrix.md#L37-L38) | Contradicted by own BENCHMARK_REPORT.md which reports 10.1% regret on bridge scenario. The "0.0%" appears hand-typed. |
| **Planner regret "ideal 3D" baseline** | [regret_benchmark.py:67](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/regret_benchmark.py#L67) | `cost_ideal_3d = float(dist_direct)` — the "ground truth" is a straight-line ruler measurement, not a Dense 3D voxel planner run. Calling this "Ideal Dense 3D Ground Truth" is deceptive framing. |
| **Stress harness "5/5 PASSED"** | [stress_harness.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/stress_harness.py) | Tests only that `memory < 3.5 MB`. Doesn't test map accuracy, ghost persistence, classification F1, or any quality metric. "PASSED" means "didn't crash and stayed in memory" — not "performed well under degradation." |
| **"0/25,789 slope false positives"** | [BENCHMARK_REPORT.md:79](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L79) | PCA fitting a plane to a perfectly synthetic planar slope with 1.5cm noise. The test proves PCA can fit a plane — it doesn't prove slope immunity on real LiDAR data with curbs, vegetation, uneven surfaces. |
| **"31.3x faster than 10 Hz real-time"** | [BENCHMARK_REPORT.md:102](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L102) | Measured on random uniform points, not real scan data with realistic spatial distribution. The Numba JIT warm-up dominates first-call latency. Claim omits compilation overhead. |
| **All data files missing** | `data/synthetic/` | **Does not exist.** Every test, benchmark, and demo depends on files that aren't in the repo. The entire test suite is currently unrunnable. |
| **ARCHITECTURE.md C++ struct** | [ARCHITECTURE.md:158-173](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/ARCHITECTURE.md#L158-L173) | Describes a C++ struct with `velocity_x`, `velocity_y`, `confidence`, `flags` fields. The actual Python implementation has none of these fields. |
| **ARCHITECTURE.md Jetson latency** | [ARCHITECTURE.md:196](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/ARCHITECTURE.md#L196) | Claims "≈18ms on Jetson AGX Orin" for SalsaNext — no Jetson, no TensorRT, no SalsaNext model anywhere in the repo. |
| **ARCHITECTURE.md multi-factor foveation** | [ARCHITECTURE.md:120-141](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/ARCHITECTURE.md#L120-L141) | Describes a multi-factor hazard index H(u,v) with roughness, semantics, velocity, compute pressure. The actual code (`fovea_controller.py`) does a simple linear center-shift proportional to speed. |
| **Nav2 / ROS 2 integration** | Claimed in ARCHITECTURE.md | Zero ROS 2 code in the repo. No `CMakeLists.txt`, no `package.xml`, no `launch/` files, no `grid_map_msgs` usage. The Hybrid-A* planner is a standalone Python implementation. |
| **CUDA / TensorRT** | Listed in `pyproject.toml` optional deps | No `.cu` files, no TensorRT conversion scripts, no compiled GPU kernels. The Numba JIT kernels are CPU-compiled LLVM, not GPU CUDA. |
| **"Clears trails in 200ms"** | Multiple docs | The ghost eraser processes one frame's beams. Whether it actually clears ghosts in 200ms on a real dynamic sequence is unverified — the unit test plants a single cell and fires one frame of rays at it. |
| **Dashboard "60 FPS Binary ArrayBuffer"** | competitive_matrix.md | Dashboard code exists but has never been built (`dist/` missing). No evidence of 60 FPS rendering or binary WebSocket streaming actually working. |
| **Pothole regret "1.2%"** | [regret_benchmark.py:124](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/regret_benchmark.py#L124) | Line 124: `round(min(regret, 1.2), 2)` — the code **clamps** the regret to 1.2% with `min()`. Whatever the actual number is, it's forcibly capped at 1.2 to fit within the "< 1.5% target." **This is the single most damning line in the entire repo.** |

---

## Task 3 — Cross-Reference Against SIH26053_Standards_To_Beat.md

| § | Standard | Cleared? | Evidence / Gap |
|:---|:---|:---|:---|
| **1.1** | Nested-ring resolution (5/10/25/50cm) on one shared lattice | **Partially** | Code exists ([nested_lattice.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/core/grid/nested_lattice.py)). Integer scale factors enforced with assertion. But never tested on real scan data — only synthetic random coordinates. |
| **1.2** | Zero measured mismatches at seams, proven with explicit test | **Partially** | `verify_zero_seam_gaps()` runs 4M random points and checks integer alignment. The test logic is correct but runs on uniform random coordinates, not real LiDAR scan patterns. Still, this is a mathematical property that holds regardless of data. **Closest to credible.** |
| **1.3** | Fixed preallocated memory envelope | **Yes** | 106,875 × 32B = 3.26 MiB. Verified by `assert CELL_DTYPE.itemsize == 32` and `assert self.total_memory_mb < 3.5`. **Provably correct.** |
| **1.4** | Ground and obstacle heights stored separately | **Partially** | `dual_elevation.py` has the analysis logic; `spatial_hash.py` stores `mean_z`, `min_z`, `max_z`, `overhang_z`, `clearance`. But overhang detection in `_insert_batch()` (L200-202) uses a simple threshold (`max - min > 1.5`), not the `DualElevationExtractor`. The extractor is never called by the hash insertion pipeline — it's a standalone utility. |
| **1.5** | Empty cells cost zero memory (spatial hash) | **Yes** | Open-addressing hash with `occupied` flag. Empty slots exist but don't store data. **Valid.** |
| **1.6** | Closed-form O(1) cell index | **Yes** | `floor(x / cell_size)` — textbook. **Valid.** |
| **2.1** | Per-cell Welford variance | **Yes** | Correct implementation, unit-tested. **Strongest claim in the repo.** |
| **2.2** | Coarsening preserves uncertainty (law of total variance) | **No** | Chan's parallel merge exists in `welford_fusion.py` but is **never called** by any code path. No coarsening/merging pipeline exists. A coarse cell is never constructed from fine cells. |
| **2.3** | Confidence consumed by downstream planner | **Partially** | `CostmapGenerator` has `uncertainty_weight` parameter that scales variance into cost. `regret_benchmark.py` has an `benchmark_uncertainty_diversion()` test showing lateral diversion. But this runs on **self-constructed** synthetic mud patches, and the planner is an in-repo toy, not Nav2. |
| **2.4** | Bayesian elevation fusion (Kalman-style update) | **No** | ARCHITECTURE.md describes a Kalman innovation update (L92-95). The actual code uses raw Welford mean/variance accumulation — no measurement noise model, no Kalman gain, no `R_lidar(r)` range-dependent variance. |
| **3.1** | Zero ghost trails, measured over multi-thousand-frame sequence | **No** | Ghost eraser exists but tested on a single manually-planted cell. **Zero multi-frame sequence evaluation.** No SemanticKITTI seq.08 or equivalent. Standard asks for "measured over real multi-thousand-frame sequence." |
| **3.2** | Viewpoint-robust MOS (parked car not misreported as moving) | **No** | No viewpoint-varying test. MOS filter uses semantic labels + range disparity. No explicit test for false-positive static-to-dynamic misclassification. |
| **3.3** | Recall by range band and speed | **No** | [banded_metrics.py:67-68,106-109](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/banded_metrics.py#L67-L68) — entirely hardcoded/formula-generated numbers. **Fabricated.** |
| **3.4** | Occlusion explicitly modeled | **No** | No occlusion modeling anywhere. |
| **4.1** | Negative obstacle detection (potholes) | **Partially** | `dual_elevation.py:109` checks `z_min < -1.95` or `roughness_variance > 0.08`. This is a Z-threshold, not a rim-detection algorithm. It works on the synthetic craters because they're deliberately placed below -1.95m. |
| **4.2** | Slope false-positive rate measured | **Partially** | `local_plane.py` runs PCA on synthetic slopes — "0/25K FP." But the synthetic slope is a perfect plane with Gaussian noise. Real terrain has curbs, vegetation, drainage channels. |
| **4.3** | Overhang / passable-underneath detection | **Partially** | Dual-elevation code exists. Bridge underpass test shows `TRAVERSABLE_OVERPASS`. But only on synthetic Scene A data. |
| **4.4** | Local per-patch ground plane estimation | **Partially** | `local_plane.py` exists with PCA. But it's never integrated into the main grid pipeline — it's a standalone utility. The spatial hash grid doesn't call it during point insertion. |
| **5.1** | Real pretrained model with published mIoU | **No** | **No model file in repo.** Geometric heuristic only. The "56.89% mIoU" is a Z-threshold classifier against Z-threshold labels. **This would be instantly caught by any judge asking "show me your model."** |
| **5.2** | mIoU by distance band | **No** | The distance-binned evaluator exists but evaluates the geometric heuristic, not a real model. The banded_metrics numbers are hardcoded. |
| **5.3** | Off-road / RELLIS-3D evaluation | **No** | No RELLIS-3D data, no evaluation. |
| **5.4** | India-specific classes (cattle, autorickshaw) | **Partially** | Class IDs defined. Synthetic scene generated. But no real IDD-3D data, no trained model recognizing these classes. |
| **5.5** | IDD-3D pseudo-labeling bridge | **Partially** | OBB-to-point labeling code exists. But only labels self-generated synthetic points. No actual IDD-3D `.bin` files loaded. |
| **6.1** | Bit-identical deterministic map hash | **No** | No deterministic hash test. The spatial hash uses Python `for` loops with float accumulation — not deterministic across platforms. |
| **6.2** | Explicit scope of what was/wasn't tested | **No** | BENCHMARK_REPORT.md declares "ZERO FABRICATED METRICS" and "100% of SIH26053 benchmark criteria." **This is the opposite of honest scoping.** The strongest rival (sih_053) explicitly states its limitations. This repo claims perfection. |
| **6.3** | Every number traces to a regenerable script | **Partially** | `generate_report.py` does regenerate most numbers. But the banded_metrics are hardcoded, the pothole regret is clamped, and the "0.0% regret" in competitive_matrix.md contradicts the generated report. |
| **6.4** | Original vs cited prior work | **No** | No citations of prior work. ARCHITECTURE.md doesn't cite Welford, Chan, SalsaNext, KISS-ICP, or any paper. |
| **7.1** | Planner regret as first-class metric | **Partially** | Regret computed, but "ideal 3D" baseline is a straight-line ruler, not a dense 3D planner. |
| **7.2** | Regret with actual Nav2 planner | **No** | Standalone Python Hybrid-A*. No ROS 2, no Nav2. |
| **7.3** | Fréchet distance path comparison | **No** | Not implemented. Only max lateral deviation is reported. |
| **7.4** | Memory and compute savings reported separately | **No** | Compute latency (Numba JIT) is reported, but not separated from memory savings in the way the standard asks. |
| **8.1** | CUDA/TensorRT path exists | **No** | No `.cu` files, no TensorRT. Numba JIT is CPU-compiled LLVM, not CUDA. |
| **8.2** | Compiled kernels actually profiled | **Partially** | Numba JIT kernels are compiled and profiled. But these are CPU kernels, not GPU CUDA kernels as the standard intends. |
| **8.3** | Real hardware run on any embedded board | **No** | No embedded hardware evidence. |
| **8.4** | Compiled rasterization stage | **Yes** | `fast_costmap_rasterize_jit()` is a Numba-compiled rasterizer. **This is genuine.** |
| **9.1** | Datasets pre-staged offline | **No** | No real datasets in repo. Even the synthetic data is missing. |
| **9.2** | Adversarial stress harness | **Partially** | Stress harness exists but only checks memory bounds, not quality. |
| **9.3** | Live dashboard with shrinking memory bar | **Partially** | Dashboard code exists with MemoryMeter component. But `dist/` not built, backend depends on missing data. |

### Summary: Standards Cleared

| Verdict | Count | Standards |
|:---|:---|:---|
| **Yes** | 4 | 1.3, 1.5, 1.6, 2.1 |
| **Partially** | 14 | 1.1, 1.2, 1.4, 2.3, 4.1, 4.2, 4.3, 4.4, 5.4, 5.5, 6.3, 7.1, 8.2, 9.2, 9.3 |
| **No** | 18 | 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 7.2, 7.3, 7.4, 8.1, 8.3, 9.1 |

Effective clearance rate: **4 full + ~7 credible partials ≈ 11/36 sub-standards ≈ 30%**

---

## Task 4 — Outside-Judge Verdict

This repo has a well-organized codebase with correct math in its core data structures (Welford, lattice alignment, PCA) and a sophisticated dashboard scaffolding. The engineering *architecture* is impressive on paper. But when a judge actually probes, it collapses quickly.

**The fundamental problem:** Every claimed result runs against self-generated synthetic data that doesn't even exist on disk. No SemanticKITTI sequences, no RELLIS-3D, no IDD-3D, no ONNX model weights, no ROS 2 integration, no CUDA kernels, no Jetson profiles. The BENCHMARK_REPORT.md declares "ZERO FABRICATED METRICS" while containing hardcoded mIoU/recall numbers ([banded_metrics.py:67-68](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/banded_metrics.py#L67-L68)), a planner regret value forcibly clamped with `min(regret, 1.2)` ([regret_benchmark.py:124](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/regret_benchmark.py#L124)), and a competitive matrix claiming "0.0% regret" when the generated report says 10.1%. This repo would survive about 90 seconds of judge questioning before the "show me your model" or "run this on SemanticKITTI seq.08" question arrives and has no answer.

**Single weakest claim:** The semantic segmentation pipeline. The ONNX path is dead code (no model file), every inference falls to a Z-height threshold heuristic, the "56.89% mIoU" is a circular self-test, and the banded mIoU/recall numbers are literal hardcoded constants in source code. A judge asking "what's your mIoU on SemanticKITTI val?" would get no answer. The standards file explicitly warns: "never demo an untrained model — judges will ask for your mIoU."

**Single strongest claim:** The deterministic 3.26 MB memory bound with 32-byte cache-aligned cells, verified by compile-time `assert CELL_DTYPE.itemsize == 32` and runtime `assert self.total_memory_mb < 3.5`. This is mathematically provable, structurally enforced, and would survive any scrutiny. The Welford variance implementation is also rock-solid and unit-tested against NumPy to ε < 10⁻⁵.

**Bottom line:** ~30% of claimed standards are genuinely addressed; ~45% of headline metrics are fabricated, clamped, or circular. The codebase is a credible *skeleton* for a strong prototype, but it is being presented as a finished, verified system. A judge who reads the code would conclude this team knows the theory cold but has not yet done the work.
