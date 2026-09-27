# FoveaGrid 2.5D — Third Follow-Up Audit Report (Pass 4)

## 1. Item-by-Item Verification

| Item | Claim | Audit Finding | Status |
| :--- | :--- | :--- | :--- |
| **1. Pipeline Latency** | Reconciled 4069.4ms real vs 3.19ms synthetic in `BENCHMARK_REPORT.md` | **VERIFIED.** Both numbers are prominently displayed in Section 7 and clearly labeled. Independently verified against `edge_hardware_profile.json` (4069.415ms). | **CLOSED** |
| **2. Inference Latency** | Replaced 17.38ms with 457.88ms from real data | **VERIFIED.** The untraceable 17.38ms figure is gone. 457.88ms is documented in Section 10 and matches `real_miou_results.json`. | **CLOSED** |
| **3. Memory Labels** | Renamed keys to `_calculated` and labeled constants across 5 files | **PARTIALLY CLOSED.** Labels like `(calc)` and the `memory_accounting_note` were successfully added. However, the JSON keys in `evaluate_real_regret.py` were **not** renamed (still `memory_dense_3d_mb`, not `memory_dense_3d_mb_calculated` as claimed). Furthermore, this edit introduced a new contradiction (see Task 2). | **PARTIAL** |
| **4. MOS Architecture** | Explicitly stated MOS is 100% disparity-based | **VERIFIED.** Statement added to report. Code inspection of `mos_filter.py` and `segmentation_infer.py` confirms the semantic head contains no motion classes and strictly gates disparity. | **CLOSED** |
| **5. Viewpoint Robustness** | Added assert-backed static/dynamic ego-turn test | **VERIFIED.** Ran `test_viewpoint_robustness.py`. The setup rigorously tests ego-motion compensation (`np.linalg.inv(curr_pose)`) and accurately simulates object displacement. | **CLOSED** |
| **6. Model Checksums** | SHA256 checksums verified | **VERIFIED.** Independent PowerShell computation confirmed `salsanext.onnx` matches `D649...` and `salsanext.data` matches `7D3F...` in `metadata.json`. | **CLOSED** |

## 2. Cross-File Contradiction Hunt

The manual addition of "calculated" labels across 5 files (Item 3) created a new numerical contradiction regarding the **compression ratio**:

- `benchmark/evaluate_real_regret.py`: Uses `3.26 MB` to compute **936.1x**.
- `benchmark/real_regret_results.json`: Reports **936.1**.
- `BENCHMARK_REPORT.md` (Line 84): Reports **936.1x**.
- `BENCHMARK_REPORT.md` (Lines 13, 27): Reports **935.7x**. (Contradicts itself).
- `docs/competitive_matrix.md`: Reports **935.7x**.
- `dashboard/client/src/components/MemoryMeter.tsx`: Reports **935.7x**.

*Root Cause:* `edge_hardware_profile.json` reports `3.2616 MB` ($3051.8 / 3.2616 = 935.7$), while `evaluate_real_regret.py` hardcodes a rounded `3.26 MB` ($3051.8 / 3.26 = 936.1$). This is a minor arithmetic drift but violates the "Zero Bluffing" rule when files contradict each other.

## 3. Regression Spot Check (Task 3)

- **Regret Clamp:** `evaluate_real_regret.py` still bounds regret strictly above `0.0`. (Verified).
- **Chan's Merge Wiring:** `mos_filter.py` still correctly processes class `0` (unlabeled) as a movable candidate. (Verified).
- **Dynamic Object Detection:** `test_phase4_real_dynamic.py` still correctly fires and detects dynamic objects on real Seq 08 data. (Verified).

## 4. Technical Quality Standards Audit

| Ref | Standard | Eval Method | Status (Pass 4) |
| :--- | :--- | :--- | :--- |
| **1.1** | O(1) Memory Bound | Code inspection | **CLEARED** |
| **1.2** | Max footprint < 3.5MB | Execution `edge_hardware_profile.json` | **CLEARED** (3.26 MB) |
| **2.1** | Dense 3D vs FoveaGrid Baseline | Execution `evaluate_real_regret.py` | **CLEARED** (Contradictory ratio 935.7 vs 936.1 noted) |
| **2.2** | Underpass Traversability | Hybrid-A* Simulation | **CLEARED** |
| **2.3** | Bayesian Variance Diversion | Hybrid-A* Simulation | **CLEARED** |
| **3.1** | Range-image MOS Projection | SemanticKITTI Seq 08 | **CLEARED** |
| **3.2** | Viewpoint-Robust Static Filter | `test_viewpoint_robustness.py` | **CLEARED** |
| **3.3** | 200ms Ghost Eraser | Execution `test_phase4_real_dynamic.py` | **CLEARED** |
| **4.1** | Integer scaled boundaries | Code inspection / tests | **CLEARED** |
| **4.2** | Zero seam tearing at borders | Execution `test_phase1_invariants.py` | **CLEARED** |
| **4.3** | 25m sloped terrain immunity | Execution `test_phase3_adversarial.py` | **CLEARED** |
| **5.1** | 20-class LiDAR Semantics | SemanticKITTI weights | **CLEARED** |
| **5.2** | Measured class distribution | Execution `evaluate_segmentation_miou.py` | **CLEARED** |
| **6.1** | Native real point cloud ingest | `.bin` parsing confirmed | **CLEARED** |
| **7.1** | Frame latency tracking | Profiled pipeline | **CLEARED** (Reconciled 4069.4ms vs 3.19ms) |
| **8.1** | No test-set data contamination | Repo structural review | **CLEARED** |

## 5. Honest Verdict

**Verdict:** 5 of 6 items are genuinely CLOSED. Item 3 is PARTIALLY CLOSED.

- **Strongest New Evidence:** The addition of `test_viewpoint_robustness.py` is an excellent, mathematically sound assertion that ego-compensation is working. It closes a major logical gap. The reconciliation of the 4069.4ms real vs 3.19ms synthetic latency is also highly transparent and honest.
- **Most Concerning Remaining Issue:** The manual copy-pasting of hardcoded memory constants has resulted in `BENCHMARK_REPORT.md` contradicting itself (935.7x vs 936.1x). The failure to rename the JSON keys in `evaluate_real_regret.py` as claimed in the implementation plan indicates a sloppy final mile.

The repo is fundamentally sound, mathematically verified, and highly transparent. The remaining issue is purely a cosmetic documentation synchronization artifact.
