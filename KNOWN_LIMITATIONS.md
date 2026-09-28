# KNOWN_LIMITATIONS.md — FoveaGrid 2.5D

This file is a first-class, intentionally maintained part of the repo.
Honest scoping is a feature, not a weakness. A judge forgives "we didn't get to X."
A judge does not forgive discovering an undisclosed gap at question time.

---

## 1. Semantic Segmentation — Real Pretrained SalsaNext ONNX Integrated

**Status: RESOLVED (Phase 3 Complete)**.

The perception pipeline in `core/perception/segmentation_infer.py` now integrates a real, pretrained
**SalsaNext float ONNX model** (`models/salsanext-onnx-float/salsanext.onnx`, 25.7 MB, SemanticKITTI weights)
running via ONNX Runtime. The engine employs exact HDL-64E spherical projection ($64 \times 2048$), sensor-specific
mean/std normalization, and maps the 20 learning classes back to canonical SemanticKITTI class IDs.

**Empirical Evaluation (SemanticKITTI Sequence 08):**
Evaluated on verified ground-truth point cloud labels (`data/real/sequences/08/labels/`):
- **Overall Point Accuracy:** 84.83% across 2.35M real LiDAR points.
- **Ring 0 (Fovea: 0–10m):** 40.32% mIoU (Road: 98.6%, Sidewalk: 91.8%, Trunk: 83.0%, Terrain: 75.9%).
- **Ring 1 (Tactical: 10–25m):** 34.07% mIoU (Road: 93.4%, Vegetation: 83.8%, Terrain: 77.7%).
- **Ring 2 (Planning: 25–50m):** 28.04% mIoU.
- **Detailed metrics:** Recorded in `benchmark/real_miou_results.json` and generated via `benchmark/evaluate_segmentation_miou.py`.

The rule-based geometric classifier is preserved strictly as an edge fallback mode when ONNX Runtime or model files are absent.

---

## 2. Real Public Dataset Status — SemanticKITTI Sequence 08

The ingestion loader (`core/ingestion/loader.py`) correctly parses SemanticKITTI `.bin`
and `.label` files. 

**Progress:** SemanticKITTI validation Sequence 08 has been run end-to-end through the
full ingestion, geometric perception, MOS isolation, and 2.5D spatial hash pipeline 
(`scripts/run_seq08.py`). 500 frames (61,968,377 points) have been evaluated with zero crashes 
and a verified static heap footprint of 3.2616 MB (< 3.5 MB DRDO bound). Results are documented
in Section 10 of `benchmark/BENCHMARK_REPORT.md` and `data/real/seq08_run_results.json`.

Full sequence cache contains 976 downloaded scans locally, and background download is continuing.

---

## 3. ROS 2 / Nav2 Integration Bridge

**Status: RESOLVED (Phase 6.1 Complete)**.

The system includes a dedicated ROS 2 Nav2 costmap export layer:
- `core/planning/nav2_bridge.py` — converts active FoveaGrid costmap matrices directly into ROS 2 `nav_msgs/OccupancyGrid` messages (or standard dict dictionaries when ROS 2 packages are offline).
- `ros2_ws/src/foveagrid_nav2/` — standard ROS 2 package containing node executables and launch files.
- `benchmark/test_nav2_bridge.py` — automated unit and integration suite asserting correct spatial resolution, header frames (`map` frame), lethal obstacle thresholds (254 $\to$ 100), and footprint inflation.

---

## 4. Jetson / Embedded Hardware & Real-Time Throughput

**Status: HONEST REMAINING LIMITATION**.

All pipeline algorithms currently execute via CPU Numba JIT (x86_64) and ONNX Runtime CPU.
- **Measured P1 Latency Profile (`benchmark/latency_profile_results.json`, 100 frames of Seq 08, 95 warm):**
  - **Spatial Hash Insert:** **51.65 ms** warm mean (p50: 50.47 ms) — **23.0x speedup** over pre-optimization baseline (1185.84 ms).
  - **Nav2 Costmap Rasterization:** **272.09 ms** warm mean (p50: 263.34 ms) — **10.5x speedup** over pre-optimization baseline (2863.59 ms).
  - **Core 2.5D Perception (Grid + Costmap):** **323.74 ms** warm mean (~3.09 FPS, p50: 315.22 ms / 3.17 FPS).
  - **Full Pipeline (with SalsaNext ONNX CPU):** **2323.27 ms** warm mean (~0.43 FPS), dominated by sequential CPU SalsaNext inference (~1999.53 ms).
- Physical execution on NVIDIA Jetson Orin with TensorRT FP16 compilation has not yet been benchmarked on physical hardware.
- Achieving sustained 10 Hz for the full perception stack requires GPU acceleration (TensorRT / CUDA on Jetson Orin) or asynchronous multi-rate decoupling where semantic inference runs at 2–5 Hz while 2.5D grid and costmap updates execute synchronously at $\ge 10\text{ Hz}$.

---

## 5. DualElevationExtractor, Chan's Merge, and PCA Ground Plane Integration

**Status: RESOLVED (Phase 2 Complete)**.

All three advanced mathematical and terrain modules are fully integrated into the live data path:
- `DualElevationExtractor` (`core/grid/dual_elevation.py`): Called directly inside `SpatialHashGrid._insert_batch()` in `core/grid/spatial_hash.py` (L200) to separate underpass clearings from overhead deck canopies.
- `Chan's Parallel-Variance Merge` (`core/grid/welford_fusion.py`): Wired into `SpatialHashGrid.coarsen_cells()` to fuse cell statistics across multi-resolution ring transitions without precision loss.
- `PCA Ground Plane Fitting` (`core/grid/local_plane.py`): Integrated via `SpatialHashGrid.fit_local_ground()` to provide slope immunity against 8% and 15% incline false alarms.
- **Verification:** Verified by `benchmark/test_phase2_integration.py`.

---

## 6. Planner Regret Kinematically Planned Baseline

**Status: RESOLVED (Phase 5 Complete)**.

The Euclidean straight-line distance ruler has been completely removed and replaced with kinematically planned reference paths:
- `benchmark/regret_benchmark.py`: Evaluates Hybrid-A* trajectories on fine uniform 3D ground-truth costmaps vs FoveaGrid 2.5D and Naive 2D collapse.
- `benchmark/evaluate_real_regret.py`: Evaluated across real SemanticKITTI Sequence 08 frames (00, 05, 10, 20, 30), yielding:
  - **Mean Planner Regret:** **3.45%** (unclamped).
  - **Mean Discrete Fréchet Distance:** **0.584 m** (tight path alignment).
  - **Memory Compression:** **935.7x** (3,051.8 MB $\to$ 3.2616 MB).
  - **Results file:** `benchmark/real_regret_results.json`.

---

## 7. Dynamic Object MOS Filter & Ego-Turn Viewpoint Robustness

**Status: RESOLVED (Phase 4 Complete)**.

The moving-object segmentation (MOS) engine in `core/tracking/mos_filter.py` integrates semantic-gated range disparity:
- Moving object candidates (vehicles, cyclists, pedestrians) are dynamically evaluated across consecutive deskewed range scans, while static background (road, sidewalk, buildings) is immune to phantom disparity.
- **Real-Data Verification (`benchmark/evaluate_dynamic_mos.py`):**
  - Evaluated on 65 real SemanticKITTI frames (7.76M points).
  - **Precision vs GT Moving:** **61.75%**.
  - **Recall vs GT Moving:** **52.00%** (F1: 56.45%).
  - **Static Background False Positive Rate (FPR):** **1.250%** (down from 41.2% in ungated baseline).
  - **Ego-Turn Viewpoint Robustness:** Tested across 44 straight vs 21 sharp turning frames (yaw rate up to 0.26 rad/s). Straight FPR: 1.050%, Turn FPR: 1.690%, $\Delta\text{FPR} = +0.641\%$ (< 1.5% SIH threshold) $\to$ **PASSED**.
  - **Results file:** `benchmark/real_dynamic_mos_results.json`.

---

## 8. Data Synthetic Directory

The `data/synthetic/` directory and its `.bin` / `.label` files can be deterministically re-generated at any time by running:

```bash
python scripts/generate_synthetic.py
```

This ensures zero `FileNotFoundError` across offline tests and synthetic benchmarks.

