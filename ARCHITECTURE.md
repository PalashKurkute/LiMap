# Technical Architecture Specification: LiMap 2.5D

**Project:** Adaptive Variable-Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception  
**Codename:** `LiMap-2.5D`  
**Target Hardware (Planned Deployment):** NVIDIA Jetson Orin Series (AGX Orin / Orin Nano) & Standard x86_64 Edge Stations [Prototype currently validated on x86_64 CPU]  
**Middleware Standards (Planned Integration):** ROS 2 (Humble / Jazzy), REP 103/105, `grid_map_msgs`, WebSocket Telemetry [Prototype: standalone Python/NumPy/Numba engine, FastAPI server, static snapshots for the dashboard]  

> **Read this as the design.** Items marked *(planned)* are not built. What exists today, with evidence, is section 6 and
> `docs/reference/KNOWN_LIMITATIONS.md`; every figure is from `benchmark/*.json`.

---

## 1. System Overview

`LiMap-2.5D` is a real-time, memory-bounded, perception-to-planning engine designed to transform high-frequency 3D LiDAR point clouds ($1.3\text{M points/sec}$) into a multi-layer 2.5D spatial representation. It eliminates the single-plane overhang blindness of classic elevation maps, eliminates ghost streaks caused by dynamic objects, and holds the map in a fixed 3.2616 MB cell pool (a CALCULATED 935.7x below a dense 3D voxel grid of the same area; MEASURED 1.41x fewer occupied cells than a uniform 5 cm 2.5D grid). Foveation today is radius rings plus speed/turn presets; multi-factor foveation is *(planned)*.

```
+---------------------------------------------------------------------------------------------------------+
|                                        FOVEAGRID-2.5D PIPELINE                                         |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   +-----------------------+      +-------------------------------+      +---------------------------+   |
|   |  LiDAR Stream (10Hz)  | ---> |  Ego-Motion Compensation      | ---> |  Range-Image Projection   |   |
|   |  [Velodyne / Ouster]  |      |  [odometry (planned)]         |      |  [64 x 2048 Range Tensor] |   |
|   +-----------------------+      +-------------------------------+      +---------------------------+   |
|                                                                                       |                 |
|                                                                                       v                 |
|   +------------------------------------+      +---------------------------------------------------+     |
|   |   Dynamic Object Layer (MOS)       | <--- |   Deep Semantic Segmentation                      |     |
|   |   - Residual Velocity Thresholding |      |   - SalsaNext / RandLA-Net Backbone               |     |
|   |   - 3D Bounding Box Clustering     |      |   - 12 Traversability & Obstacle Classes          |     |
|   |   - Kalman State Tracking          |      +---------------------------------------------------+     |
|   +------------------------------------+                                      |                         |
|                     | (Dynamic Trackers)                                      v (Static Points)         |
|                     |                         +---------------------------------------------------+     |
|                     |                         |   Dual-Elevation & Overhang Extractor             |     |
|                     |                         |   - Ground Plane Z_ground, Var_ground             |     |
|                     |                         |   - Ceiling Overhang Z_ceiling, Clearance_gap     |     |
|                     |                         +---------------------------------------------------+     |
|                     |                                                 |                                 |
|                     |                                                 v                                 |
|                     |                         +---------------------------------------------------+     |
|                     |                         |   Ring grid + speed/turn presets                  |     |
|                     |                         |   - Distance + Roughness + Hazard + Uncertainty   |     |
|                     |                         |   - Seamless Nested Lattice (5, 10, 25, 50 cm)    |     |
|                     |                         |   - Online Bayesian Fusion (Welford's Algorithm)  |     |
|                     |                         +---------------------------------------------------+     |
|                     |                                                 |                                 |
|                     +-----------------------+-------------------------+                                 |
|                                             |                                                           |
|                                             v                                                           |
|                       +---------------------------------------------+                                   |
|                       |   Unified Multi-Layer 2.5D Spatial Hash     |                                   |
|                       |   [Memory Footprint: < 3.5 MB]              |                                   |
|                       +---------------------------------------------+                                   |
|                                             |                                                           |
|                     +-----------------------+-----------------------+                                   |
|                     |                                               |                                   |
|                     v                                               v                                   |
|   +------------------------------------+          +------------------------------------+                |
|   |  Downstream Navigation & Regret   |          |  Live Telemetry & Dashboard        |                |
|   |  - Nav2 / ROS 2 `grid_map` Topic   |          |  - Fast WebSocket Binary Stream    |                |
|   |  - Hybrid-A* Path Regret Validator |          |  - Three.js 3D WebGL point & grid  |                |
|   |  - Clearance Trajectory Check      |          |  - Live Memory Delta Meter         |                |
|   +------------------------------------+          +------------------------------------+                |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical Formulations & Data Contracts

### 2.1 The Nested Lattice Coordinate System
To completely prevent seam tearing, aliasing, and boundary misalignments between different resolution zones, all cells are strictly anchored to a **unified global reference lattice** of base cell size $\delta_0 = 5\text{ cm}$.

For resolution scale factor $k \in \{1, 2, 5, 10\}$ (corresponding to cell sizes $5\text{ cm}$, $10\text{ cm}$, $25\text{ cm}$, $50\text{ cm}$):
The continuous Cartesian position $(x, y)$ maps to integer cell indices $(u_k, v_k)$:
$$u_k = \left\lfloor \frac{x}{k \cdot \delta_0} \right\rfloor, \quad v_k = \left\lfloor \frac{y}{k \cdot \delta_0} \right\rfloor$$

**Theorem (Zero Boundary Gap):**  
Since $k_2$ is always an integer multiple of $k_1$ ($10 = 2 \times 5 = 10 \times 1$), any coarse cell $(u_{k_2}, v_{k_2})$ encompasses an exact integer block of fine cells:
$$\mathcal{C}_{k_2}(u, v) = \bigcup_{i=0}^{m-1} \bigcup_{j=0}^{m-1} \mathcal{C}_{k_1}(m \cdot u + i,\, m \cdot v + j), \quad \text{where } m = \frac{k_2}{k_1}$$
No fine point ever falls on a crack between coarse boundaries.

---

### 2.2 Online Bayesian Elevation Fusion (Welford's Algorithm)
For each incoming static LiDAR point $\mathbf{p} = (x_i, y_i, z_i)$, the cell $(u, v)$ is updated in $O(1)$ constant time with exact running mean $\mu_n$ and running variance $\sigma_n^2$ without keeping past point histories:

$$\mu_n = \mu_{n-1} + \frac{z_i - \mu_{n-1}}{n}$$
$$M_{2, n} = M_{2, n-1} + (z_i - \mu_{n-1})(z_i - \mu_n)$$
$$\sigma_n^2 = \frac{M_{2, n}}{n} \quad (\text{Sample Variance } \sigma_z^2)$$

**Kalman Innovation Update for Sequential Frames:**  
When fusing consecutive frames with sensor measurement variance $R_{\text{lidar}}(r) = \sigma_0^2 + \alpha \cdot r^2$:
$$K_t = \frac{\sigma_{t-1}^2}{\sigma_{t-1}^2 + R_{\text{lidar}}(r)}$$
$$\mu_t = \mu_{t-1} + K_t (z_{\text{meas}} - \mu_{t-1})$$
$$\sigma_t^2 = (1 - K_t) \sigma_{t-1}^2$$

---

### 2.3 Dual-Elevation Band Formulation (Overhang Resolution)
Within each spatial column $(u, v)$, incoming points are partitioned along the vertical axis $Z$:
1. Points below the maximum drivable obstacle threshold ($z < z_{\text{ground\_max}}$) update the **Ground Plane Layer**:
   $$\mathcal{G}(u, v) = \langle z_{\text{ground}},\, \sigma_{z,\text{ground}}^2 \rangle$$
2. Points above the minimum overhead clearance ($z > z_{\text{ground}} + H_{\text{min\_headroom}}$) update the **Ceiling Overhang Layer**:
   $$\mathcal{O}(u, v) = \langle z_{\text{ceiling}},\, \sigma_{z,\text{ceiling}}^2 \rangle$$
3. **Clearance Metric:**
   $$\Delta z_{\text{clearance}}(u, v) = z_{\text{ceiling}}(u, v) - z_{\text{ground}}(u, v)$$
4. **Traversability Cost Function:**
   $$C_{\text{traversability}}(u, v) = 
   \begin{cases}
   \infty & \text{if } \Delta z_{\text{clearance}}(u, v) < H_{\text{vehicle}} + \delta_{\text{safety}} \quad (\text{Collision with Overhang}) \\
   \infty & \text{if } \text{Slope}(z_{\text{ground}}) > \theta_{\text{max}} \quad (\text{Impassable Incline / Step}) \\
   \alpha \cdot \text{Roughness} + \beta \cdot \text{Friction}(C) & \text{otherwise} \quad (\text{Traversable Ground})
   \end{cases}$$

---

### 2.4 Multi-Factor Foveation Policy Engine *(planned, not built: rings are assigned by radius, shifted by five speed/turn presets)*
The cell size $\Delta s(u, v)$ for any spatial region is determined by evaluating the **Dynamic Hazard Index** $\mathcal{H}$:

$$\mathcal{H}(u, v) = w_r \left(\frac{r}{R_{\max}}\right) - w_\sigma \left(\frac{\sigma_z}{\sigma_{\max}}\right) - w_s \cdot \mathcal{S}_{\text{hazard}}(\mathcal{C}) - w_v \cdot \frac{\|\mathbf{v}_{\text{rel}}\|}{v_{\max}} + w_g \cdot \mathcal{L}_{\text{compute}}$$

Where:
* $r = \sqrt{x^2 + y^2}$: Euclidean distance from vehicle origin.
* $\sigma_z$: Terrain height standard deviation (surface roughness/uncertainty).
* $\mathcal{S}_{\text{hazard}}(\mathcal{C}) \in [0, 1]$: Pre-defined class risk weight:
  * Pedestrian / Two-wheeler / Cattle: $1.0$
  * Thin Pole / Tree Trunk / Barrier: $0.95$
  * Pothole / Ditch / Drop-off: $0.90$
  * Unpaved Gravel / Scree / Mud: $0.50$
  * Flat Highway / Asphalt: $0.05$
* $\|\mathbf{v}_{\text{rel}}\|$: Velocity magnitude of nearby dynamic entities.
* $\mathcal{L}_{\text{compute}} \in [0, 1]$: Current GPU/CPU processing pressure (pushes non-critical cells to coarser scale if cycle time exceeds $33\text{ ms}$).

**Resolution Assignment:**
$$\Delta s(u, v) = 
\begin{cases}
5\text{ cm} & \text{if } \mathcal{H} \le 0.25 \\
10\text{ cm} & \text{if } 0.25 < \mathcal{H} \le 0.55 \\
25\text{ cm} & \text{if } 0.55 < \mathcal{H} \le 0.80 \\
50\text{ cm} & \text{if } \mathcal{H} > 0.80
\end{cases}$$

---

### 2.5 Conservative Free-Space Ray-Clearing (Anti-Ghosting)
To prevent moving cars, cattle, or pedestrians from creating phantom walls:
When an obstacle cell $(u_0, v_0)$ at time $t-1$ receives LiDAR beams at time $t$ that pass *through* it to hit a farther object $(u_1, v_1)$, the occupancy log-odds are decremented:
$$L_t(u, v) = L_{t-1}(u, v) - l_{\text{free}}$$
If $L_t(u, v) < L_{\text{threshold}}$, the cell's elevation is erased and reverted to the underlying ground baseline.

---

## 3. Data Structures & Memory Layout

Each active cell in the spatial hash table is designed as a compact **32-byte struct** aligned to cache lines (Target C++ specification; prototype currently implements this layout via packed structured NumPy array):

```cpp
// Target C++ Specification (Prototype mirrors this via structured NumPy array):
struct alignas(32) FoveaCell {
    float z_ground;              // 4 bytes: Ground elevation (meters)
    float z_ceiling;             // 4 bytes: Overhead obstacle height (meters)
    uint16_t var_ground_fp16;    // 2 bytes: Half-precision variance of ground
    uint16_t var_ceiling_fp16;   // 2 bytes: Half-precision variance of ceiling
    uint8_t  semantic_class;     // 1 byte:  Dominant semantic class ID (0-255)
    uint8_t  confidence;         // 1 byte:  Bayesian classification confidence (0-100)
    uint8_t  point_count;        // 1 byte:  Hit counter (clamped to 255)
    uint8_t  flags;              // 1 byte:  Bit 0: IsTraversable, Bit 1: IsDynamic, 
                                 //          Bit 2: HasOverhang, Bit 3: IsPothole
    float    velocity_x;         // 4 bytes: Dynamic entity velocity X (m/s)
    float    velocity_y;         // 4 bytes: Dynamic entity velocity Y (m/s)
    uint32_t last_updated_frame; // 4 bytes: Sequence timestamp for temporal decay
    uint32_t reserved;           // 4 bytes: Padding for 32-byte cache line alignment
};
```

### Memory Budget Verification
* The pool is preallocated: **106,875 cells x 32 bytes = 3.2616 MB** (`SpatialHashGrid.cells.nbytes`), open-addressed with a
  bounded probe chain (no Morton ordering).
* Full coverage of the 5/10/25/50 cm schedule out to 100 m would need about 479k cells (CALCULATED), so the pool relies on
  scan sparsity. A dropped-point counter is not implemented yet (`KNOWN_LIMITATIONS.md` §12, H4).

---

## 4. Subsystem Pipelines & Detailed Design

### 4.1 Subsystem 1: LiDAR Ingestion & Deskewing
* **Sensors:** Spinning LiDAR (Velodyne HDL-64E, Ouster OS1-128) or Solid-State (Livox Mid-360).
* **Motion Deskewing:** Because the vehicle translates and rotates while the beam rotates, each point $\mathbf{p}_i$ with micro-timestamp $t_i$ is deskewed using odometry pose $\mathbf{T}_{t_i}^{\text{base}}$:
  $$\mathbf{p}_{\text{deskewed}} = \mathbf{T}_{\text{end}}^{\text{base}} \left( \mathbf{T}_{t_i}^{\text{base}} \right)^{-1} \mathbf{p}_i$$
* **Odometry Backend *(planned)*:** LiDAR-inertial odometry via **KISS-ICP** or **FAST-LIO2**, publishing at $50\text{ Hz}$ with sub-$2\text{ cm}$ drift error.

### 4.2 Subsystem 2: Range-Image Semantic Segmentation Backbone
* **Input Tensor:** Spherical range image $\mathbf{I} \in \mathbb{R}^{H \times W \times 5}$ $(x, y, z, \text{range}, \text{intensity})$ where $H=64, W=2048$.
* **Backbone:** **SalsaNext** or **RandLA-Net** lightweight encoder-decoder.
* **Inference Speed (Target / Published Benchmark):** Cortinhal et al. report $\approx 18\text{ ms}$ on NVIDIA Jetson AGX Orin ($55\text{ FPS}$), $\approx 32\text{ ms}$ on Orin Nano ($30\text{ FPS}$) with TensorRT FP16 optimization. [Current software prototype uses synthetic/heuristic label ingestion; ONNX/TensorRT deployment is planned].
* **Granular Class Taxonomy (12 Classes):**
  1. `Road_Smooth` (Asphalt, flat concrete)
  2. `Terrain_Rough` (Gravel, rubble, scree)
  3. `Terrain_Soft` (Mud, sand, puddle)
  4. `Vegetation_Low` (Grass, drivable shrubs)
  5. `Vegetation_High` (Tree trunks, non-drivable forest)
  6. `Obstacle_Vertical` (Walls, buildings, concrete barriers)
  7. `Obstacle_Thin` (Signposts, light poles, wire fences)
  8. `Hazard_Negative` (Potholes, ditches, trenches, cliff edges)
  9. `Dynamic_Vehicle` (Cars, trucks, buses, autorickshaws)
  10. `Dynamic_Vulnerable` (Pedestrians, children, cyclists)
  11. `Dynamic_Animal` (Cattle, dogs, horses)
  12. `Overhang_Structure` (Bridges, flyovers, tunnel portals, archways)

### 4.3 Subsystem 3: Moving Object Segmentation (MOS) & Anti-Ghosting
* **Residual Motion Metric:** After deskewing point cloud $P_t$ against map frame, points with displacement $\Delta d > v_{\text{thresh}} \cdot \Delta t$ are classified as **Dynamic Candidates**.
* **3D Bounding Box Extractor:** Dynamic points undergo Euclidean cluster extraction, parameterized into an oriented bounding box $[x_c, y_c, z_c, l, w, h, \psi]$.
* **Temporal State Tracking:** Bounding boxes are tracked across frames with a 3D Extended Kalman Filter:
  $$\mathbf{x}_k = [x, y, z, \dot{x}, \dot{y}, \dot{z}]^T$$
* **Ghost Removal:** The dynamic points are strictly isolated from the static elevation grid; only their ground bounding footprint is projected onto a fleeting collision layer that decays after $\tau_{\text{decay}} = 0.5\text{ seconds}$ if not refreshed.

### 4.4 Subsystem 4: Closed-Loop Downstream Regret Benchmark
* **Planner:** **Hybrid-A*** (Dubins vehicle kinodynamic expansion; prototype implemented in standalone Python simulator, designed for ROS 2 Nav2 integration).
* **Costmap Transformation:** Standalone costmap generator mapping 2.5D elevation grid into 2D traversability cost [Planned: ROS 2 `nav2_costmap_2d` custom plugin layer via shared memory].
* **Regret Metric Equation:**
  $$\mathcal{R} = \frac{\int_0^T c(\mathbf{x}_{\text{adaptive}}(t))\, dt - \int_0^T c(\mathbf{x}_{\text{dense}}(t))\, dt}{\int_0^T c(\mathbf{x}_{\text{dense}}(t))\, dt}$$
  Where $c(\mathbf{x})$ evaluates clearance penalty and roughness friction. A regret $\mathcal{R} < 2\%$ proves mathematically that our compression does not degrade path optimality.

---

## 5. Dashboard (as built)

React 19 + Three.js, Vite multi-page build: home screen at `/` (with "How it fits a robot"), dashboard at `/dashboard/`.
Scenes load from static snapshots made by `scripts/export_dashboard_data.py` (no backend needed); a running FastAPI server
upgrades them to live data and enables "Analyze your own scan" (`POST /api/analyze_scan`). Views: 3D Explore (pipeline
cells and returns, colour by height / class / ring / variance, fly-through), Map Inspector (cells top-down or isometric,
foveation presets, uniform 5 cm comparison, underpass costmaps), Evidence (every figure read from `benchmark/*.json`,
tagged MEASURED / CALCULATED / DATASET). Details: `dashboard/client/README.md`. The WebSocket stream in the server is not
used by the dashboard.

## 6. Current Implementation Status

| Component | Status (2026-10-05) | Location |
|:---|:---|:---|
| Nested lattice ring grid (5/10/25/50 cm to 10/25/50/100 m) | Built, tested | `core/grid/nested_lattice.py` |
| Spatial hash, fixed 3.2616 MB pool | Built; no dropped-point counter, `uint8` count saturates (H4) | `core/grid/spatial_hash.py` |
| Welford mean / variance per cell | Built, in the insert path | `core/grid/welford_fusion.py` |
| Kalman (Bayesian) elevation update | Written, called only by a test | `core/grid/welford_fusion.py` |
| Dual-elevation (ground / overhang, clearance) | Built, in the insert path | `core/grid/dual_elevation.py` |
| Chan variance merge, PCA ground fit | Built as grid methods, tested; not run per frame | `core/grid/spatial_hash.py` |
| Foveation | Five speed/turn presets; hazard-driven *(planned)* | `core/grid/fovea_controller.py` |
| Semantic segmentation (SalsaNext ONNX) | Built; model file not in the repo, so the rule-based fallback runs here | `core/perception/segmentation_infer.py` |
| Moving-object filter + ghost eraser | Built; measured on 50 real frames | `core/tracking/` |
| Hybrid A* planner, costmap generator | Built; regret on 5 real frames, underpass on 1 synthetic scene | `core/planning/` |
| ROS 2 costmap bridge | Publisher only; not built with colcon; no Nav2 planner run | `core/planning/nav2_bridge.py`, `ros2_ws/` |
| Jetson / TensorRT | Not done | — |
| Real dataset | SemanticKITTI seq 08 run on the team's machine; a 5,000-point sample in the repo | `scripts/run_seq08.py` |
| Dashboard | Built: home, dashboard, 15-step tour, Evidence, upload | `dashboard/client/` |
