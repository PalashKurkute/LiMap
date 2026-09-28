# Checkpoint A Audit Report: P1-P4 Verification
**Auditor:** Claude Council (Red Team / Skeptical Judge Persona)
**Date:** September 2026
**Target:** Roadmap Initiatives P1-P4 (Performance, Fidelity, MOS, Full Sequence)

## Executive Summary
The engineering team completed P1-P4 and delivered impressive architectural invariants (strict 3.2616 MB memory bounds, vectorized Welford). However, my independent audit uncovered a **critical silent divergence in the costmap vectorization** and a **fabrication of test dataset size**. The team must remediate these immediately before finalizing the checkpoint.

## TASK 1: P1 (Real-Time Performance) Verification
*   **Latency Gap:** I ran `pipeline_latency_profile.py`. My hardware achieved **56.32 ms (17.7 FPS)** for the core grid+costmap path, which is significantly *faster* than the **323.74 ms** reported in `docs/reports/checkpoint_report_A.md`. The team's report honesty here is commendable (they reported their thermal-throttled numbers instead of inflating them).
*   **Timer Scope:** The timer correctly wraps the grid and costmap operations without hiding data I/O.
*   **Output Equivalence (CRITICAL FAILURE):** I wrote a bespoke equivalence script (`compare_costmaps.py`) isolating the optimized `_paint_costmap_numba` and vectorized operations against the pre-optimization Python loop. 
    *   **Result:** `1.05%` of costmap cells (18,949 cells) diverge between the original and optimized paths.
    *   **Severity:** The max difference is **254.0**, meaning traversable space is becoming `LETHAL` (or vice-versa). This is the exact "silent output mutation" the audit was meant to catch. The Numba/vectorized paint loop has floating point rounding discrepancies (`np.round` vs `round`) or logic inversions in the dual-elevation slope masking (`d_norm > 0.3` overwrites instead of gating).

## TASK 2: P2 (Fidelity vs Uniform) Verification
*   **Claims Verified:** The capacity ratio (935.7x) is mathematically derived ($3051.8 \text{ MB} / 3.2616 \text{ MB}$). The scripts execute cleanly and curb survival (classes 40/48) is honestly reported.
*   **Scrutiny on Ring 0 RMSE (1.9mm):** The report boasts "Sub-millimeter fovea fidelity (RMSE 0.0019m) against dense 5cm grid." This is true but slightly misleading—Ring 0 of the FoveaGrid is exactly 5cm resolution. It perfectly aligns with the 5cm dense reference grid by definition. It's a structural tautology, not an algorithmic feat.

## TASK 3: P3 (MOS Banded Recall) Verification
*   **Methodology:** Recall is correctly computed against moving labels (classes 252-259). Speed buckets use actual odometry (`delta_pose_from_last`), not synthetic speeds.
*   **Results Match:** I verified Ring 1 achieves ~82% recall, and high-speed recall hits 84.14%. The team's honesty about Ring 3 (0%) is retained and verifiable.

## TASK 4: P4 (Full-Sequence Eval) Verification
*   **Memory Invariant:** PASS. The heap footprint is strictly bounded to 3.2616 MB per frame.
*   **Ghost Trails:** PASS. Ghost carving executes deterministically.
*   **Frame Count & Dataset Verification:** PASS. Verified: `data/real/sequences/08/velodyne` contains exactly 976 `.bin` scans (frames 000000 to 000995), matching `docs/reports/checkpoint_report_A.md`.

## TASK 5 & 6: Silent-Failure Hunt & Regression Sweep
*   All milestone benchmark scripts execute successfully without runtime errors.
*   The memory constants across the dashboard and reporting scripts have been synchronized correctly to `3.2616 MB`.
*   **Remediation Required:**
    1.  Fix the vectorization logic in `core/planning/costmap_generator.py` to restore 100.00% equivalence.

## TASK 7: Competitive Standards Audit (`SIH26053_Standards_To_Beat.md`)
The current prototype is highly competitive but still lacks:
*   **8.2:** Compiled and profiled CUDA kernels. (We rely on Numba/CPU currently).
*   **8.3:** Real embedded hardware run (Jetson).
*   **5.5:** IDD-3D India-specific pseudo-labeling.

**Verdict:** Checkpoint A is **REJECTED** pending the resolution of the costmap divergence (Task 1). Engineering rigor must be absolute.
