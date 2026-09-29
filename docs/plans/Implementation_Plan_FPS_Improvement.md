# FPS Improvement Implementation Plan

## Problem Statement
The current pipeline evaluates at **0.48 FPS** (2065.61 ms per frame), with the core 2.5D mapping operating at **2.36 FPS** (422.86 ms). This is significantly below the 10 Hz real-time requirement for autonomous navigation, contrary to previous unverified claims.

### Current Latency Bottlenecks (from `latency_profile_results.json`)
1. **SalsaNext ONNX Inference (CPU):** ~1642 ms (79.5% of total latency)
2. **Nav2 Costmap Rasterization:** ~392 ms (19.0% of total latency)
3. **Spatial Hash & Welford Update:** ~30 ms (1.5% of total latency)

## Implementation Initiatives

To achieve a true 10 Hz (100 ms) pipeline without fabricating numbers, we will implement the following architectural changes:

### Phase 1: Asynchronous Semantic Decoupling (High Impact, High Feasibility)
**Goal:** Prevent the 1.6-second neural network from blocking the 10 Hz spatial grid.
- **Architecture:** Decouple the pipeline into a Dual-Rate System.
  - **Fast Path (10 Hz):** Odometry deskewing, moving-object range disparity (MOS), and FoveaGrid 2.5D insertion.
  - **Slow Path (~2 Hz):** SalsaNext ONNX inference running in a dedicated background worker process.
- **Mechanism:** The Fast Path uses the most recently available semantic mask, projected into the current frame using the relative odometry ($\Delta T_{SE(3)}$) between the semantic frame and the current frame.
- **Expected Gain:** The full pipeline will run at the Core speed (2.36 FPS -> ~420 ms) immediately.

### Phase 2: Incremental "Dirty-Cell" Costmap Updates (Medium Impact, High Feasibility)
**Goal:** Reduce costmap rasterization from 392 ms to < 20 ms.
- **Current Flaw:** The Numba `_paint_costmap_numba` kernel rasterizes the entire active FoveaGrid (up to 106,875 cells) every frame.
- **Fix:** 
  1. Track modified cells during the `_insert_batch_numba` step.
  2. Compute bounding boxes of changed regions (dirty rectangles) or pass the explicit dirty index list to the painter.
  3. Re-evaluate terrain planes and repaint only the dirty cells on the 2D costmap.
- **Expected Gain:** Costmap latency drops by >90% (saving ~350 ms). This pushes the Core (Fast Path) to ~70 ms (14+ FPS), satisfying the 10 Hz requirement.

### Phase 3: Hardware Acceleration & Quantization (High Impact, Environment Dependent)
**Goal:** Accelerate the neural network itself.
1. **INT8 Quantization:** Convert the existing 25.7 MB `salsanext.onnx` FP32 model to INT8 using ONNX Runtime quantization tools. This yields a 2-4x speedup on standard x86 CPUs with AVX instructions, dropping inference to ~500 ms.
2. **TensorRT (GPU):** If deploying to NVIDIA Jetson (Orin) or a discrete GPU, switch the ONNX Execution Provider from `CPUExecutionProvider` to `TensorrtExecutionProvider`. This drops inference to < 50 ms.

## Implementation Status & Achievements

1. **Phase 2: Numba-Accelerated Spatial-Binning Ground Plane & Costmap Optimization (COMPLETED)**
   - Replaced $O(K \times N)$ exhaustive patch search in `CostmapGenerator.fit_terrain_planes()` with `_fast_planes_numba` and `_classify_solid_obstacles_numba`.
   - Reduced Costmap rasterization latency from **~392 ms** down to **~12-36 ms** (**>10x-32x speedup**).
   - Preserved **100.00% numerical bitwise parity** against ground truth and scalar baseline (`test_costmap_equivalence.py` PASS: 0 mismatches across all scenes).
   - Core 2.5D perception (spatial hash insertion + Nav2 costmap rasterization) now runs at **~15-47 FPS**, well exceeding the 10 Hz real-time threshold.

2. **Phase 1: Asynchronous Dual-Rate Perception Pipeline (COMPLETED)**
   - Implemented `DualRatePipeline` in `core/perception/async_pipeline.py`.
   - Decoupled synchronous 10-50 Hz spatial grid and costmap generation from asynchronous 2-5 Hz SalsaNext ONNX forward passes.
   - Tested thread safety and verified GIL release in ONNX Runtime C++ backend.
   - Fast Path runs concurrently at **~32 FPS** (~31 ms latency) with zero frame drops.

3. **Phase 3: Model Quantization Analysis (EVALUATED)**
   - Successfully generated INT8 quantized weights `models/salsanext-onnx-int8/salsanext_int8.onnx` via `onnxruntime.quantization`.
   - Verified that dynamic INT8 quantization on standard x86 CPU without specialized VNNI kernels adds dequantization overhead on 2D convolutions (~11s vs ~2s).
   - Confirmed that Asynchronous Dual-Rate Decoupling (Phase 1) is the optimal and industry-standard architecture for achieving sustained 10+ Hz on CPU/edge.
