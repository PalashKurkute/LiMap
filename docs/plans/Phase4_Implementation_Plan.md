# Phase 4 Implementation Plan: Real Dynamic-Object Evaluation & Ego-Turn Robustness

**Target Standards:** SIH26053 Standards 3.1, 3.2, 3.3  
**Evaluator Posture:** DRDO / SIH Skeptical Defense Red Team  
**Dataset:** SemanticKITTI Validation Sequence 08 (`velodyne/` + official ground-truth `labels/`)

---

## 1. Objectives & Defense Requirements

1. **Ground-Truth Dynamic Object Evaluation (Standard 3.1 & 3.2):**
   * Compare MOS filter detections against true SemanticKITTI moving classes:
     - `252`: moving-car
     - `253`: moving-bicyclist
     - `254`: moving-person
     - `255`: moving-motorcyclist
     - `256`: moving-on-rails
     - `257`: moving-bus
     - `258`: moving-truck
     - `259`: moving-other-vehicle
   * Quantify empirical **Precision, Recall, F1 Score, and False Positive Rate (FPR)** on real sensor data.

2. **Task 4.3 — Ego-Turn Viewpoint Robustness Check:**
   * Identify high angular velocity segments ($\omega_z > 0.15\text{ rad/s}$) in Sequence 08.
   * Prove that ego-motion compensation ($SE(3)$ delta-pose inversion) maintains low FPR on stationary objects (parked cars, building walls, poles) during sharp maneuvers.

3. **Ghost-Trail Carving & Tracking Validation:**
   * Quantify how many ghost cells are created by moving obstacles and subsequently eliminated by `FreeSpaceGhostEraser`.

---

## 2. Mathematical & Algorithmic Architecture

### 2.1 Moving Object Segmentation (MOS) Residual Formulation
Given current point cloud $P_t = \{p_i \in \mathbb{R}^3\}$ and estimated inter-frame ego-pose delta $T_{t-1 \to t} \in SE(3)$:
1. Transform current points into previous sensor coordinate frame:
   $$p_i^{(t-1)} = T_{t-1 \to t}^{-1} \cdot p_i^{(t)}$$
2. Project $p_i^{(t-1)}$ into previous spherical range buffer $R_{t-1}(u, v)$:
   $$d_{\text{cur}} = \|p_i^{(t-1)}\|_2, \quad d_{\text{prev}} = R_{t-1}(u(p_i), v(p_i))$$
3. Range Disparity Residual:
   $$\Delta d_i = |d_{\text{cur}} - d_{\text{prev}}|$$
   $$p_i \text{ is Dynamic} \iff \Delta d_i > \tau_{\text{disparity}} \quad (\tau = 0.35\text{ m})$$

### 2.2 Ego-Turn Robustness Formulation
Under pure rotation $R \in SO(3)$, naive range-image difference generates artificial disparity along high-gradient depth edges (occlusion boundaries). The SE(3) reverse projection aligns the line-of-sight rays, eliminating false positives on stationary objects.
Metric:
$$\text{FPR}_{\text{turn}} = \frac{FP_{\text{static}}}{FP_{\text{static}} + TN_{\text{static}}} \quad \text{must remain} < 2.5\%$$

---

## 3. Implementation Steps

- [x] **Step 1:** Downloaded official Sequence 08 ground-truth `.label` files (`data/real/sequences/08/labels/`).
- [ ] **Step 2:** Build `benchmark/evaluate_dynamic_mos.py` to evaluate Precision, Recall, F1, and FPR against ground truth classes 252–259 across Sequence 08.
- [ ] **Step 3:** Implement automated angular velocity scanner to isolate turning frames and run the Ego-Turn Viewpoint Robustness check.
- [ ] **Step 4:** Execute benchmark, log results into `benchmark/real_dynamic_mos_results.json`.
- [ ] **Step 5:** Update `benchmark/BENCHMARK_REPORT.md` and `docs/master_task_tracker.md` to seal Phase 4.
