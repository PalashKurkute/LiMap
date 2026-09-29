# Pre-Pitch Deck Audit

## Context
This audit independently verifies all empirical claims made in `current_data_snapshot.md` before they are printed into the pitch deck. All numbers were verified by directly executing the benchmarking scripts against the raw real-world data and inspecting the source code, adhering strictly to the role of an evidence-based auditor.

## TASK 1 — Independent Metric Verification

| Metric | Snapshot Claim | Independent Result | Verdict |
| :--- | :--- | :--- | :--- |
| **Dense 3D Memory** | 3,051.8 MB | 3,051.8 MB | CONFIRMED |
| **Foveated Pool Memory**| 3.2616 MB | 3.2616 MB | CONFIRMED |
| **Memory Ratios** | 935.7x / 37.4x / 1.41x | 935.7x / 37.4x / 1.41x | CONFIRMED |
| **Real-time Latency (Mean)** | 35.95 ms (27.82 FPS) | 121.99 ms (8.2 FPS) | **NOT CONFIRMED (ENVIRONMENT MISMATCH)** |
| **Real-time Latency (p50)** | 20.93 ms (47.78 FPS) | 57.90 ms (17.3 FPS) | **NOT CONFIRMED** |
| **Dual-Rate Async Pipeline**| 31.90 ms (31.35 FPS) | 45.60 ms (21.93 FPS) | **NOT CONFIRMED** |
| **Planner Regret** | 3.45% | 3.45% | CONFIRMED |
| **Fréchet Distance** | 0.584 m | 0.584 m | CONFIRMED |
| **Nav2 Bridge Unit Tests**| 4/4 Passing | 4/4 Passing | CONFIRMED |
| **Overall mIoU** | 32.60% | 32.60% | CONFIRMED |
| **Ring 3 mIoU (50-100m)**| 0.00% | 0.00% | CONFIRMED WITH CAVEAT* |
| **Dynamic Recall** | 47.65% | 47.65% | CONFIRMED |
| **Dynamic FPR** | 1.103% | 1.103% | CONFIRMED |
| **Ghost Trails Erased** | 509 cells | 509 cells | CONFIRMED |
| **Zero-seam-error** | 0 mismatches | 0 mismatches | CONFIRMED |

***Caveat 1 (Ring 3 mIoU):** Evaluated `real_miou_results.json` and the script explicitly logs `Points: 0` for Ring 3. The 0.00% is a genuine mathematical consequence of missing ground-truth annotations at >50m, not a silent indexing bug.

**CRITICAL LATENCY FINDING:** The latency claims in `current_data_snapshot.md` (and left-over `latency_profile_results.json`) do not match the real pipeline execution times on this hardware. A clean, uninterrupted run of the pipeline explicitly yielded `121.99 ms` (8.2 FPS) core mean and `45.60 ms` (21.93 FPS) async. The Dual-Rate Async pipeline **does successfully pass the 10 Hz real-time threshold** (21.93 FPS), but the snapshot's claim of 47.78 FPS is fabricated for the current execution context.

## TASK 2 — Implementation Integrity of P5 & P6

### P5 (Adaptive Foveation): CONFIRMED
I reviewed `core/grid/fovea_controller.py`. The `DynamicFoveaController` genuinely adapts the spatial hash's ring allocations based on both speed and yaw rate. 
It uses discrete presets (`CITY_CRUISE`, `HIGHWAY_EXTENDED`, `TURNING_LEFT`, `TURNING_RIGHT`) which actively modify the `shift_x` and `shift_y` logic, warping points so that forward lookahead dynamically extends up to 15.0m at higher speeds and shifts laterally during turns. 
**Conclusion:** The deck can confidently and truthfully claim "Adaptive Foveation".

### P6 (Bayesian Elevation Fusion): NOT CONFIRMED (DEAD CODE)
I reviewed `core/grid/welford_fusion.py` and `core/grid/spatial_hash.py`. While a `kalman_elevation_update` method exists in the `WelfordElevationAccumulator` class, **it is entirely dead code**. The actual real-time spatial hash insertion loop (lines 304-313 in `spatial_hash.py`) exclusively calls `WelfordElevationAccumulator.update_single()`, which relies purely on standard Welford running mean/variance equations. There is no observation-noise model or Kalman update executing in the pipeline.
**Conclusion:** The deck MUST NOT claim "Bayesian Elevation Fusion." It must revert to stating "Welford's Online Variance Tracking" to remain factually honest.

## TASK 3 — Regression Checks

All past integrity fixes remain intact:
1. **Regret Clamp is Absent:** `evaluate_real_regret.py` calculates regret via a pure percentage formula `max(0.0, (cost_fovea - cost_dense) / cost_dense * 100.0)`. No flooring or artificial clamping exists.
2. **Memory Consistency:** The 3.2616 MB / 935.7x ratios are consistent across `baselines.py`, `fidelity_study.py`, and the benchmark outputs.

## TASK 4 — Pitch Deck Cross-Check

**NOT CONFIRMED.** I searched the repository for both `PPT_Content_Plan_Team_Abhedya.md` and `PPT_Audit_Team_Abhedya.md` using recursive file scanning. Neither file currently exists in the repository. If these files are stored externally, ensure they are updated to reflect the findings in Task 1 and the critical naming correction found in Task 2.

## TASK 5 — Frontend Reality Check

**CONFIRMED.** I audited `dashboard/client/src/App.tsx` and `dashboard/client/src/components/RegretPanel.tsx`. 
The frontend remains 100% hardcoded. The 3D viewport terrain is mathematically synthesized in `ThreeViewport.tsx` (using cosine waves for potholes), and the `RegretPanel.tsx` currently displays static string literals (now updated to `"PENDING COMPUTATION"` instead of `"3.94%"`). No live telemetry metrics (other than the fake ping loop) or point clouds are currently flowing from the backend.

## TASK 6 — Final Verdict

The 2.5D Lidar pipeline is in solid shape regarding mathematical memory bounds, zero-seam proofs, and planner regret (3.45%). The system successfully achieves real-time execution (21.93 FPS) under the Dual-Rate Async pipeline. **However, there are two major failures that MUST be addressed before pitching:**
1. **Latency Fabrication:** The pipeline actually runs at ~21.93 FPS on current hardware, not the 31.35 - 47.78 FPS claimed. The numbers in the snapshot appear completely fabricated for the current execution environment.
2. **Feature Bluff (P6):** The system is using standard Welford Variance. The Kalman logic is completely un-hooked dead code. Do not call this "Bayesian Elevation Fusion."

The team must correct the latency numbers and P6 naming in all external communication immediately.
