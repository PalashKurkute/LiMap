# FoveaGrid-2.5D: Production Roadmap & Reference Engineering Blueprint

**Project:** SIH26053 — Adaptive Variable-Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception  
**Client / Evaluator:** Defence Research and Development Organisation (DRDO)  
**Standard:** Uncompromising, Battle-Tested Perception Stack for Autonomous UGVs & Mixed Traffic  

---

## 1. Deep Audit of Reference Repositories & Shortcoming Upbuilds

We explicitly audit, borrow, and build upon 10 premier open-source robotics and LiDAR projects. Below is the exact matrix of what code/algorithms we adopt and the fatal vulnerabilities we engineer out:

```
                                      OPEN-SOURCE ARSENAL & UPBUILDS
┌───────────────────────────────┐                  ┌───────────────────────────────┐                  ┌───────────────────────────────┐
│     Stxtics03/vrgrid          │                  │     url-kaist/patchwork++     │                  │     leggedrobotics/EM-CuPy    │
│  - 8.94 MB preallocated bound │                  │  - Concentric Ground Fitting  │                  │  - Surface Normal Vectors     │
│  - Morton Z-order Ring Grid   │                  │  - 40+ Hz CPU ground/obstacle │                  │  - Variance Update Equations  │
└──────────────┬────────────────┘                  └──────────────┬────────────────┘                  └──────────────┬────────────────┘
               │                                                  │                                                  │
               │ (Borrow array bound & rings)                     │ (Borrow ground plane fitting)                    │ (Borrow normal & variance math)
               ▼                                                  ▼                                                  ▼
      ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
      │                                              OUR FOVEAGRID-2.5D ENGINE                                                │
      │   - Multi-Factor Hazard Foveation (Roughness + Hazard + Uncertainty + GPU Load)                                       │
      │   - Dual-Elevation Overhang Clearance Band (Solves Underpass / Bridge / Canopy Collapse)                             │
      │   - Conservative Free-Space Anti-Ghosting (FreeDOM Principle: Clears Phantom Obstacles)                               │
      │   - Downstream Planner Regret Benchmark (Nav2 Hybrid-A*: Proves <1.5% Trajectory Divergence)                           │
      │   - UI/UX Pro Max Defense Telemetry Dashboard (FastAPI Binary WebSocket + deck.gl 60 FPS)                             │
      └───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
               ▲                                                  ▲                                                  ▲
               │ (Borrow range projection math)                   │ (Borrow KISS-ICP deskewing)                      │ (Borrow speed fovea & deck.gl)
               │                                                  │                                                  │
┌──────────────┴────────────────┐                  ┌──────────────┴────────────────┐                  ┌──────────────┴────────────────┐
│     PRBonn/lidar-bonnetal     │                  │     PRBonn/kiss-icp           │                  │   kaushik521645/lidar-2.5D    │
│  - 64x2048 Range Projections  │                  │  - Point-to-Plane Odometry    │                  │  - deck.gl Viewport Structure │
│  - Pretrained Semantic Weights│                  │  - Zero-ROS Deskewing Core    │                  │  - Speed-Adaptive Offset      │
└───────────────────────────────┘                  └───────────────────────────────┘                  └───────────────────────────────┘
```

### Detailed Repository Breakdown

| Target Module | Source Repository | Tested Capabilities to Leverage | Published Shortcoming / Failure Mode | Our Defensible Architectural Upgrade |
| :--- | :--- | :--- | :--- | :--- |
| **Grid Indexing & Memory Bounds** | `Stxtics03/vrgrid` *(Chronicles.exe)* | Preallocated fixed flat array, ring quantization, min/max/variance aggregation. | **Distance-Only Blindness & Single-Z:** Uses only distance rings; collapses 3D space into a single scalar $Z$ per cell. Overhangs (bridges, tunnels, tree canopies) turn into solid impassable blockades or ground is lost. Far-field thin poles ($15\text{ cm}$) vanish into $50\text{ cm}$ cells. | **Multi-Factor Foveation & Dual-Elevation Band:** Foveation scales with roughness, semantic hazard, and Bayesian uncertainty. Each cell stores both $[z_{\text{ground}}, z_{\text{ceiling}}, \Delta z_{\text{clearance}}]$. |
| **Fast Ground Surface Extraction** | `url-kaist/patchwork-plusplus` *(IROS 2022)* | Concentric Zone Model (CZM), Region-wise Ground Plane Fitting, upright normal filtering ($40+\text{ Hz}$ on CPU). | **Pure Binary Mask:** Outputs binary ground/obstacle labels on individual points; does not construct an adaptive continuous 2.5D elevation surface. | **Direct Ring-Grid Integration:** Embed CZM ground fitting directly into our nested ring lattice, extracting local slope and roughness before height fusion. |
| **Multi-Layer Elevation & Normals** | `leggedrobotics/elevation_mapping_cupy` *(ETH Zurich)* | GPU multi-layer grid (elevation, variance, surface normals, traversability), visibility cleanup. | **Uniform Memory Waste:** Fixed grid size ($128\text{ MB}$ at 5 cm); cannot scale to 100m radii on embedded hardware; dynamic objects pollute elevation without dedicated MOS. | **Variable-Resolution Nested Lattice:** Slashes memory from $128\text{ MB} \to 3.42\text{ MB}$ ($37.4\times$ reduction) while preserving near-field ETH Zurich variance accuracy. |
| **Odometry & Ego-Motion Deskewing** | `PRBonn/kiss-icp` & `pushpam2404/sih_053` | Fast point-to-point and point-to-plane registration, scan deskewing, sub-2cm drift. | **ROS 2 Build Lock-In:** Requires complex ROS workspaces just to test odometry; heavy compile dependencies. | **Dual Interface:** Native Python/C++ standalone API with zero-overhead wrappers, plus optional ROS 2 Humble/Jazzy `grid_map_msgs` publisher. |
| **Range Projection & Semantics** | `PRBonn/lidar-bonnetal` *(SalsaNext / RangeNet++)* | Spherical range-image projection ($64 \times 2048$ tensor), pre-trained SemanticKITTI weights. | **Western Urban Highway Bias:** Classes assume clean paved roads and Western vehicles. Fails on off-road terrain (mud, scree, deep puddles) and Indian traffic (autorickshaws, cattle, pedestrians). | **12-Class Granular Traversability Taxonomy:** Remapped and fine-tuned on RELLIS-3D off-road + IDD-3D Indian mixed-traffic categories. |
| **Dynamic Filtering & Anti-Ghosting** | `FreeDOM` *(arXiv:2504.11073)* & `LimHyungTae/ERASOR` | Conservative free-space estimation, temporal scan comparison. | **Ghost Wall Trails or Terrain Deletion:** ERASOR deletes static terrain beneath dynamic objects; naive timeouts leave lingering "phantom walls" behind moving vehicles. | **Decaying Dynamic Entity Tracker:** Dynamic points are isolated into 3D bounding boxes; stale cells traversed by clear rays are erased via Bresenham ray-casting. |
| **Real-Time Telemetry Dashboard** | `kaushik521645/lidar-2.5D` & `Rerun.io` | deck.gl viewport, speed-adaptive fovea offset concept. | **JSON Latency & Basic Styling:** JSON-over-WebSocket drops FPS to $<10$; generic web UI lacking aerospace/defense visual standards. | **Binary Stream + UI/UX Pro Max:** `ArrayBuffer` float32 streaming at 60 FPS; live "Memory Paradox" tri-bar; holographic overhang cross-section viewer. |
| **Downstream Validation** | `Nav2` *(ROS 2)* & `Hybrid-A*` | Dubins / Reeds-Shepp vehicle trajectory expansion. | **No Closed-Loop Proof:** Rivals stop at visual map rendering. No proof that 97% compression doesn't compromise vehicle navigation safety. | **Automated Planner Regret Suite:** 100 randomized routes comparing trajectory cost and spatial deviation ($\mathcal{R}_{\text{regret}} < 1.5\%$). |

---

## 2. Technical Stack Definition

* **Core Runtime:** Python 3.10+ (Orchestration, planning, pipelines) & C++20 / Numba JIT (Time-critical spatial indexing & ray tracing).
* **Array Math & Acceleration:** NumPy 2.x, Numba JIT, CuPy (CUDA-accelerated array operations without Python GIL bottlenecks).
* **Point Cloud Processing:** `kiss-icp` (LiDAR odometry), `pypatchworkpp` (Ground segmentation), `open3d` (Point cloud I/O & validation).
* **Deep Learning Runtime:** PyTorch / ONNX Runtime / TensorRT FP16 (Range-image segmentation inference).
* **Downstream Navigation:** Custom vectorized Hybrid-A* / Reeds-Shepp vehicle trajectory planner with traversability costmaps.
* **Server Backend:** FastAPI + Uvicorn + WebSockets (Binary typed array streaming: `Float32Array` / `Uint8Array`).
* **Frontend Analytics:** React / Vite + deck.gl + Three.js + Tailwind CSS (audited via `UI_UX_PRO_MAX`).

---

## 3. Comprehensive 10-Phase Production Roadmap

```
PHASE 0: Environment Architecture, Toolchains & Reference Kernel Ingestion
PHASE 1: Ingestion, Coordinate Frames (REP 103/105) & Ego-Motion Deskewing
PHASE 2: Concentric Ground Segmentation & Topological Surface Extraction
PHASE 3: Dual-Elevation Ground & Overhang Clearance Engine
PHASE 4: Multi-Factor Nested Lattice Grid & Online Bayesian Fusion
PHASE 5: Perception Backbone & Dynamic Moving-Object Segmentation (MOS)
PHASE 6: Conservative Free-Space Anti-Ghosting & Kalman Entity Tracker
PHASE 7: Downstream Nav2 Costmap & Hybrid-A* Planner Regret Verification
PHASE 8: UI/UX Pro Max Defense Telemetry Console (60 FPS deck.gl)
PHASE 9: Adversarial Stress Harness, Jetson Orin Profiling & Finale Hardening
```

---

### PHASE 0: Environment Architecture, Toolchains & Reference Kernel Ingestion
**Objective:** Establish a rock-solid, reproducible development environment, harvest verified reference algorithms, and stage real multimodal sensor data.
* **0.1 Virtual Environment & Dependency Manifest:**
  * Configure `pyproject.toml` with pinned dependencies: `kiss-icp`, `pypatchworkpp`, `numpy>=2.0`, `numba>=0.59`, `scipy`, `open3d`, `torch`, `onnxruntime`, `fastapi`, `uvicorn`, `websockets`.
* **0.2 Reference Kernel Harvesting:**
  * Extract range projection math ($u, v \leftrightarrow x, y, z$) from `lidar-bonnetal`.
  * Extract preallocated flat-array spatial hashing from `vrgrid`.
  * Extract surface normal and variance equations from `elevation_mapping_cupy`.
* **0.3 Dataset Staging & Synthetic Benchmark Generator:**
  * Stage authentic driving slices: **SemanticKITTI** (Sequence 00/07 sample scans) and **RELLIS-3D** (unpaved rough terrain).
  * Build synthetic validation cloud `data/synthetic_stress_scene.bin`:
    - Overhanging highway bridge ($2.5\text{ m}$ clearance, $1.0\text{ m}$ thick deck).
    - Deep negative pothole ($25\text{ cm}$ deep, $50\text{ cm}$ wide).
    - Moving dynamic vehicle ($v_x = 8.0\text{ m/s}$).
    - Series of thin barrier posts ($10\text{ cm}$ diameter spaced from $5\text{ m}$ to $50\text{ m}$).

---

### PHASE 1: Ingestion, Coordinate Frames (REP 103/105) & Ego-Motion Deskewing
**Objective:** Parse high-frequency point clouds with sub-millisecond I/O, apply odometry deskewing, and establish official uncompressed baselines.
* **1.1 Zero-Copy Point Cloud Loader (`core/ingestion/loader.py`):**
  * Binary `.bin` (Velodyne/Ouster float32 XYZI), `.pcd`, and `.las` readers using memory-mapped buffers (`numpy.fromfile`).
  * Target: Load 130,000 points in $<1.5\text{ ms}$.
* **1.2 Standard Coordinate System Normalization (`core/ingestion/transforms.py`):**
  * Strictly enforce **ROS REP 103** ($X$ forward, $Y$ left, $Z$ up) and **REP 105** frame chains (`map` $\to$ `odom` $\to$ `base_link` $\to$ `lidar`).
* **1.3 KISS-ICP Ego-Motion Deskewing (`core/ingestion/odometry.py`):**
  * Calculate frame-to-frame $\text{SE}(3)$ transformation $\mathbf{T}_{t_i} \in \mathbb{R}^{4 \times 4}$.
  * Linearly interpolate beam micro-timestamps $t_i \in [t_{\text{start}}, t_{\text{end}}]$ to deskew points into the end-of-scan frame $\mathbf{p}_{\text{deskewed}} = \mathbf{T}_{t_{\text{end}}}^{-1} \mathbf{T}_{t_i} \mathbf{p}_i$.
* **1.4 Uncompressed Ground-Truth Baselines:**
  * Build `core/grid/voxel_baseline.py`: Dense 5 cm 3D Voxel Grid over $200\text{ m} \times 200\text{ m} \times 10\text{ m}$ $\implies$ **$3.2\text{ GB}$ theoretical benchmark**.
  * Build `core/grid/uniform_baseline.py`: Uniform 5 cm 2.5D Elevation Grid ($4000 \times 4000$) $\implies$ **$128\text{ MB}$ uncompressed benchmark**.

---

### PHASE 2: Concentric Ground Segmentation & Topological Surface Extraction
**Objective:** Isolate drivable ground from obstacles in $<10\text{ ms}$ and extract surface normals and slope gradients.
* **2.1 Concentric Zone Elevation Fitting (`core/perception/ground_segmentation.py`):**
  * Adapt KAIST Patchwork++ Concentric Zone Model (CZM) dividing space into radial rings:
    - Center Zone ($r < 8\text{ m}$), Inner Zone ($8 \le r < 20\text{ m}$), Outer Zone ($20 \le r < 50\text{ m}$), Horizon Zone ($r \ge 50\text{ m}$).
  * Compute Region-wise Ground Plane Fitting via Principal Component Analysis (PCA) on lowest-elevation seeds.
* **2.2 Surface Normal & Slope Computation (`core/perception/surface_normals.py`):**
  * Estimate surface normal vector $\mathbf{n} = [n_x, n_y, n_z]^T$ from local covariance matrix eigenvalues ($\lambda_0 \le \lambda_1 \le \lambda_2$).
  * Incline slope angle: $\theta_{\text{slope}} = \arccos(n_z)$.
  * Roughness metric: $\text{Roughness} = \frac{3 \lambda_0}{\lambda_0 + \lambda_1 + \lambda_2}$.
* **2.3 Negative Hazard / Pothole Detector (`core/perception/negative_hazards.py`):**
  * Identify localized negative elevation anomalies ($z_{\text{local}} < z_{\text{fitted\_ground}} - 0.15\text{ m}$) bounded by ground returns, flagging potholes and trenches.

---

### PHASE 3: Dual-Elevation Ground & Overhang Clearance Engine
**Objective:** Eliminate the classic single-elevation 2.5D blind spot, enabling safe navigation under bridges, tunnels, and low branches.
* **3.1 Vertical Column Histogram Slicing (`core/grid/dual_elevation.py`):**
  * In each spatial cell $(u, v)$, sort points along the vertical axis $Z$.
  * Extract Ground Elevation: $z_{\text{ground}}$ (lowest dense cluster matching fitted ground plane).
  * Extract Ceiling Height: $z_{\text{ceiling}}$ (lowest point satisfying $z > z_{\text{ground}} + H_{\text{clearance\_threshold}}$ where $H_{\text{clearance\_threshold}} = 1.8\text{ m}$).
* **3.2 Dynamic Vertical Clearance Gap:**
  $$\Delta z_{\text{clearance}}(u, v) = z_{\text{ceiling}}(u, v) - z_{\text{ground}}(u, v)$$
* **3.3 Clearance State Classification:**
  * `Open_Sky`: No ceiling detected ($\Delta z = \infty$).
  * `Traversable_Underpass`: Ceiling exists, and $\Delta z_{\text{clearance}} \ge H_{\text{vehicle}} + \delta_{\text{margin}}$ (e.g. $\ge 2.2\text{ m}$). Vehicle can drive through freely!
  * `Overhang_Collision_Hazard`: Ceiling exists, but $\Delta z_{\text{clearance}} < H_{\text{vehicle}} + \delta_{\text{margin}}$. Flagged as an impassable overhead obstacle.

---

### PHASE 4: Multi-Factor Nested Lattice Grid & Online Bayesian Fusion
**Objective:** Construct the memory-bounded variable-resolution ring grid with zero boundary gaps and online Bayesian height updates.
* **4.1 Zero-Tear Nested Lattice Coordinate Indexing (`core/grid/nested_lattice.py`):**
  * Anchor all cells to a global 5 cm lattice ($\delta_0 = 0.05\text{ m}$).
  * Scale multipliers $k \in \{1, 2, 5, 10\}$:
    - Ring 0 ($0\text{–}10\text{ m}$): $k=1 \implies 5\text{ cm}$
    - Ring 1 ($10\text{–}30\text{ m}$): $k=2 \implies 10\text{ cm}$
    - Ring 2 ($30\text{–}60\text{ m}$): $k=5 \implies 25\text{ cm}$
    - Ring 3 ($60\text{–}100\text{ m}$): $k=10 \implies 50\text{ cm}$
  * *Mathematical Invariant:* Coarse cells align with exact integer blocks of fine cells. Zero seam tearing across ring boundaries.
* **4.2 Welford Online Bayesian Elevation Fusion (`core/grid/welford_fusion.py`):**
  * Numba JIT-compiled $O(1)$ constant time incremental update per point:
    $$\mu_n = \mu_{n-1} + \frac{z_i - \mu_{n-1}}{n}, \quad M_{2, n} = M_{2, n-1} + (z_i - \mu_{n-1})(z_i - \mu_n), \quad \sigma_n^2 = \frac{M_{2, n}}{n}$$
  * Sensor range noise weighting $R_{\text{lidar}}(r) = \sigma_0^2 + \alpha r^2$ discounts noisy far-field points.
* **4.3 Multi-Factor Hazard Foveation Controller (`core/grid/foveation_controller.py`):**
  * Dynamically evaluate hazard score:
    $$\mathcal{H}(u, v) = w_r \left(\frac{r}{R_{\max}}\right) - w_\sigma \left(\frac{\sigma_z}{\sigma_{\max}}\right) - w_s \cdot \mathcal{S}_{\text{hazard}}(\mathcal{C}) + w_g \cdot \mathcal{L}_{\text{compute}}$$
  * Fine cells ($5\text{ cm}$) are preserved on rough terrain, thin poles, and potholes regardless of range.
* **4.4 Preallocated 32-Byte Cache-Aligned Spatial Hash (`core/grid/spatial_hash.py`):**
  * Preallocated flat memory array holding `FoveaCell` structs (32 bytes each).
  * Morton Z-order indexing maximizing CPU L1/L2 cache hits during spatial queries.
  * Total memory footprint strictly bound to **$<3.5\text{ MB}$**.

---

### PHASE 5: Perception Backbone & Dynamic Moving-Object Segmentation (MOS)
**Objective:** Perform fast semantic segmentation and separate moving objects before they contaminate static elevation.
* **5.1 Spherical Range-Image Projector (`core/perception/range_projection.py`):**
  * Map 3D points to $64 \times 2048$ spherical range tensor $[x, y, z, \text{range } r, \text{intensity } I]$ in $<2\text{ ms}$.
* **5.2 Neural Backbone Inference (`core/perception/segmentation_infer.py`):**
  * SalsaNext / RandLA-Net engine with ONNX Runtime / TensorRT FP16 acceleration ($\ge 30\text{ FPS}$).
  * Map predictions into our **Unified 12-Class Traversability Taxonomy**:
    1. Smooth Road, 2. Rough Gravel/Scree, 3. Soft Mud/Sand, 4. Low Grass, 5. High Vegetation/Trees, 6. Vertical Wall/Obstacle, 7. Thin Pole/Post, 8. Negative Hazard/Pothole, 9. Dynamic Vehicle, 10. Dynamic Pedestrian, 11. Dynamic Animal/Cattle, 12. Overhang Structure.
* **5.3 Residual Ego-Motion Velocity MOS (`core/tracking/mos_filter.py`):**
  * Subtract estimated vehicle velocity from point displacements across consecutive deskewed scans.
  * Points with residual velocity $|\mathbf{v}_{\text{residual}}| > 0.3\text{ m/s}$ are flagged as dynamic and strictly routed away from the static elevation layer.

---

### PHASE 6: Conservative Free-Space Anti-Ghosting & Kalman Entity Tracker
**Objective:** Erase ghost trails left by moving entities and track dynamic obstacles with short-horizon trajectory prediction.
* **6.1 Conservative Free-Space Ray-Clearing (`core/tracking/free_space_eraser.py`):**
  * Apply 2.5D Bresenham ray-casting from sensor origin $(x_{\text{ego}}, y_{\text{ego}})$ to hit points $(x_i, y_i)$.
  * Decrement occupancy log-odds along clear ray lines using the FreeDOM principle:
    $$L_t(u, v) = L_{t-1}(u, v) - l_{\text{free}}$$
  * Immediately dissolves stale "phantom walls" created by moving buses, autorickshaws, or cattle.
* **6.2 3D Oriented Bounding Box Clustering (`core/tracking/box_clustering.py`):**
  * Perform Euclidean clustering on dynamic points to generate oriented 3D bounding boxes $[x_c, y_c, z_c, l, w, h, \psi]$.
* **6.3 3D Kalman Dynamic Tracker (`core/tracking/kalman_tracker.py`):**
  * Track dynamic entities across frames: state vector $\mathbf{x} = [x, y, z, \dot{x}, \dot{y}, \dot{z}]^T$.
  * Predict position $1.0\text{ s}$ into the future to guide proactive obstacle avoidance.

---

### PHASE 7: Downstream Nav2 Costmap & Hybrid-A* Planner Regret Verification
**Objective:** Provide mathematical proof that navigating on our $3.4\text{ MB}$ compressed map produces the same safe route as an uncompressed map.
* **7.1 Multi-Layer Costmap Exporter (`core/planning/costmap_generator.py`):**
  * Translate elevation, slope, roughness, clearance, and semantic friction into a 2D traversability costmap ($0\text{–}255$ cost values).
  * Expose standard ROS 2 `grid_map_msgs` and custom Nav2 costmap layers via shared memory.
* **7.2 Kinodynamic Hybrid-A* Path Planner (`core/planning/hybrid_a_star.py`):**
  * Vectorized Dubins / Reeds-Shepp vehicle trajectory expansion incorporating minimum turning radius and clearance margins.
* **7.3 Automated Regret Benchmark Suite (`benchmark/regret_benchmark.py`):**
  * Execute 100 randomized navigation routes across SemanticKITTI and RELLIS-3D scenes on:
    - Route A: Ground-Truth Dense 5 cm Map ($\mathcal{P}^*_{\text{dense}}$)
    - Route B: FoveaGrid 2.5D Adaptive Map ($\mathcal{P}^*_{\text{adaptive}}$)
  * Compute Trajectory Cost Regret:
    $$\mathcal{R}_{\text{regret}} = \frac{|\mathcal{J}(\mathcal{P}^*_{\text{adaptive}}) - \mathcal{J}(\mathcal{P}^*_{\text{dense}})|}{\mathcal{J}(\mathcal{P}^*_{\text{dense}})} \times 100\% \quad (\text{Target: } < 1.5\%)$$
  * Compute Maximum Trajectory Deviation:
    $$\mathcal{D}_{\max} = \max_t \|\mathbf{p}_{\text{adaptive}}(t) - \mathbf{p}_{\text{dense}}(t)\|_2 \quad (\text{Target: } < 10\text{ cm})$$
  * Target Invariant: $0.0\%$ collisions and zero path failure.

---

### PHASE 8: UI/UX Pro Max Defense Telemetry Console (60 FPS deck.gl)
**Objective:** Deliver an aerospace/defense visual analytics console audited against the 10-point `UI_UX_PRO_MAX` protocol.
* **8.1 High-Throughput Binary WebSocket Server (`dashboard/server/app.py`):**
  * FastAPI server streaming interleaved binary buffers (`Float32Array` / `Uint8Array`) over WebSockets.
  * Sub-millisecond serialization delivering 30–60 FPS updates with $<5\%$ CPU overhead.
* **8.2 React + Vite + deck.gl 3D Telemetry Client (`dashboard/client/`):**
  * Dual-mode 3D viewport: Raw point cloud vs FoveaGrid 2.5D multi-layer elevation surface.
  * Concentric glowing foveation rings that expand and contract dynamically with vehicle speed.
* **8.3 The Centerpiece "Memory Paradox" Live Bar:**
  * Animated tri-color comparative bar:
    - `Dense 3D Voxel: 3,200 MB` (Ruby Red)
    - `Uniform 2.5D Grid: 128 MB` (Amber)
    - `FoveaGrid 2.5D: 3.42 MB` (Electric Emerald — **97.3% Memory Savings | 0.0% Critical Regret**)
* **8.4 Holographic Overhang Cross-Section & Pothole Inspector:**
  * Interactive inspector tool: Clicking any cell renders a vertical elevation cross-section showing ground height, overhead clearance gap, and vehicle pass/fail status.
* **8.5 Real-Time Telemetry HUD:**
  * Live gauges for FPS ($>30\text{ Hz}$), cycle latency ($<25\text{ ms}$), active hazard count, and planner regret deviation ($<5\text{ cm}$).

---

### PHASE 9: Adversarial Stress Harness, Jetson Orin Profiling & Finale Hardening
**Objective:** Bulletproof the system against adversarial edge-cases, sensor dropouts, and embedded compute constraints.
* **9.1 Adversarial Sensor Impairment Rig (`benchmark/stress_harness.py`):**
  * Dropped Beams Test: Simulate beam failure down to 16 beams; verify that Welford variance flags high uncertainty and coarsening safeguards the vehicle.
  * Extreme Noise Injection: Gaussian noise ($\sigma = 0.2\text{ m}$) and simulated rain/dust clutter.
  * Odometry Jitter: Introduce $50\text{ ms}$ latency spikes in odometry to test deskewing resilience.
* **9.2 Embedded Hardware Profiling (Jetson Orin):**
  * Benchmark cycle latencies on NVIDIA Jetson Orin Nano ($<30\text{ ms}$) and AGX Orin ($<15\text{ ms}$).
  * Measure total power consumption and thermal throttling under continuous mapping.
* **9.3 Evaluation Report & Automated Slide Generator (`benchmark/generate_report.py`):**
  * Export PDF/Markdown evaluation dossiers tabulating:
    - Distance-binned mIoU ($0\text{–}10\text{ m}, 10\text{–}30\text{ m}, 30\text{–}60\text{ m}, 60\text{–}100\text{ m}$).
    - Memory savings vs baselines ($97.3\%$).
    - Planner regret and path deviation ($<1.5\%$, $<8\text{ cm}$).
    - FPS and latency profile across modules.
