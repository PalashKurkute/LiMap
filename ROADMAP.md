# FoveaGrid-2.5D: Production Roadmap & Architecture Blueprint

**Project:** SIH26053 — Adaptive Variable-Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception  
**Evaluator:** Defence Research and Development Organisation (DRDO)  
**Standard:** Zero-Fluff, Production-Ready Perception Stack for Autonomous UGVs & Mixed Traffic  

---

## 1. Reference Repositories & Shortcoming Upbuild Matrix

We do not build from theoretical abstractions. We dissect existing open-source implementations, adopt their proven modules, and systematically resolve their published failure modes:

| Target Module | Reference Repository | What We Borrow / Leverage | Competitor Shortcoming | Our Concrete Engineering Upgrade |
| :--- | :--- | :--- | :--- | :--- |
| **Grid Memory & Spatial Hashing** | `Stxtics03/vrgrid` *(Chronicles.exe)* | Preallocated fixed array, ring bounding, Morton Z-order indexing. | **Distance-Only & Single-Z:** Coarsens everything at range; destroys thin poles; collapses 3D space into a single $Z$ (blind to bridges/canopies). | **Multi-Factor Foveation + Dual-Elevation:** Resolution adapts to roughness, hazard, and uncertainty; stores both $[z_{\text{ground}}, z_{\text{ceiling}}]$. |
| **Multi-Layer Elevation & Normals** | `leggedrobotics/elevation_mapping_cupy` *(ETH Zurich)* | Surface normal estimation, traversability friction, variance update equations. | **Uniform Memory Waste:** Fixed grid size ($128\text{ MB}$ at 5 cm); no foveation; moving objects permanently contaminate terrain. | **Adaptive Nested Lattice:** Multi-scale resolution saving $37.4\times$ memory ($3.42\text{ MB}$); decoupled dynamic layer. |
| **Ego-Motion & Odometry** | `PRBonn/kiss-icp` & `pushpam2404/sih_053` | Fast point-to-plane ICP registration, micro-timestamp deskewing. | **Heavy ROS Lock-in:** Competing repos require heavy ROS 2 setups; hard to test standalone. | **Dual Interface:** Standalone Python/C++ core with optional ROS 2 Humble/Jazzy `grid_map` bridge. |
| **Range Projection & Semantics** | `PRBonn/lidar-bonnetal` *(RangeNet++ / SalsaNext)* | Spherical range-image projection ($64 \times 2048$ tensor), pretrained weights. | **Western Highway Bias:** Trained only on SemanticKITTI. Fails on off-road mud/potholes and Indian cattle/rickshaws. | **12-Class Traversability Remap:** Fine-tuned on RELLIS-3D off-road + IDD-3D Indian mixed-traffic categories. |
| **Dynamic Filtering & Anti-Ghosting** | `LimHyungTae/ERASOR` & `FreeDOM` *(arXiv:2504.11073)* | Conservative free-space ray tracing, dynamic point isolation. | **Ghost Trails / Point Deletion:** Deleting points permanently removes terrain; simple timeouts leave lingering "phantom walls". | **Decaying Dynamic Layer:** Moving points tracked as 3D bounding boxes; stale ground cleared via Bresenham ray-casting. |
| **Dashboard & Telemetry** | `kaushik521645/lidar-2.5D` & `Rerun.io` | deck.gl viewport structure, speed-adaptive fovea offset concept. | **JSON Bottleneck & Ugly UI:** JSON-over-WebSocket throttles browser to $<10\text{ FPS}$; basic unstyled UI lacking defense telemetry. | **Binary Stream + UI/UX Pro Max:** `ArrayBuffer` float32 streaming at 60 FPS; live "Memory Paradox" bar; overhang slice inspector. |
| **Downstream Validation** | `Nav2` *(ROS 2)* & `Hybrid-A*` | Dubins / Reeds-Shepp vehicle trajectory expansion. | **No Closed Loop:** Rivals stop at "here is the map." No proof that compression doesn't degrade vehicle navigation. | **Planner Regret Suite:** Automated 100-run comparison showing $\mathcal{R}_{\text{regret}} < 1.5\%$ and $\mathcal{D}_{\max} < 10\text{ cm}$. |

---

## 2. Technical Stack Definition

* **Language Core:** Python 3.10+ (Architecture orchestration & planning) + C++20 / Numba JIT (Time-critical spatial loops).
* **Array Math:** NumPy 2.x, Numba JIT, CuPy (CUDA-accelerated array math without Python GIL bottlenecks).
* **LiDAR Processing:** `kiss-icp` (LiDAR odometry), `open3d` (Point cloud I/O & geometry checks).
* **Deep Learning Runtime:** PyTorch / ONNX Runtime / TensorRT FP16 (Range-image segmentation inference).
* **Downstream Planning:** Vectorized Hybrid-A* / Dubins path generator with traversability cost evaluation.
* **Server Backend:** FastAPI + Uvicorn + WebSockets (Binary typed array streaming: `Float32Array` / `Uint8Array`).
* **Frontend Analytics:** React / Vite + deck.gl + Three.js + Tailwind CSS (audited via `UI_UX_PRO_MAX`).

---

## 3. Phase-by-Phase Implementation Roadmap

```
PHASE 0: Environment & Reference Ingestion  ---> Setup dependencies, sample data, extract reference kernels
PHASE 1: Ingestion, Deskewing & Baselines   ---> KITTI/RELLIS loader, KISS-ICP odometry, 3D & Uniform 5cm baselines
PHASE 2: FoveaGrid 2.5D Core Engine        ---> Nested lattice (5/10/25/50cm), Welford variance, Dual-elevation band
PHASE 3: Perception Backbone & MOS Tracker  ---> Range-image segmentation, 12 traversability classes, FreeDOM anti-ghosting
PHASE 4: Downstream Planner Regret Suite   ---> Nav2 / Hybrid-A* trajectory comparison, <1.5% regret verification
PHASE 5: UI/UX Pro Max Telemetry Dashboard ---> deck.gl 60 FPS viewport, live 3.2 GB -> 3.42 MB memory paradox bar
```

---

### PHASE 0: Environment Setup, Reference Repo Ingestion & Pretrained Weights
**Goal:** Stand up the runtime environment, acquire raw test data slices, and extract validated algorithmic building blocks.
* **0.1 Dependency Manifest:**
  * Configure `pyproject.toml` / `requirements.txt` with: `kiss-icp`, `numpy>=2.0`, `numba>=0.59`, `scipy`, `open3d`, `torch`, `onnxruntime`, `fastapi`, `uvicorn`, `websockets`.
* **0.2 Data Staging:**
  * Stage verified test sequences from **SemanticKITTI** (Sequence 00/07 sample scans) and **RELLIS-3D** (off-road trail sample scans).
  * Generate a synthetic stress test: Point cloud containing an overhanging bridge (2.5 m clearance), a narrow pothole (20 cm deep, 40 cm wide), and a moving vehicle.
* **0.3 Reference Kernel Harvesting:**
  * Extract range projection math from `lidar-bonnetal`.
  * Extract fixed-memory array indexing from `vrgrid`.

---

### PHASE 1: Ingestion, Deskewing & Ground-Truth Baselines
**Goal:** Ingest raw LiDAR streams, correct for vehicle ego-motion, and build the uncompressed baselines against which memory and accuracy are benchmarked.
* **1.1 Multi-Format Point Cloud Reader (`core/ingestion/loader.py`):**
  * Support binary `.bin` (Velodyne/Ouster float32 XYZI), `.pcd`, and `.las`.
  * Benchmarked I/O: Memory-mapped reads loading 130,000 points in $<1.5\text{ ms}$.
* **1.2 KISS-ICP Ego-Motion Compensation (`core/ingestion/odometry.py`):**
  * Compute frame-to-frame $\text{SE}(3)$ transformation $\mathbf{T}_{t_i} \in \mathbb{R}^{4 \times 4}$.
  * Deskew raw points based on beam acquisition timestamps, eliminating motion elongation artifacts.
* **1.3 Dense 3D Voxel Ground-Truth Baseline (`core/grid/voxel_baseline.py`):**
  * Generate uniform 5 cm 3D voxel grid over a $200\text{ m} \times 200\text{ m} \times 10\text{ m}$ domain.
  * Establish the official **$3.2\text{ GB}$ theoretical memory benchmark**.
* **1.4 Uniform 5 cm 2.5D Elevation Baseline (`core/grid/uniform_baseline.py`):**
  * Generate uncompressed $4000 \times 4000$ elevation map storing height, variance, and class ($8\text{ bytes/cell}$).
  * Establish the official **$128\text{ MB}$ uncompressed 2.5D benchmark**.

---

### PHASE 2: FoveaGrid 2.5D Core Engine (The Novel Spatial Representation)
**Goal:** Build the memory-bounded variable-resolution ring grid with zero boundary gaps, online Bayesian fusion, and dual-elevation overhang resolution.
* **2.1 Zero-Tear Nested Lattice Indexing (`core/grid/nested_lattice.py`):**
  * Anchor all cells to a global 5 cm lattice ($\delta_0 = 0.05\text{ m}$).
  * Enforce strict integer scale multipliers $k \in \{1, 2, 5, 10\}$:
    * Ring 0 ($0\text{–}10\text{ m}$): $k=1 \implies 5\text{ cm}$
    * Ring 1 ($10\text{–}30\text{ m}$): $k=2 \implies 10\text{ cm}$
    * Ring 2 ($30\text{–}60\text{ m}$): $k=5 \implies 25\text{ cm}$
    * Ring 3 ($60\text{–}100\text{ m}$): $k=10 \implies 50\text{ cm}$
  * *Verification Test:* Zero spatial coordinate mismatch or seam tearing across 1,000,000 boundary points.
* **2.2 Welford Online Bayesian Elevation Fusion (`core/grid/welford_fusion.py`):**
  * Implement Numba JIT-compiled Welford updates computing running mean $\mu_z$ and sample variance $\sigma_z^2$ in $O(1)$ constant time per point.
  * Integrate Kalman sensor noise weighting $R_{\text{lidar}}(r) = \sigma_0^2 + \alpha r^2$ to discount noisy far-field returns.
* **2.3 Dual-Elevation & Overhang Clearance Extractor (`core/grid/dual_elevation.py`):**
  * Implement vertical column histogram analysis:
    * $z_{\text{ground}}$: Filtered ground elevation.
    * $z_{\text{ceiling}}$: Lowest point of overhanging structure ($z > z_{\text{ground}} + H_{\text{clearance}}$).
    * $\Delta z_{\text{clearance}} = z_{\text{ceiling}} - z_{\text{ground}}$.
  * Flag cells as `Open_Ground`, `Traversable_Underpass` ($\Delta z \ge H_{\text{vehicle}} + \text{margin}$), or `Overhang_Collision`.
* **2.4 Multi-Factor Hazard Foveation Controller (`core/grid/foveation_controller.py`):**
  * Dynamically evaluate hazard score:
    $$\mathcal{H} = w_r \left(\frac{r}{R_{\max}}\right) - w_\sigma \left(\frac{\sigma_z}{\sigma_{\max}}\right) - w_s \cdot \mathcal{S}_{\text{hazard}}(\mathcal{C}) + w_g \cdot \mathcal{L}_{\text{compute}}$$
  * Fine cells ($5\text{ cm}$) are preserved on rough terrain, thin poles, and potholes regardless of range.
* **2.5 Preallocated Cache-Aligned Spatial Hash Table (`core/grid/spatial_hash.py`):**
  * Flat preallocated array of 32-byte `FoveaCell` structs.
  * Total memory footprint strictly locked to **$<3.5\text{ MB}$**.

---

### PHASE 3: Perception Backbone & Dynamic MOS Anti-Ghosting
**Goal:** Classify point semantics and prevent moving objects from corrupting static elevation maps.
* **3.1 Spherical Range-Image Projector (`core/perception/range_projection.py`):**
  * Fast $64 \times 2048$ spherical projection converting unorganized point clouds into structured range tensors $[x, y, z, r, I]$.
* **3.2 Semantic Segmentation Backbone (`core/perception/segmentation_infer.py`):**
  * SalsaNext / RandLA-Net inference engine running in TensorRT / ONNX Runtime ($>30\text{ FPS}$).
  * Remap predictions into our **Unified 12-Class Traversability Taxonomy**:
    1. Smooth Road, 2. Rough Gravel/Scree, 3. Soft Mud/Sand, 4. Low Grass, 5. High Vegetation/Trees, 6. Vertical Obstacle/Wall, 7. Thin Pole/Post, 8. Negative Hazard/Pothole, 9. Dynamic Vehicle, 10. Dynamic Pedestrian, 11. Dynamic Animal/Cattle, 12. Overhang Structure.
* **3.3 Moving Object Segmentation (MOS) Engine (`core/tracking/mos_filter.py`):**
  * Separate points with residual ego-motion velocity $|\mathbf{v}_{\text{residual}}| > 0.3\text{ m/s}$.
  * Route dynamic points away from the static elevation grid into the **Dynamic Entity Pool**.
* **3.4 Conservative Free-Space Ray-Clearing (`core/tracking/free_space_eraser.py`):**
  * Trace laser beams through previously occupied voxels. If rays pass through without obstruction, decrement occupancy log-odds using the FreeDOM principle.
  * Eliminates dynamic "ghost walls" left behind by moving trucks or cattle.
* **3.5 3D Kalman Dynamic Tracker (`core/tracking/kalman_tracker.py`):**
  * Cluster dynamic points into 3D oriented bounding boxes.
  * Track states $\mathbf{x} = [x, y, z, \dot{x}, \dot{y}, \dot{z}]$ with linear velocity vector extrapolation.

---

### PHASE 4: Downstream Planner Regret Benchmark (The Concrete Proof)
**Goal:** Prove mathematically that navigating on our $3.4\text{ MB}$ compressed map produces the identical safe route as an uncompressed map.
* **4.1 Costmap Bridge (`core/planning/costmap_generator.py`):**
  * Transform multi-layer 2.5D grid into a 2D traversability costmap incorporating slope, roughness, clearance, and semantic friction.
  * Export standard ROS 2 `grid_map_msgs` and Nav2 custom costmap layer formats.
* **4.2 Kinodynamic Hybrid-A* Path Planner (`core/planning/hybrid_a_star.py`):**
  * Vectorized Reeds-Shepp vehicle trajectory expansion with continuous orientation yaw $\theta$.
* **4.3 Automated Regret Benchmark Suite (`benchmark/regret_benchmark.py`):**
  * Generate 100 randomized mission trajectories across SemanticKITTI and RELLIS-3D scenes.
  * Compute Trajectory Cost Regret:
    $$\mathcal{R}_{\text{regret}} = \frac{\mathcal{J}(\mathcal{P}^*_{\text{adaptive}}) - \mathcal{J}(\mathcal{P}^*_{\text{dense}})}{\mathcal{J}(\mathcal{P}^*_{\text{dense}})} \times 100\% \quad (\text{Invariant: } < 1.5\%)$$
  * Compute Maximum Trajectory Deviation:
    $$\mathcal{D}_{\max} = \max_t \|\mathbf{p}_{\text{adaptive}}(t) - \mathbf{p}_{\text{dense}}(t)\|_2 \quad (\text{Invariant: } < 10\text{ cm})$$
  * Log collision rate (Target: $0.0\%$ collisions).

---

### PHASE 5: UI/UX Pro Max Defense Telemetry Dashboard
**Goal:** Deliver an awe-inspiring, Linear/Raycast-grade defense analytics console.
* **5.1 High-Throughput Binary WebSocket Server (`dashboard/server/`):**
  * FastAPI asynchronous server streaming interleaved float32/uint8 typed arrays.
  * Zero JSON parsing latency; handles 30 FPS updates with $<5\%$ CPU load.
* **5.2 React + Vite + deck.gl 3D Viewport (`dashboard/client/`):**
  * Dual-mode visualizer: Raw 3D point cloud vs FoveaGrid 2.5D multi-layer elevation surface.
  * Glowing concentric foveation ring overlays that dynamically breathe and steer with vehicle velocity.
* **5.3 The Centerpiece "Memory Paradox" Live Bar:**
  * Animated tri-color comparative bar:
    * `Dense 3D Voxel: 3,200 MB` (Ruby Red)
    * `Uniform 2.5D Grid: 128 MB` (Amber)
    * `FoveaGrid 2.5D: 3.42 MB` (Electric Emerald — **97.3% Memory Savings | 0.0% Critical Regret**)
* **5.4 Holographic Overhang Cross-Section & Pothole Inspector:**
  * Interactive inspector tool: Clicking any cell renders a vertical elevation cross-section showing ground height, overhead clearance gap, and vehicle pass/fail status.
* **5.5 Real-Time Telemetry HUD:**
  * Live gauges for FPS ($>30\text{ Hz}$), cycle latency ($<25\text{ ms}$), active hazard count, and planner regret deviation ($<5\text{ cm}$).
