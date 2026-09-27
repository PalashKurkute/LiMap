# Implementation Plan Round 3: Fixing Audit Findings from second_follow_up_audit.md

**Date:** 2026-09-27  
**Context:** Resolving findings identified in [second_follow_up_audit.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/second_follow_up_audit.md).  
**Strict Directives:**
1. Zero bluffing / zero silent replacements: when correcting numbers, disclose and reconcile both old and new numbers.
2. Label calculated/arithmetic constants clearly, distinguishing them from live runtime measurements.
3. Every Definition of Done must be verified by actual script execution and inspecting genuine output files.

---

## Task 1: Detailed Action Plan

### Item 1 (§3.3) — Reconcile Pipeline Latency in BENCHMARK_REPORT.md
- **Target File & Lines:** [benchmark/BENCHMARK_REPORT.md:113-122](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L113-L122) (Section 7).
- **Issue:** Section 7 claimed "3.19 ms" total core pipeline latency (2.57 ms spatial hash, 0.62 ms Nav2 rasterizer) on 60,000 synthetic points without disclosing that this was a warm-JIT synthetic run. Meanwhile, real measurements on real 123k-point frames in [benchmark/edge_hardware_profile.json](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/edge_hardware_profile.json) show **4,069.4 ms** end-to-end (1,185.8 ms hash, 2,863.6 ms rasterization) — an undisclosed ~460x gap.
- **Planned Fix:**
  - Replace the single headline table in Section 7 with a dual-disclosure table:
    1. **Real Data Cold/Warm Pipeline Baseline:** 4,069.4 ms end-to-end (1,185.8 ms hash & Welford, 2,863.6 ms Nav2 costmap rasterization) evaluated on 123,389 real points/scan across 50 iterations from `edge_hardware_profile.json`.
    2. **Post-Warmup Synthetic Micro-Benchmark:** 3.19 ms total (2.57 ms hash, 0.62 ms rasterizer) on 60,000 synthetic points, explicitly labeled as: *(post-JIT-warmup, synthetic 60k-point cloud — micro-benchmark of core inner loops, not representative of cold real-data throughput)*.
  - Provide explicit reconciliation explaining the difference (frame size: 123k vs 60k points, JIT compilation/interpreter overhead, Python rasterization vs compiled inner loops).
- **Definition of Done:**
  - Inspect [benchmark/edge_hardware_profile.json](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/edge_hardware_profile.json) to verify the exact numbers: 1,185.839 ms, 2,863.588 ms, 4,069.415 ms.
  - Re-run `python benchmark/profile_edge_hardware.py --iterations 3` or inspect the profile JSON to confirm consistency.
  - Verify that [benchmark/BENCHMARK_REPORT.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md) contains both figures clearly labeled and reconciled.

### Item 2 (§3.3) — Correct Untraceable Semantic Inference Latency in BENCHMARK_REPORT.md
- **Target File & Lines:** [benchmark/BENCHMARK_REPORT.md:158](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L158) (Section 10).
- **Issue:** Section 10 claimed "17.38 ms (P95: 21.1ms) | 57.5 FPS real-time" inference latency. This number appears in no saved JSON output file in the repository (the geometric heuristic run in `seq08_run_results.json` is 58.66 ms, while real ONNX inference in `real_miou_results.json` is 457.88 ms / ~430 ms live).
- **Planned Fix:**
  - Delete the untraceable "17.38 ms" figure from Section 10 table.
  - Replace it with the real measured ONNX CPU inference latency: **457.88 ms** (mean on real Seq 08 120k-point frames from `benchmark/real_miou_results.json`, ~430 ms warm).
  - Add an honest explanatory note clearly distinguishing:
    1. Deep neural network inference on CPU (SalsaNext ONNX: 457.88 ms / ~2.2 Hz on CPU without TensorRT/GPU acceleration).
    2. Spatial hash insertion and 2.5D grid accumulation (<3 ms post-JIT warmup).
- **Definition of Done:**
  - Inspect [benchmark/real_miou_results.json](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/real_miou_results.json) to confirm `"mean_inference_latency_ms": 457.88`.
  - Reconcile the old 17.38 ms claim as deleted and replaced by 457.88 ms in [benchmark/BENCHMARK_REPORT.md](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md).

### Item 3 (§3.2) — Disclose and Label Memory Constants as "CALCULATED"
- **Target File & Lines:**
  - [benchmark/evaluate_real_regret.py:137-139](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/evaluate_real_regret.py#L137-L139)
  - [benchmark/real_regret_results.json](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/real_regret_results.json)
  - [benchmark/BENCHMARK_REPORT.md:13,24,84](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L13)
  - [docs/competitive_matrix.md:13,28,51](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/docs/competitive_matrix.md#L13)
  - [dashboard/client/src/components/MemoryMeter.tsx:21,27,77](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/dashboard/client/src/components/MemoryMeter.tsx#L21)
- **Issue:** `memory_dense_3d_mb: 3051.8` and `memory_foveagrid_25d_mb: 3.26` are hardcoded constants presented alongside runtime-measured values (regret %, Fréchet distance) with no label distinguishing "calculated" from "measured". The derived 936.1x compression ratio is likewise derived from arithmetic constants.
- **Planned Fix:**
  - In `evaluate_real_regret.py`:
    - Rename keys / add clear labels: `"memory_dense_3d_mb_calculated": 3051.8, # CALCULATED (formula: 800M voxels * 4B = 3051.8 MB)`, `"memory_foveagrid_25d_mb_calculated": 3.26, # CALCULATED (106,875 cells * 32B = 3.26 MB)`, `"memory_compression_ratio_calculated": 936.1, # CALCULATED ratio (3051.8 / 3.26)`.
    - Update printouts and docstrings to clearly mark them as `(Calculated theoretical baseline, not runtime-sampled heap)`.
  - In `BENCHMARK_REPORT.md`, `competitive_matrix.md`, and `MemoryMeter.tsx`:
    - Label the dense 3D reference and compression ratio as `calculated arithmetic baseline`, not live runtime measurement.
- **Definition of Done:**
  - Re-run `python benchmark/evaluate_real_regret.py --frames 0 5 10` on real data.
  - Verify that `benchmark/real_regret_results.json` reflects the updated keys and labels.
  - Confirm all reports, matrices, and UI components display the "(calculated)" distinction.

### Item 4 (§3.4) — Clarify MOS Disparity-Based Architecture in BENCHMARK_REPORT.md
- **Target File & Lines:** [benchmark/BENCHMARK_REPORT.md:151-163](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L151-L163) (Section 10).
- **Issue:** The report text implies that the pretrained ONNX model's predictions identify moving objects. In reality, SemanticKITTI's 20-class learning map has no motion category (classes 252-259 are absent from ONNX output). 100% of moving-object detection is performed by the range-disparity branch, while the semantic model provides movable class gating (cars, humans, cyclists).
- **Planned Fix:**
  - Add an explicit architectural statement to Section 10:
    *"Architectural Note on Dynamic Detection: The pretrained SalsaNext ONNX model predicts 20 canonical semantic classes (classes 0–81) and outputs zero motion labels (classes 252–259). By design, 100% of dynamic object classification is performed by the ego-compensated range-disparity branch. The semantic segmentation model functions solely as a semantic gate (restricting disparity checks to movable object classes: cars, bicycles, trucks, persons) to prevent false positives on static structures."*
- **Definition of Done:**
  - Verify the statement is present in `BENCHMARK_REPORT.md`.
  - Cross-check against `core/tracking/mos_filter.py:88-93` confirming this accurately describes the code.

### Item 5 — Add Dedicated Assert-Backed Viewpoint-Robustness Test
- **Target File & Lines:** Create `benchmark/test_viewpoint_robustness.py`.
- **Issue:** No dedicated assert-backed test proves viewpoint-robustness (a known static object staying static through an ego-vehicle turn). The only evidence was aggregate FPR in `real_dynamic_mos_results.json`.
- **Planned Fix:**
  - Create `benchmark/test_viewpoint_robustness.py` with an assert-backed test:
    1. Synthesize a known static object (e.g. parked vehicle cluster) at fixed world coordinates.
    2. Simulate frame t-1 with sensor at origin $[0, 0, 0]$ with heading 0.
    3. Simulate frame t with an ego-vehicle turn ($\Delta\theta = 10^\circ$, forward motion $\Delta x = 1.0\text{ m}$).
    4. Compute `delta_pose` from the known ego trajectory and run `MovingObjectSegmentationFilter.separate_dynamic_points(points, semantic_labels=labels, delta_pose_from_last=delta_pose)`.
    5. Assert that `is_dynamic.sum() == 0` for all points of the static object across multiple turn rates ($5^\circ, 10^\circ, 20^\circ$).
- **Definition of Done:**
  - Run `python benchmark/test_viewpoint_robustness.py`.
  - Confirm all assertions pass with 0 errors and 0 false dynamic detections.

### Item 6 — SalsaNext ONNX Checksum Verification & Provenance
- **Target File & Lines:**
  - [models/salsanext-onnx-float/metadata.json](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/models/salsanext-onnx-float/metadata.json)
  - Create `scripts/verify_model_provenance.py`
  - [scripts/verify_all_milestones.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/scripts/verify_all_milestones.py)
- **Issue:** No checksum exists for the downloaded SalsaNext ONNX weights (`salsanext.onnx` and `salsanext.data`), preventing independent verification of provenance.
- **Planned Fix:**
  - Store computed SHA256 checksums in `models/salsanext-onnx-float/metadata.json`:
    - `salsanext.onnx`: `D64969B846F160551E78E5FE40A2288E02126F914EF3F4B7F4BB61A0CC942B2E`
    - `salsanext.data`: `7D3F19934EA73190E67B2550F52D3CE9EEDECA55203EB115F8412C3AD5A2E52F`
  - Create `scripts/verify_model_provenance.py` to calculate file hashes and assert match.
  - Wire verification check into `scripts/verify_all_milestones.py`.
- **Definition of Done:**
  - Run `python scripts/verify_model_provenance.py`.
  - Confirm SHA256 verification passes with exit code 0.

---

## Execution Tracking

| Item | Description | Status | Evidence / Verification Script |
| :--- | :--- | :--- | :--- |
| **Item 1** | Reconcile 3.19 ms synthetic vs 4,069.4 ms real latency | **COMPLETED** | `benchmark/edge_hardware_profile.json`, `BENCHMARK_REPORT.md:113-140` |
| **Item 2** | Delete untraceable 17.38 ms; replace with 457.88 ms real ONNX | **COMPLETED** | `benchmark/real_miou_results.json`, `BENCHMARK_REPORT.md:171-182` |
| **Item 3** | Label memory constants as CALCULATED across repo | **COMPLETED** | `benchmark/evaluate_real_regret.py:137-142`, `real_regret_results.json`, `BENCHMARK_REPORT.md`, `competitive_matrix.md`, `MemoryMeter.tsx` |
| **Item 4** | Clarify MOS range-disparity architecture in report | **COMPLETED** | `benchmark/BENCHMARK_REPORT.md:177-183` |
| **Item 5** | Dedicated assert-backed viewpoint robustness test | **COMPLETED** | `benchmark/test_viewpoint_robustness.py`, `benchmark/test_phase4_real_dynamic.py` |
| **Item 6** | Checksum verification for SalsaNext ONNX weights | **COMPLETED** | `models/salsanext-onnx-float/metadata.json`, `scripts/verify_model_provenance.py`, `scripts/verify_all_milestones.py` |

---

## Task 4: Completed Verification & Results

### Item 1 Result: Latency Discrepancy Reconciliation (§3.3)
- **Files Touched:**
  - [benchmark/BENCHMARK_REPORT.md:113-140](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L113-L140)
- **Before / After Numbers:**
  - **Old Headline:** "3.19 ms Total Core Pipeline Latency (2.57 ms Spatial Hash & Welford, 0.62 ms Nav2 Costmap Rasterization) — 31.3x faster than 10 Hz real-time limit".
  - **New Disclosed Baseline:**
    - Real-Data Baseline (authoritative from `benchmark/edge_hardware_profile.json`): **4,069.42 ms** end-to-end pipeline latency (Spatial Hash: **1,185.84 ms**, Nav2 Rasterization: **2,863.59 ms**) evaluated across 50 iterations on 123,389 real Velodyne points.
    - Synthetic Inner-Loop Micro-Benchmark: Kept alongside as **3.19 ms**, but explicitly labeled as `(post-JIT-warmup, synthetic 60k-point frame — not representative of cold real-data throughput)`.
  - **Reconciliation:** Disclosed the ~460x gap honestly, citing real point cloud density (123k vs 60k), Python interpreter marshaling, and uncompiled costmap generation.
- **Verification:** Inspected `benchmark/edge_hardware_profile.json` lines 26, 31, 36. Values matched exactly (`1185.839 ms`, `2863.588 ms`, `4069.415 ms`).

### Item 2 Result: Untraceable Semantic Latency Replaced (§3.3)
- **Files Touched:**
  - [benchmark/BENCHMARK_REPORT.md:171-182](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L171-L182)
- **Before / After Numbers:**
  - **Old Untraceable Figure:** "17.38 ms (P95: 21.1ms) | 57.5 FPS real-time" (untraceable to any JSON artifact).
  - **New Verified Value:** **457.88 ms** (~430 ms warm, ~2.2 Hz CPU inference) directly sourced from `benchmark/real_miou_results.json` (`mean_inference_latency_ms: 457.88`).
- **Distinction Clarified:** Disclosed that the 457.88 ms neural network inference latency on CPU is decoupled from the downstream spatial mapping (spatial hash insertion runs in 2.57 ms post-JIT warmup).
- **Verification:** Re-ran `scripts/verify_all_milestones.py` which measured live ONNX inference at **436.8 ms** on real frame 0, fully consistent with the reported 457.88 ms mean.

### Item 3 Result: Memory Constants Labeled as CALCULATED (§3.2)
- **Files Touched:**
  - [benchmark/evaluate_real_regret.py:137-142,150](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/evaluate_real_regret.py#L137-L142)
  - [benchmark/real_regret_results.json:8-11](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/real_regret_results.json#L8-L11)
  - [benchmark/BENCHMARK_REPORT.md:13,24,27-28,83-84](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L13)
  - [docs/competitive_matrix.md:51](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/docs/competitive_matrix.md#L51)
  - [dashboard/client/src/components/MemoryMeter.tsx:21,27,77](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/dashboard/client/src/components/MemoryMeter.tsx#L21)
- **Before / After Labeling:**
  - **Old:** `memory_dense_3d_mb = 3051.8`, `memory_foveagrid_25d_mb = 3.26`, `memory_compression_ratio = 936.1` presented without distinction alongside measured regret %.
  - **New:**
    - Inline code comments: `# CALCULATED — not runtime-measured (see formula in comments)`.
    - Added JSON field: `"memory_accounting_note": "CALCULATED theoretical baseline: dense 3D (3051.8 MB) vs FoveaGrid pool (3.26 MB). Not runtime-sampled in this script."`.
    - Terminal stdout: `Memory Savings: 936.1x (3051.8 MB -> 3.26 MB) [CALCULATED]`.
    - Report & Matrix: Labeled as `3051.8 MB (calc)` and `935.7x / 936.1x (calculated ratio)`.
    - UI Component: `3,051.8 MB (800M voxels, calc)` and `REDUCTION (calc)`.
- **Verification:** Re-ran `python benchmark/evaluate_real_regret.py --frames 0 5 10`. Inspected output file `benchmark/real_regret_results.json` confirming the `memory_accounting_note` was written and matches.

### Item 4 Result: MOS Disparity-Based Architecture Clarified (§3.4)
- **Files Touched:**
  - [benchmark/BENCHMARK_REPORT.md:177-183](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/BENCHMARK_REPORT.md#L177-L183)
- **Fix:** Explicitly stated in the benchmark report that SemanticKITTI's 20-class learning map contains no dynamic classes (classes 252–259 are absent from ONNX model output). Stated that 100% of motion classification is performed by the range-disparity branch, while the semantic model acts exclusively as a movable-class spatial gating filter (for cars, bicycles, pedestrians) to eliminate false detections on static infrastructure.
- **Verification:** Audited against `core/tracking/mos_filter.py:88-93` and `core/perception/segmentation_infer.py:34-55` confirming architectural alignment.

### Item 5 Result: Dedicated Viewpoint Robustness Test Added
- **Files Touched:**
  - [benchmark/test_viewpoint_robustness.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/test_viewpoint_robustness.py) (NEW)
  - [benchmark/test_phase4_real_dynamic.py:94-106](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/benchmark/test_phase4_real_dynamic.py#L94-L106)
- **Implementation:**
  - Synthesized a known static parked vehicle surface cluster (600 points) and ground surface (1,500 points).
  - Tracked across 5 consecutive ego frames with turns from $4^\circ$ to $22^\circ$ yaw angle.
  - Implemented hard assertion: `assert car_dynamic_count == 0` (0 false positives on static object).
  - Implemented contrast assertion: displaced a moving car by +1.5m under an $8^\circ$ ego turn; asserted `moving_car_dyn > 0` (280 points detected) while static car false positives remained strictly 0.
- **Verification:** Executed `python benchmark/test_viewpoint_robustness.py` and `python benchmark/test_phase4_real_dynamic.py`. Both suites passed with 0 errors.

### Item 6 Result: SalsaNext ONNX Checksum Verification & Provenance
- **Files Touched:**
  - [models/salsanext-onnx-float/metadata.json:36-39](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/models/salsanext-onnx-float/metadata.json#L36-L39)
  - [scripts/verify_model_provenance.py](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/scripts/verify_model_provenance.py) (NEW)
  - [scripts/verify_all_milestones.py:110-112](file:///d:/Coding/Projects/Personal/2.5D-Lidar-/scripts/verify_all_milestones.py#L110-L112)
- **Hashes Stored and Verified:**
  - `salsanext.onnx` (637 KB): `d64969b846f160551e78e5fe40a2288e02126f914ef3f4b7f4bb61a0cc942b2e`
  - `salsanext.data` (26.8 MB): `7d3f19934ea73190e67b2550f52d3ce9eedeca55203eb115f8412c3ad5a2e52f`
- **Verification:** Executed `python scripts/verify_model_provenance.py` and `python scripts/verify_all_milestones.py`. Confirmed exit code 0 and successful SHA256 checksum matching for both model files.

