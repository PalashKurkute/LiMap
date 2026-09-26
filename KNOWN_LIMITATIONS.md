# KNOWN_LIMITATIONS.md — FoveaGrid 2.5D

This file is a first-class, intentionally maintained part of the repo.
Honest scoping is a feature, not a weakness. A judge forgives "we didn't get to X."
A judge does not forgive discovering an undisclosed gap at question time.

---

## 1. Semantic Segmentation — No Trained Model Shipped

The inference pipeline in `core/perception/segmentation_infer.py` is built and the ONNX
loading path exists, but **no ONNX model file is included in this repo**. There is no
trained segmentation model.

Current fallback: a Z-height geometric heuristic that classifies points by elevation
relative to ground plane. This is **not** a semantic segmentation model and should not
be reported as one.

All mIoU numbers in `benchmark/banded_metrics.py` are taken from published SalsaNext /
RangeNet++ papers (labeled as such in the code) — they are not numbers produced by
running our code on real data.

**Plan:** Integrate pretrained Open3D-ML RandLA-Net weights (Phase 3 of implementation plan).

---

## 2. Real Public Dataset Status — SemanticKITTI Sequence 08

The ingestion loader (`core/ingestion/loader.py`) correctly parses SemanticKITTI `.bin`
and `.label` files. 

**Progress:** SemanticKITTI validation Sequence 08 has been run end-to-end through the
full ingestion, geometric perception, MOS isolation, and 2.5D spatial hash pipeline 
(`scripts/run_seq08.py`). 500 frames (61,968,377 points) have been evaluated with zero crashes 
and a verified static heap footprint of 3.26 MB (< 3.5 MB DRDO bound). Results are documented
in Section 10 of `benchmark/BENCHMARK_REPORT.md` and `data/real/seq08_run_results.json`.

Full sequence cache contains 976 downloaded scans locally, and background download is continuing.

---

## 3. No ROS 2 / Nav2 Integration

The system does not publish to any ROS 2 topic. There is no `grid_map_msgs` publisher,
no Nav2 costmap layer, no rosbag playback harness, and no ROS 2 package definition.

The planner (`core/planning/hybrid_a_star.py`) is a standalone Python module that
consumes a NumPy costmap array directly — it is not connected to Nav2.

**Plan:** Phase 6 stretch goal — minimal ROS 2 costmap publisher tested against a rosbag.

---

## 4. No Jetson / CUDA / TensorRT Path

All computation runs on CPU via Numba JIT. There is no CUDA kernel, no TensorRT engine,
and no Jetson-specific build configuration. The measured latency of 3.19 ms is from
Numba JIT on x86_64 CPU, not Jetson hardware.

**Plan:** Phase 6 stretch goal — one real hardware run on any available embedded board.

---

## 5. DualElevationExtractor, Chan's Merge, and PCA Ground Plane Are Not Wired Into the Live Pipeline

These three modules are correctly implemented and unit-tested in isolation:
- `core/grid/dual_elevation.py` — dual-elevation extraction
- `core/grid/welford_fusion.py` — Chan's parallel-variance merge for coarsening
- `core/grid/local_plane.py` — PCA ground plane fitting

However, the main data path (`core/grid/spatial_hash.py`'s `_insert_batch()`) uses a
crude `max_z - min_z > 1.5m` threshold instead of calling `DualElevationExtractor`.
The Chan's merge function has no call site at all. The PCA fit is only exercised by
its own synthetic unit test.

**Plan:** Phase 2 of implementation plan — wire each module into the live pipeline with integration tests.

---

## 6. Planner Regret "Ideal" Baseline Is a Straight-Line Ruler

In `benchmark/regret_benchmark.py`, `cost_ideal_3d` is computed as `float(dist_direct)`
— a Euclidean straight-line distance. This is not an actual planned path on a 3D reference
map. A straight-line ruler will always underestimate ideal path cost, artificially inflating
the regret percentage.

**Plan:** Phase 5 — replace with a dense-grid Dijkstra/A* reference path.

---

## 7. Data Synthetic Directory

The `data/synthetic/` directory and its `.bin` / `.label` files must be generated before
running the benchmark suite. Run:

```bash
python scripts/generate_synthetic.py
```

Without this step, `benchmark/banded_metrics.py` and `test_phase4.py` will raise
`FileNotFoundError`.
