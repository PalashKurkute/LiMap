# FoveaGrid-2.5D: Production Roadmap & Reference Engineering Blueprint

**Project:** SIH26053 — Adaptive Variable-Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception  
**Client / Evaluator:** DRDO (Defence Research and Development Organisation) / NTRO  
**Deadline:** 30 September 2026 (Idea Submission)  
**Standard:** Measured, honest, ground-truth-validated — beat rivals on rigour, not diagrams.  

> **Dossier Directive (Sep 2026 update):** "Win on measured, honest evaluation rather than architecture diagrams. The concept is not novel by itself; the way to win is through rigour — real trained models, off-road and Indian-specific classes, per-cell uncertainty, and a polished, quantified memory demonstration."

---

## 1. Reference Repository Audit Matrix

The dossier explicitly names the repos below as the **baseline to beat**. We study, benchmark against, and surpass them — we do not copy:

| Repository | What They Actually Do | What the Dossier Says to Learn From Them | Their Published Gap | Our Specific Upbuild |
| :--- | :--- | :--- | :--- | :--- |
| **`Stxtics03/vrgrid` + `victorysingh/vrgrid-26`** *(Team Chronicles.exe)* | Fixed 8.94 MB preallocated bound; uncertainty-preserving min/max/var coarsening; ghost removal; planner-regret evaluation; Rerun dashboard; SemanticKITTI seq 00/07/08; MIT licence. | "Still the strongest uncertainty-preserving benchmark to beat." | No off-road or Indian classes; distance-only ring assignment; no speed/heading fovea adaptation; no overhang dual-elevation. | Speed- & heading-adaptive fovea steering; dual-elevation overhang band; Indian/off-road 12-class taxonomy; per-distance-bin mIoU reporting. |
| **`pushpam2404/sih_053`** | Full ROS 2 Jazzy stack: Ouster OS1-64 → FAST-LIO2 → dynamic-obstacle node → foveated 2.5D engine → Nav2; Jetson Orin, CUDA/TensorRT, Docker. Proves 1:2:10 nested lattice has zero seam mismatches over 4M positions. | "Deployment realism and honest metrics." | Western urban bias only; static ghost removal is timeout-based not ray-casting; no RELLIS-3D off-road eval; no planner-regret quantification. | RELLIS-3D + IDD-3D fine-tuning; FreeDOM ray-casting ghost removal; explicit planner-regret metric; heading-adaptive fovea bending. |
| **`akumar4be26-crypto/LiFovea`** | CPU-only NumPy pipeline; 64-beam simulator with synthetic ground truth; Bayesian elevation fusion; 0.8m tiles; A* navigation; 44 regression tests. | "Simulated ground truth; Bayesian fusion; navigation proof." | 0.8m tiles miss potholes (20cm) and curbs (15cm); CPU-only, no TensorRT; no semantic backbone beyond heuristics. | 5cm inner core preserving sub-20cm hazards; GPU/TensorRT acceleration; trained SalsaNext backbone replacing height rules. |
| **`kaushik521645/lidar-2.5D-mapping-main`** | RandLA-Net; Kalman anti-ghosting; speed- AND steering-adaptive fovea; FastAPI + WebSocket + deck.gl up to 30 FPS. | "Speed/heading fovea and dashboard ideas." | Single-Z per cell (no overhang/dual-elevation); JSON serialization drops FPS; no planner-regret; no RELLIS-3D eval. | Binary ArrayBuffer WebSocket stream; dual-elevation clearance band; planner-regret; off-road benchmark. |
| **`saxenaatharv/3D--2.5D-LIDAR`** | RandLA-Net via Open3D-ML; 3 super-classes; sparse ring grid. | "Warned: untrained head scored 5.01% mIoU vs 6.64% random baseline." | Only 3 coarse classes; no Indian/off-road classes; never demo an untrained model. | 12 granular classes + pretrained weights + honest per-distance mIoU reporting. |
| **`darshan-stack/DRDO`** | Feedback-foveated elevation mapping scaffold; uniform baseline first, adaptive second. | "Clean staging plan." | Scaffold only — no trained model, no quantified metrics. | Complete trained pipeline with all metrics. |
| **`siddhantkadu0001/AVLM`** | Quadtree grid; Streamlit dashboard; FPS measurement. | "Quadtree as alternative to rings." | Quadtrees are awkward for planner neighbour-lookups; no trained backbone. | Nested ring lattice is planner-compatible and mathematically seam-free. |
| **`heetkakaria45-bit/LiDAR_Syntrix`** | Semantic elevation grid; curbs, speed bumps, potholes, overhang handling. | "Hazard-focused overhang framing." | Architecture-only; no quantified mIoU or memory proof. | All claims backed by measured metrics. |

---

## 2. Our Genuine Differentiators (Dossier-Confirmed)

Per the Sep 2026 dossier update, points 1–3 (rings, uncertainty, ghost removal) are **table stakes** — rivals already have them. We lead on:

1. **Speed- and Heading-Adaptive Fovea** — Only one repo (`kaushik521645`) implements steering-adaptive fovea; we borrow the concept and extend it with dual-direction heading + velocity vector.
2. **Dual-Elevation Overhang Clearance Band** — No public repo stores $[z_\text{ground}, z_\text{ceiling}, \Delta z_\text{clearance}]$. Bridge underpasses and tree canopies remain a genuine technical blind spot.
3. **Indian + Off-Road 12-Class Taxonomy** — IDD-3D (Hyderabad driving: autorickshaws, cattle, animals) + RELLIS-3D (mud, puddles, rubble). Still rare in the field.
4. **Planner Regret with Per-Ring Memory Breakdown** — dossier explicitly requests this metric now. We produce it.
5. **Degraded Sensor Stress Tests** — dropped beams, rain/dust noise. Only the dossier lists this; no public repo demonstrates it.

---

## 3. Technical Stack

| Component | Choice | Justification |
| :--- | :--- | :--- |
| **Point Cloud I/O** | `numpy.fromfile`, `open3d` | Sub-ms binary read; zero-copy from `.bin` / `.pcd` |
| **Odometry** | `kiss-icp` (Python API) | Pip-installable, zero ROS build lock-in, sub-2cm drift |
| **Ground Segmentation** | `pypatchworkpp` | 40+ Hz on CPU; concentric zones align with our rings |
| **Semantic Backbone** | SalsaNext / RandLA-Net (ONNX + TensorRT FP16) | SalsaNext: 59.5% mIoU @ 24 FPS; RandLA-Net: fast with Open3D-ML pretrained weights |
| **Array Acceleration** | NumPy 2.x + Numba JIT + CuPy | Zero raw Python loops over point clouds |
| **Grid Engine** | Custom Python/C++ (`core/grid/`) | Nested lattice 1:2:5:10 with preallocated spatial hash |
| **Anti-Ghosting** | FreeDOM ray-casting + Kalman tracker | Principled log-odds decay; no timeout heuristics |
| **Planner** | Vectorized Hybrid-A* / Reeds-Shepp | Nav2-compatible; computes regret metric |
| **Backend** | FastAPI + Uvicorn + WebSockets | Binary `ArrayBuffer` float32 stream at 60 FPS |
| **Dashboard** | React + Vite + deck.gl + Three.js | 60 FPS WebGL; audited via `UI_UX_PRO_MAX` |

---

## 4. Phased Prototype Plan

The dossier-recommended build order is explicit:  
**`pretrained segmentation + grid engine + memory dashboard first` → `MOS + ghost removal + off-road fine-tuning second` → `Jetson/TensorRT optimisation last`**

We follow this precisely, with phases granulated for a 6-person team:

```
PHASE 0: Environment, Data Staging & Synthetic Ground Truth Lab
PHASE 1: Ingestion, Coordinate Frames & Ego-Motion Deskewing
PHASE 2: Pretrained Segmentation Baseline (SalsaNext + Honest mIoU)
PHASE 3: Core Grid Engine — Nested Lattice + Welford Fusion + Memory Dashboard
PHASE 4: Dual-Elevation Overhang Band & Negative Hazard Detection
PHASE 5: Speed & Heading-Adaptive Fovea Controller
PHASE 6: Moving Object Segmentation & FreeDOM Anti-Ghosting
PHASE 7: Indian/Off-Road Fine-Tuning (IDD-3D + RELLIS-3D)
PHASE 8: Planner Regret Benchmark (Nav2 Hybrid-A*)
PHASE 9: UI/UX Pro Max Telemetry Console (deck.gl 60 FPS)
PHASE 10: Adversarial Stress Tests, Jetson Orin Profiling & Evaluation Report
```

---

### PHASE 0: Environment, Data Staging & Synthetic Ground Truth Lab
**Objective:** Everything must be pre-staged. Finale connectivity is not guaranteed. No surprises.

* **0.1 Dependency Pinning (`pyproject.toml`):**
  * `kiss-icp`, `pypatchworkpp`, `numpy>=2.0`, `numba>=0.59`, `open3d`, `torch`, `onnxruntime-gpu`, `fastapi`, `uvicorn`, `websockets`
* **0.2 Data Staging (offline, pre-downloaded):**
  * SemanticKITTI sequences 00 and 07 (VRgrid uses 00, 07, 08 — we match this baseline)
  * RELLIS-3D: sequences 00000–00004 (off-road benchmark)
  * IDD-3D: Hyderabad driving subset with 3D bounding boxes for pseudo-label generation
* **0.3 Synthetic Stress Scene Generator (`data/generate_synthetic.py`):**
  * Scene A: Bridge underpass (2.5m clearance, 1.0m thick deck) — stress-tests dual-elevation
  * Scene B: Negative pothole cluster (25cm deep, 50cm wide) — stress-tests hazard fovea
  * Scene C: Moving vehicle at 8 m/s — stress-tests MOS and anti-ghosting
  * Scene D: Thin poles at 5m, 20m, 40m, 70m intervals — stress-tests far-field preservation
* **0.4 Pretrained Weights Download:**
  * SalsaNext pretrained on SemanticKITTI (from `lidar-bonnetal`)
  * RandLA-Net via Open3D-ML pretrained checkpoint

---

### PHASE 1: Ingestion, Coordinate Frames & Ego-Motion Deskewing
**Objective:** Clean, correct, REP 103/105-compliant point cloud ingestion and deskewing.

* **1.1 Multi-Format Loader (`core/ingestion/loader.py`):**
  * Memory-mapped binary reader for `.bin` (Velodyne float32 XYZI): load 130,000 pts in `<1.5ms`
  * Support `.pcd` and `.las` for simulator output compatibility
* **1.2 Coordinate Frame Enforcement (`core/ingestion/transforms.py`):**
  * Enforce **ROS REP 103** (X forward, Y left, Z up) immediately on ingestion
  * REP 105 frame chain: `map → odom → base_link → lidar_link`
* **1.3 KISS-ICP Ego-Motion Deskewing (`core/ingestion/odometry.py`):**
  * Frame-to-frame SE(3) pose estimation
  * Per-beam micro-timestamp interpolation to eliminate motion distortion:
    $$\mathbf{p}_\text{deskewed} = \mathbf{T}_{t_\text{end}}^{-1} \mathbf{T}_{t_i} \mathbf{p}_i$$
* **1.4 Ground-Truth Baseline Constructor (`core/grid/baselines.py`):**
  * Uniform 5cm 3D Voxel over 200m×200m×10m → **~3.2 GB** (theoretical ceiling)
  * Uniform 5cm 2.5D elevation map (4000×4000 cells, 8 bytes/cell) → **128 MB** (uncompressed baseline)
  * These two numbers are what every memory claim is measured against

---

### PHASE 2: Pretrained Segmentation Baseline (Honest mIoU — Never Demo Untrained)
**Objective:** Working semantic labels from day one, with honest published-grade numbers.

> **Hard rule:** `saxenaatharv` demoed an untrained head and scored 5.01% mIoU — below random. We never do this. Pretrained weights are pre-staged in Phase 0.

* **2.1 Spherical Range-Image Projector (`core/perception/range_projection.py`):**
  * 64×2048 spherical projection in `<2ms` producing `[x, y, z, range, intensity]` tensor
* **2.2 SalsaNext Inference Engine (`core/perception/segmentation_infer.py`):**
  * Load ONNX / TensorRT FP16 compiled model
  * Target: 24+ FPS on GPU (SalsaNext SemanticKITTI baseline: **59.5% mIoU**)
* **2.3 Unified 12-Class Traversability Remapper:**
  * Remap SemanticKITTI's 28 classes to our 12-class taxonomy:
    1. `road_smooth` (flat asphalt) — hazard weight 0.05
    2. `terrain_rough` (gravel, scree, rubble) — 0.50
    3. `terrain_soft` (mud, sand, puddle) — 0.60
    4. `vegetation_low` (grass, drivable shrubs) — 0.25
    5. `vegetation_high` (tree trunks, forest) — 0.80
    6. `obstacle_vertical` (walls, buildings, barriers) — 0.90
    7. `obstacle_thin` (signposts, poles, wire fences) — 0.95
    8. `hazard_negative` (potholes, ditches, drop-offs) — 0.90
    9. `dynamic_vehicle` (cars, trucks, buses, autos) — 1.00
    10. `dynamic_vulnerable` (pedestrians, cyclists, children) — 1.00
    11. `dynamic_animal` (cattle, dogs, horses) — 1.00
    12. `overhang_structure` (bridges, flyovers, tunnels) — special dual-elevation flag
* **2.4 Distance-Binned mIoU Evaluator (`benchmark/eval_segmentation.py`):**
  * Report per-distance-band accuracy on SemanticKITTI: 0–10m, 10–25m, 25–50m, 50–100m
  * RELLIS-3D published baselines to quote honestly: **SalsaNext 43.07%, KPConv 19.07% mIoU**

---

### PHASE 3: Core Grid Engine — Nested Lattice + Welford Fusion + Memory Dashboard
**Objective:** The centrepiece data structure. Memory must be measured and displayed, not just claimed.

* **3.1 Zero-Tear Nested Lattice (`core/grid/nested_lattice.py`):**
  * Base cell $\delta_0 = 5\text{cm}$; scale factors $k \in \{1, 2, 5, 10\}$
  * Ring boundaries: 0–10m (5cm), 10–30m (10cm), 30–60m (25cm), 60–100m (50cm)
  * Mathematical invariant: coarse cell = exact integer block of fine cells → zero seam gap
  * Validation test: probe 4M boundary positions → 0 mismatches (matching `sih_053` standard)
* **3.2 Welford Online Bayesian Fusion (`core/grid/welford_fusion.py`):**
  * Numba JIT O(1) per-point update: running mean $\mu_n$ and variance $\sigma_n^2$
  * Uncertainty-preserving coarsening: when merging fine→coarse cells, keep min/max/variance, not just mean (VRgrid's key insight — we match it)
  * Kalman update for multi-frame fusion with sensor range noise $R(r) = \sigma_0^2 + \alpha r^2$
* **3.3 Preallocated Spatial Hash (`core/grid/spatial_hash.py`):**
  * 32-byte cache-aligned `FoveaCell` structs in a preallocated flat array
  * Morton Z-order indexing for cache locality
  * Fixed memory bound: **< 3.5 MB** (vs VRgrid's 8.94 MB — we target tighter)
* **3.4 Per-Ring Memory Breakdown Reporter (`core/grid/memory_report.py`):**
  * Report memory breakdown PER RING, not just total:
    * Ring 0 (0–10m, 5cm): ~1.28 MB
    * Ring 1 (10–30m, 10cm): ~1.28 MB
    * Ring 2 (30–60m, 25cm): ~0.54 MB
    * Ring 3 (60–100m, 50cm): ~0.32 MB
    * Total active: **~3.42 MB**
  * This is the number that appears on the live memory bar

---

### PHASE 4: Dual-Elevation Overhang Band & Negative Hazard Detection
**Objective:** Solve the blind spot no public repo currently addresses.

* **4.1 Vertical Column Histogram Slicing (`core/grid/dual_elevation.py`):**
  * Ground layer: $z_\text{ground}$ (lowest dense cluster matching fitted ground plane)
  * Ceiling layer: $z_\text{ceiling} = \min\{z_i \mid z_i > z_\text{ground} + H_\text{headroom}\}$ where $H_\text{headroom} = 1.8\text{m}$
  * Clearance gap: $\Delta z_\text{clearance} = z_\text{ceiling} - z_\text{ground}$
* **4.2 Clearance State Classification:**
  * `Open_Sky`: no ceiling return
  * `Traversable_Underpass`: $\Delta z \geq H_\text{vehicle} + \delta_\text{margin}$ (vehicle fits through)
  * `Overhang_Collision`: $\Delta z < H_\text{vehicle} + \delta_\text{margin}$ (hard obstacle flag)
* **4.3 Negative Hazard Detector (`core/perception/negative_hazards.py`):**
  * Flag cells where $z_\text{local} < z_\text{fitted\_ground} - 0.15\text{m}$ as potholes/ditches
  * Depth estimate: $d_\text{pothole} = z_\text{fitted\_ground} - z_\text{local}$
  * **Stress-test target:** 25cm deep, 50cm wide pothole must survive at 5m AND at 25m range

---

### PHASE 5: Speed & Heading-Adaptive Fovea Controller
**Objective:** The differentiator only one competitor has started — we complete and quantify it.

* **5.1 Vehicle Dynamics Input (`core/grid/fovea_controller.py`):**
  * Inputs: ego-velocity $v$ (m/s), heading $\psi$ (rad), lateral curvature $\kappa$ (1/m), GPU load $\mathcal{L}$
* **5.2 Velocity-Adaptive Ring Stretching:**
  * At speed $v > 5\text{ m/s}$, Ring 0 extends forward in the direction of motion: $r_\text{extended} = r_0 + \lambda_v \cdot v$
  * Forward cells maintain fine resolution further; rear cells coarsen earlier
* **5.3 Heading-Adaptive Fovea Bending:**
  * Turn curvature $\kappa$ biases fovea centre toward the inside of the turn
  * Cells on the inside of a turn (obstacle risk zone) are held finer longer
* **5.4 Compute Load Throttle:**
  * If FPS drops below 20 Hz: non-critical outer ring cells step up one coarseness level
  * If FPS > 30 Hz: compute headroom allows fine cells to extend an extra ring
* **5.5 Hazard Score Integration:**
  $$\mathcal{H}(u, v) = w_r\frac{r}{R_\max} - w_\sigma\frac{\sigma_z}{\sigma_\max} - w_s \cdot \mathcal{S}_\text{hazard}(\mathcal{C}) - w_v\frac{|v|}{v_\max} + w_g \mathcal{L}$$
  * Fine at $\mathcal{H} \leq 0.25$; coarse at $\mathcal{H} > 0.80$

---

### PHASE 6: Moving Object Segmentation & FreeDOM Anti-Ghosting
**Objective:** Eliminate ghost trails. This is table stakes, but we implement it correctly.

* **6.1 Residual Velocity MOS (`core/tracking/mos_filter.py`):**
  * After deskewing, compute inter-frame displacement at ego-motion-compensated positions
  * Flag points with $|v_\text{residual}| > 0.3\text{ m/s}$ as dynamic
  * Route dynamic points to Entity Pool; static points only touch the elevation grid
* **6.2 Conservative Free-Space Ray-Clearing (`core/tracking/free_space_eraser.py`):**
  * Bresenham 2.5D ray trace from sensor origin to hit point
  * Cells traversed by clear rays: decrement log-odds $L_t = L_{t-1} - l_\text{free}$
  * If $L_t < L_\text{threshold}$: cell elevation is cleared back to unfused state
  * **No timeout heuristics** — only geometry-driven evidence decay
* **6.3 3D Kalman Entity Tracker (`core/tracking/kalman_tracker.py`):**
  * State: $\mathbf{x} = [x, y, z, \dot{x}, \dot{y}, \dot{z}]^T$
  * Euclidean cluster → oriented 3D bounding box per entity
  * 1-second forward trajectory prediction for proactive path planning

---

### PHASE 7: Indian/Off-Road Fine-Tuning (IDD-3D + RELLIS-3D)
**Objective:** The Indian/off-road class advantage is still rare — make it real, not claimed.

* **7.1 IDD-3D Pseudo-Label Generation (`data/pseudo_label_idd3d.py`):**
  * IDD-3D provides 3D bounding boxes, not per-point labels
  * Assign point-level labels within each bounding box by projecting semantic class from box label
  * Map 17 IDD-3D categories into our 12 traversability classes
* **7.2 RELLIS-3D Class Alignment (`data/rellis_loader.py`):**
  * Load 20 RELLIS classes; map to our traversability taxonomy
  * Critical classes: `mud → terrain_soft`, `puddle → terrain_soft`, `rubble → terrain_rough`, `tall_grass → vegetation_low`
* **7.3 Fine-Tuning Run (`scripts/finetune.py`):**
  * Start from SalsaNext pretrained weights (SemanticKITTI)
  * Fine-tune final segmentation head on RELLIS-3D + IDD-3D pseudo-labels
  * Use class-weighted loss functions to handle cattle/pothole class imbalance
* **7.4 Honest Reporting:**
  * SemanticKITTI eval: report our mIoU vs SalsaNext baseline 59.5%
  * RELLIS-3D eval: report our mIoU vs SalsaNext baseline **43.07%** and KPConv **19.07%**
  * No inflated claims. Distance-binned breakdown for every dataset.

---

### PHASE 8: Planner Regret Benchmark (Nav2 Hybrid-A*)
**Objective:** Prove compression costs nothing that matters to navigation.

* **8.1 Traversability Costmap Exporter (`core/planning/costmap_generator.py`):**
  * Translate elevation + slope + roughness + clearance + semantic friction → 2D cost grid (0–255)
  * Export in `grid_map_msgs` format for Nav2 compatibility
* **8.2 Vectorized Hybrid-A* Planner (`core/planning/hybrid_a_star.py`):**
  * Dubins / Reeds-Shepp kinodynamic expansion with minimum turning radius
  * Incorporates clearance penalty from dual-elevation overhang data
* **8.3 Automated 100-Run Regret Suite (`benchmark/regret_benchmark.py`):**
  * 100 randomized goal positions (10–80m range) across SemanticKITTI and RELLIS-3D scenes
  * Compare: Dense 5cm ground-truth map vs FoveaGrid 2.5D adaptive map
  * **Metrics reported:**
    * Trajectory cost regret: $\mathcal{R} < 1.5\%$
    * Max path deviation: $\mathcal{D}_\max < 10\text{ cm}$
    * Collision rate on compressed map: target $0.0\%$
    * Planning compute speedup: target $>10\times$ faster collision checks
  * **Per-ring memory breakdown** alongside regret number (dossier explicitly requests this)

---

### PHASE 9: UI/UX Pro Max Telemetry Console
**Objective:** Visual analytics that make the judge stop and stare.

* **9.1 FastAPI Binary WebSocket Server (`dashboard/server/app.py`):**
  * Serialize grid state as interleaved `Float32Array` / `Uint8Array` — zero JSON overhead
  * Target: 30–60 FPS updates at `<5%` CPU server cost
* **9.2 React + Vite + deck.gl Dashboard (`dashboard/client/`):**
  * Dual-viewport: raw 3D point cloud (coloured by semantic class) vs FoveaGrid 2.5D elevation surface
  * Animated fovea rings that visibly tighten/loosen with vehicle speed (toggle-able)
  * Before/after ghost-trail removal slider
* **9.3 The Memory Paradox Live Bar (the dossier calls this a "Wow" feature):**
  * `Dense 3D Voxel: 3,200 MB` — Ruby Red
  * `Uniform 2.5D Grid: 128 MB` — Amber
  * `FoveaGrid 2.5D: 3.42 MB` — Electric Green → **"97.3% Saved | 0.0% Regret"**
  * Per-ring breakdown expandable below the main bar
* **9.4 Overhang & Pothole Inspector:**
  * Click any cell → vertical cross-section showing $z_\text{ground}$, $z_\text{ceiling}$, $\Delta z_\text{clearance}$, pass/fail
  * Pothole depth indicator with colour-coded severity
* **9.5 Confidence Heat-Map Layer:**
  * Toggle to show per-cell Bayesian height uncertainty $\sigma_z$ as a colour overlay
  * High uncertainty cells shown with diagonal striped pattern indicating degraded evidence

---

### PHASE 10: Adversarial Stress Tests, Jetson Orin Profiling & Evaluation Report
**Objective:** Bulletproof every claim before judges probe it.

* **10.1 Degraded Sensor Stress Harness (`benchmark/stress_harness.py`):**
  * Dropped Beams: 64 → 32 → 16 beams; verify uncertainty spikes and fovea coarsens gracefully
  * Rain/Dust Noise: Gaussian noise $\sigma = 0.2\text{m}$ and random clutter points
  * Odometry Jitter: 50ms latency spike in deskewing; verify no ghost accumulation
  * **Report: "System degrades predictably — it never fully fails"**
* **10.2 Embedded Hardware Profiling (Jetson Orin):**
  * Cycle latency per module on Orin Nano vs AGX Orin
  * FPS reported separately for CPU and GPU (dossier requires this breakdown)
  * Power consumption under continuous 10 Hz mapping
* **10.3 Competitive One-Slide Matrix (`docs/competitive_matrix.md`):**
  * Dossier requests explicit comparison against VRgrid, sih_053, LiFovea, kaushik645, saxenaatharv
  * Row per feature; checkmark table showing what we have vs what they have
* **10.4 Evaluation Report (`benchmark/generate_report.py`):**
  * Auto-generate PDF/Markdown dossier with all quantified metrics:
    * Per-distance mIoU (0–10m, 10–25m, 25–50m, 50–100m) on SemanticKITTI and RELLIS-3D
    * Memory per ring and total (MB) vs 3.2GB and 128MB baselines
    * Planner regret % and max path deviation (cm)
    * FPS on CPU and GPU, cycle latency per module (ms)
    * Stress test pass/fail matrix
