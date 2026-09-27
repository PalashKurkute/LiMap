# Follow-Up Skeptical Judge Audit — FoveaGrid 2.5D

**Auditor posture:** Cold-call SIH judge. Verifying claims against `Implementation_Plan_Fix_Audit_Findings.md`.
**Date:** 2026-09-27

---

## TASK 1 — Phase-by-Phase Verification

### Phase 0 — Stop the Bleeding
* **Delete regret clamp:** **DONE (verified)**. Checked `benchmark/regret_benchmark.py` (L92, L93); the `min(regret, 1.2)` clamp is removed and correctly clamped only at a `max(0.0, ...)` floor.
* **Resolve 0.0% vs 10.1% contradiction:** **DONE (verified)**. `docs/competitive_matrix.md` now reports the actual measured values (10.1% / 4.65%).
* **Remove "ZERO FABRICATED METRICS":** **DONE (verified)**. Removed from `benchmark/BENCHMARK_REPORT.md` and replaced with an honest status ("SYNTHETIC VERIFICATION PASSED | REAL-DATASET PIPELINE IN PROGRESS").
* **Quarantine `banded_metrics.py`'s hardcoded numbers:** **DONE (verified)**. Numbers are still there but explicitly wrapped in a comment: `[EXTERNAL BASELINE — NOT OUR MEASUREMENT]`.
* **Rewrite `ARCHITECTURE.md`:** **DONE (verified)**. Correctly downgraded claims. C++ struct is described as a "Target Specification" modeled in Python, and the ONNX model is accurately described as dead code.
* **Add `KNOWN_LIMITATIONS.md`:** **DONE (verified)**. The file exists and provides an impressively honest accounting of the gaps (e.g., admitting the lack of a real segmentation model).
* **Commit missing `data/synthetic/`:** **DONE (verified)**. `data/synthetic` is populated and `generate_synthetic.py` exists to regenerate it.

### Phase 1 — Get One Real Dataset Flowing
* **Download SemanticKITTI seq 08:** **DONE (verified)**. The sequence exists in `data/real/sequences/08/velodyne/` and `scripts/download_seq08.py` is provided.
* **Wire `loader.py` & run full pipeline:** **DONE (verified)**. `scripts/run_seq08.py` correctly parses the binary files and runs the pipeline.
* **Regenerate report with real-data section:** **DONE (verified)**. `BENCHMARK_REPORT.md` Section 10 contains metrics for a 500-frame run of Seq 08.

### Phase 2 — Wire Standalone Modules
* **`DualElevationExtractor` -> `spatial_hash.py`:** **DONE (verified)**. Found in `core/grid/spatial_hash.py` L200 (`self.dual_extractor.update_cell_clearance`).
* **Chan's parallel-variance merge -> coarsening/query path:** **DONE (verified)**. `welford_fusion.py` exposes `WelfordElevationAccumulator.merge()` alias and vectorized kernel; wired into `SpatialHashGrid.coarsen_cells()` and `query_coarsened_region()` to guarantee Law of Total Variance.
* **`local_plane.py` PCA -> main insertion & costmap pipeline:** **DONE (verified)**. Wired via `SpatialHashGrid.fit_local_ground()` and `CostmapGenerator.fit_terrain_planes()` for slope immunity against false positive walls on 8-15% grades.
* **`CostmapGenerator` uncertainty -> `hybrid_a_star.py`:** **DONE (verified)**. `benchmark/regret_benchmark.py` includes an `benchmark_uncertainty_diversion` test proving the planner diverts around high-variance hazards.

### Phase 3 — Replace Fake Segmentation
* **Use pretrained Open3D-ML model & export to ONNX:** **CLAIMED BUT NOT DONE**. The implementation plan strictly required swapping the heuristic for a real pretrained model. The team skipped this, keeping the Z-height heuristic. They successfully disclosed this in `KNOWN_LIMITATIONS.md`, but the Definition of Done for this phase was failed.

### Phase 4 — Real Dynamic-Object Evaluation
* **Use SemanticKITTI moving object labels on real sequence:** **NOT STARTED**. `run_seq08.py` ignores the true `.label` files for the real sequence and relies entirely on the geometric heuristic.
* **Report ghost-trail count & false-positive rate:** **NOT STARTED**. No dynamic evaluation metrics exist for the real sequence in the benchmark report.
* **Viewpoint-robustness check:** **NOT STARTED**.

### Phase 5 — Fix Planner Regret Metric
* **Replace ruler regret with reference path cost:** **DONE (verified)**. `regret_benchmark.py` L86 uses a dense 3D reference costmap (with obstacles drawn) and actual planner trajectory costs.
* **Re-run regret on real data:** **PARTIALLY DONE**. Ran and reported for synthetic scenes, but no regret metric is calculated for the SemanticKITTI Seq 08 data.
* **Add Fréchet distance:** **DONE (verified)**. Computed via `discrete_frechet_distance` in `regret_benchmark.py`.

### Phase 6 & 7 — Stretch Goals & Final Pass
* **Nav2 & Embedded Hardware:** **NOT STARTED** (Correctly deferred as stretch goals).
* **Dashboard build:** **DONE (verified)**. `dashboard/server/app.py` exposes `/api/benchmark_results` and loads `real_seq08_f*` frames, wiring the dashboard to the real pipeline.
* **Final report regeneration:** **DONE (verified)**. Reports have matching, recent timestamps and `KNOWN_LIMITATIONS.md` accurately scopes the work.

---

## TASK 2 — Diff Against the Original Audit

| Original Red Flag | Current Status | Notes |
| :--- | :--- | :--- |
| Regret clamped to 1.2% | **FIXED** | `min()` clamp removed. |
| 0.0% vs 10.1% contradiction | **FIXED** | Competitive matrix now reflects the honest 10.1% measurement. |
| "ZERO FABRICATED METRICS" claim | **FIXED** | Deleted from the report and replaced with honest scoping. |
| Hardcoded banded_metrics | **FIXED** (by quarantine) | Still in code, but clearly flagged as "EXTERNAL BASELINE". |
| ARCHITECTURE.md overclaiming | **FIXED** | Accurately describes what is implemented vs planned. |
| Untrained placeholder model | **STILL PRESENT** (re-scoped) | Still a Z-height heuristic, but explicitly admitted as such in `KNOWN_LIMITATIONS.md` rather than paraded as ML. |
| Unwired standalone modules | **FIXED** | DualElevation, Uncertainty, Chan's merge, and PCA slope immunity are all wired and verified end-to-end. |
| Missing data files / tests crash | **FIXED** | Synthetic data generation script added; SemanticKITTI seq 08 integrated. |

---

## TASK 3 — Updated Authenticity Breakdown

| Bucket | Original Audit % | Current Audit % | Delta Explanation |
| :--- | :--- | :--- | :--- |
| **VERIFIED** | ~12% | **~75%** | Gain from wiring SemanticKITTI Seq 08, 3.26 MB memory bound, Chan's variance merge, and PCA slope immunity into the live pipeline. |
| **PLAUSIBLE BUT UNVERIFIED** | ~38% | **~15%** | Dynamic object filtering on real sequence remains to be connected to odometry and evaluated. |
| **FABRICATED / PLACEHOLDER** | ~45% | **~5%** | Outright fabrications removed; remaining gap is the heuristic segmentation. |
| **COPIED** | ~5% | **~5%** | Standard algorithms (Welford, Fréchet) remain properly utilized. |

---

## TASK 4 — Standards Cross-Reference (SIH26053_Standards_To_Beat.md)

| Standard | Original Status | Current Status | Notes |
| :--- | :--- | :--- | :--- |
| 1.1 Nested/nested-ring resolution | Partially | **Yes** | Now run on a real 500-frame LiDAR sequence. |
| 1.3 Fixed preallocated memory | Yes | **Yes** | Definitively proven on real LiDAR stream without crashes. |
| 1.4 Ground/obstacle heights separate | Partially | **Yes** | `DualElevationExtractor` is now successfully wired into the insertion path. |
| 2.2 Coarsening preserves uncertainty | No | **Yes** | Chan's parallel merge wired into `coarsen_cells()` and `query_coarsened_region()`. |
| 2.3 Confidence consumed by planner | Partially | **Yes** | `benchmark_uncertainty_diversion` integration test proves this end-to-end. |
| 3.1 Zero ghost trails measured | No | No | Still no dynamic object evaluation on the real sequence. |
| 4.3 Overhang detection | Partially | **Yes** | Underpass planner test clears the obstacle cleanly. |
| 4.4 Local per-patch ground plane | Partially | **Yes** | PCA ground fitting wired to `CostmapGenerator.fit_terrain_planes()` for slope immunity. |
| 5.1 Real pretrained model | No | No | Failed Phase 3. |
| 6.2 Explicit scope of what was tested | No | **Yes** | `KNOWN_LIMITATIONS.md` is a masterclass in honest scoping. |
| 6.4 Original vs cited prior work | No | **Partially** | Baselines are properly cited now. |
| 7.1 Planner regret as first-class metric| Partially | **Yes** | The fake ruler baseline was replaced with a real path cost. |
| 7.3 Fréchet distance comparison | No | **Yes** | Metric successfully added and logged. |
| 9.3 Live dashboard | Partially | **Yes** | Backend successfully wired to real sequence data. |

*(All other standards remain in their original state.)*

---

## TASK 5 — New Issues Introduced

**CRITICAL REGRESSION:** The system currently removes **0%** of moving objects on real data. 
In `scripts/run_seq08.py`, `mos.separate_dynamic_points()` is fed labels from the geometric heuristic. The heuristic *never* outputs moving vehicle class IDs (252-259). Furthermore, `run_seq08.py` does not pass `delta_pose_from_last` to the MOS filter, completely bypassing the range-disparity check. 
As a result, `is_dynamic` evaluates to strictly `False` for every single point in the 500-frame SemanticKITTI sequence. The pipeline integrates 100% of moving vehicles directly into the static map as permanent ghost walls. This is a severe failure mode disguised by the lack of dynamic evaluation metrics.

---

## TASK 6 — Honest Overall Verdict

Real, verifiable progress has been made since the last audit. The team correctly triaged their reputation: they systematically removed fabrications, added transparent scoping, and achieved the critical milestone of flowing 500 frames of real SemanticKITTI data through their core engine. The single most convincing piece of new evidence is the **measured 3.26 MB static heap footprint across 61 million real LiDAR points**, which converts a theoretical claim into a proven engineering feat. However, the single most concerning remaining gap is the **complete failure of dynamic object filtering on real data**; because Phase 3 (pretrained model) was skipped and odometry wasn't wired to the MOS filter, the current "real" map is silently accumulating catastrophic ghost trails. The repo is no longer lying to the judges, but it still has a critical perception bug to fix.
