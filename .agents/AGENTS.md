# FoveaGrid 2.5D — Workspace Agent Rules & Skill Protocols

## Project Context

**Problem Statement:** SIH26053 — Adaptive Variable-Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception  
**Client / Evaluator:** Defence Research and Development Organisation (DRDO)  
**Objective:** Deliver an uncompromising, battle-tested perception stack for autonomous UGVs and dynamic mixed-traffic navigation.  

Every line of code and architectural decision is held to the highest standard of engineering rigor:
* **Zero Bluffing:** No fabricated accuracy numbers or pseudo-benchmarks. Every metric is computed against real ground truth.
* **Deterministic Memory:** Preallocated, cache-aligned spatial structures with provable bounds ($<3.5\text{ MB}$).
* **Defensible Differentiators:** Dual-elevation overhang tracking, multi-factor foveation, Welford Bayesian variance, and planner-regret verification.

---

## 1. MANDATORY: The Claude Council Protocol

**For any core algorithmic modification, mathematical formulation change, data contract update, or architectural decision, you MUST convene the Claude Council.**

The Claude Council is an autonomous, cross-disciplinary deliberative board comprising 6 expert personas:
1. **The Systems Architect:** Enforces memory bounds, thread safety, latency budgets, and interface contracts.
2. **The LiDAR Perception Scientist:** Audits point cloud math, range projections, sensor physics, and semantic segmentation heads.
3. **The Robotics & Controls Lead:** Validates ROS 2 compliance (REP 103/105), odometry deskewing, and coordinate frames.
4. **The Edge & CUDA Performance Hacker:** Guards against memory leaks, branch divergence, cache misses, and Jetson Orin throttles.
5. **The UI/UX Pro Max Lead:** Ensures the dashboard delivers an awe-inspiring, Linear/Vercel-grade visual analytics experience.
6. **The DRDO / Defense Red Teamer:** Aggressively attacks the implementation for failure modes (overhangs, thin poles, ghost trails, mud/craters).

*Skill Location:* `.agents/skills/claude_council/SKILL.md`  
*Trigger:* Any system design change, new module introduction, or performance refactor.

---

## 2. MANDATORY: The UI_UX_PRO_MAX Protocol

**Any time you touch the frontend, dashboard, 3D visualization, telemetry widgets, or presentation UI, you MUST invoke the 10-point `UI_UX_PRO_MAX` audit.**

*Skill Location:* `.agents/skills/ui_ux_pro_max/SKILL.md`  
*Standards:*
- Dark-mode first, sleek aerospace/defense telemetry aesthetics (Linear, Raycast, Vercel standard).
- Smooth 60 FPS WebGL / deck.gl rendering of 3D point clouds and 2.5D multi-layer grids.
- Real-time animated memory delta visualization (3.2 GB $\to$ 128 MB $\to$ 3.42 MB).
- Interactive cross-section inspection for overhang clearance and pothole depth.
- No generic, unstyled components or default browser styling.

---

## 3. Specialized Domain Skills

The agent environment possesses dedicated skill packages located in `.agents/skills/`:

| Skill Name | Path | Purpose |
| :--- | :--- | :--- |
| `claude_council` | `.agents/skills/claude_council/SKILL.md` | Multi-perspective algorithmic audit and defense red teaming. |
| `ui_ux_pro_max` | `.agents/skills/ui_ux_pro_max/SKILL.md` | 10-point visual design, 3D visualization, and telemetry audit. |
| `lidar_perception_pipeline` | `.agents/skills/lidar_perception_pipeline/SKILL.md` | Deskewing, range images, semantic inference, and MOS anti-ghosting. |
| `adaptive_grid_engine` | `.agents/skills/adaptive_grid_engine/SKILL.md` | Nested lattice indexing, Welford's variance, and dual-elevation math. |
| `planner_regret_benchmark` | `.agents/skills/planner_regret_benchmark/SKILL.md` | Hybrid-A* / MPPI closed-loop trajectory comparison and divergence metrics. |

---

## 4. Engineering & Code Invariants

### 4.1 Memory & Performance Invariants
* **Strict Memory Footprint:** The 2.5D spatial hash must never dynamically allocate inside the real-time loop. Cells are pooled in a preallocated flat array.
* **Cache Alignment:** Spatial cell data structures must remain 32-byte or 64-byte aligned to maximize CPU cache line efficiency.
* **Online Statistics:** Always use **Welford's algorithm** for running mean and variance. Never store arrays of raw height measurements per cell.
* **Coordinate Consistency:** Adhere strictly to **ROS REP 103** (X forward, Y left, Z up) and **REP 105** (`map` $\to$ `odom` $\to$ `base_link` $\to$ `lidar`).

### 4.2 Python & C++ Quality Rules
* **Type Annotations:** Strict typing on all Python functions (`numpy.typing.NDArray`, `typing.Tuple`, `dataclasses`).
* **NumPy Vectorization:** Zero raw Python `for` loops over LiDAR points. All spatial binning and coordinate conversions must use vectorized NumPy, Numba JIT, or CuPy GPU kernels.
* **Defensive Boundary Handling:** Ring lattice indexing must enforce whole-integer scale factors ($k \in \{1, 2, 5, 10\}$) to ensure provably zero seam gaps.

---

## 5. Folder & Project Structure

```
.agents/
├── AGENTS.md
└── skills/
    ├── claude_council/
    │   └── SKILL.md
    ├── ui_ux_pro_max/
    │   └── SKILL.md
    ├── lidar_perception_pipeline/
    │   └── SKILL.md
    ├── adaptive_grid_engine/
    │   └── SKILL.md
    └── planner_regret_benchmark/
        └── SKILL.md
core/
├── ingestion/          # LiDAR readers, deskewing, odometry interface
├── perception/         # Semantic segmentation, range image, MOS
├── grid/               # Nested lattice, Welford fusion, dual-elevation
├── tracking/           # Dynamic object tracker, Kalman filters, ghost eraser
└── planning/           # Costmap exporter, Nav2 bridge, Hybrid-A* regret
dashboard/
├── server/             # FastAPI / WebSocket binary stream
└── client/             # deck.gl + Three.js 60fps telemetry UI
benchmark/              # SemanticKITTI, RELLIS-3D, IDD-3D evaluation scripts
docs/                   # Architecture, competitive audits, judge guides
```
