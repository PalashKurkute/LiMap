# Perception Upgrade Plan: FoveaGrid 2.5D

## 1. Vulnerability Analysis: Why 32.60% mIoU?

The current 32.60% mIoU (40.44% within 10 m) using SalsaNext is artificially deflated due to three factors:
1. **2D Projection Distortion:** Spherical range projection inherently loses spatial fidelity at distances > 30m. Tall, thin objects (poles, pedestrians) occupy sub-pixel widths at long ranges, causing massive false negatives.
2. **Domain Shift:** The off-the-shelf ONNX model was trained strictly on SemanticKITTI (European urban). Evaluating it on Indian Driving Dataset 3D (IDD-3D) or RELLIS-3D (off-road) introduces catastrophic domain shift (e.g., auto-rickshaws classified as buildings, mud classified as road).
3. **Quantization Loss:** Aggressive FP16/INT8 ONNX quantization for 10 Hz edge inference degrades boundary recall.

## 2. Architectural Pivot: SalsaNext -> Cylinder3D

To align with the references and achieve >65% mIoU across varying distances, we replace 2D SalsaNext with **Cylinder3D** (Asymmetrical 3D Convolution Networks).

### Why Cylinder3D?
* **Distance-Adaptive:** Cylindrical partition maintains even point distribution. Distant points aren't crushed into a single pixel.
* **Edge-Deployable:** Unlike SphereFormer (which relies on complex transformer attention over points), Cylinder3D utilizes `spconv` (Sparse Convolutions). We can compile this via `spconv-tensorrt` to hit real-time latency on Jetson Orin.

## 3. Implementation & Training Plan

### Phase 1: Environment & Backbone Swap
* **Action:** Deprecate `SalsaNext` ONNX files.
* **Action:** Integrate `spconv` and `torch` into the perception stack.
* **Action:** Wrap Cylinder3D inferencer into `core/perception/segmentation_infer.py` to output the standard `CLASS_UNLABELED ... CLASS_POLE` mask.

### Phase 2: Multi-Domain Training (IDD-3D + RELLIS-3D + SemanticKITTI)
* **Dataset Fusion:**
  * **SemanticKITTI:** Base urban geometry (cars, buildings, roads).
  * **RELLIS-3D:** Unstructured off-road (tall grass, puddle, mud, rubble).
  * **IDD-3D:** Indian mixed-traffic (auto-rickshaws, irregular curbs, dense crowds).
* **Class Merging:** Map specific regional classes to canonical FoveaGrid classes to preserve memory (e.g., `auto-rickshaw` -> `CLASS_CAR`, `mud` -> `CLASS_TERRAIN`).
* **Training Routine:** Pre-train on KITTI, then run Curriculum Fine-Tuning on IDD-3D and RELLIS-3D with heavy geometric augmentation (random dropout, pitch jitter).

### Phase 3: Benchmarking & Defense
* Implement distance-band evaluation ($0-15m, 15-30m, 30-50m$).
* Generate per-class IoU tables for the final presentation to demonstrate robustness on minority classes (poles, pedestrians).

## 4. Fallback Mechanism (Zero-Bluffing)
If Cylinder3D OOMs or fails on edge hardware, the system will seamlessly fallback to the deterministic `_geometric_heuristic_infer` (elevation differentials and vertical column continuity) guaranteeing survival.
