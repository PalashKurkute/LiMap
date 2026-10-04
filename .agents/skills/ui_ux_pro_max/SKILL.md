---
name: ui_ux_pro_max
description: >
  Mandatory 10-point design and visual audit protocol for all frontend dashboards,
  3D WebGL/deck.gl visualizations, telemetry meters, and user interface components.
  Enforces a world-class, premium aerospace/defense engineering standard (Linear,
  Vercel, Raycast quality).
---

# UI/UX PRO MAX Protocol — Defense & Robotics Analytics

You have activated the **UI_UX_PRO_MAX** protocol. This protocol is mandatory whenever any visual component, 3D viewport, telemetry readout, chart, or layout change is being engineered.

Before writing frontend code, you **MUST** pass all 10 audit steps below.

---

## The 10-Point Visual & Technical Audit

### Step 1 — World-Class Product Benchmarking
Identify the visual patterns from world-class engineering interfaces:
* **Linear / Raycast:** Deep charcoal dark mode, high-contrast typography, precision keyboard accelerators, glassmorphism borders (`border-white/10`).
* **Foxglove Studio / Rerun.io:** High-performance multi-view robotics layouts, synchronized timeline scrubbers, non-blocking WebGL point rendering.
* **Vercel / Stripe:** Real-time metrics streaming, clean stat callouts, glowing status badges, zero layout jitter.

### Step 2 — Visual Hierarchy & Information Priority
Ensure that safety-critical perception data takes visual precedence:
* **Level 1 (Dominant):** The Dual 3D Viewport (Raw Point Cloud vs Multi-Layer FoveaGrid).
* **Level 2 (High):** The "Memory Paradox" Bar (values read from the API baselines, never retyped; capacities are CALCULATED) and measured FPS / latency taken from `benchmark/latency_profile_results.json`, always shown next to the end-to-end-with-segmentation figure.
* **Level 3 (Supporting):** Active Hazards Table (Potholes, Low Overhangs, Dynamic Trackers) and Distance-Binned mIoU.
* **Level 4 (Auxiliary):** Sensor configuration toggles, lattice resolution selector, camera angle presets.

### Step 3 — Whitespace, Density & Proportions
Defense and robotics dashboards require high information density without feeling cluttered:
* Canvas area: Minimum $65\text{–}70\%$ of screen real estate.
* Sidebar panels: Fixed width ($360\text{–}400\text{ px}$), scrollable, with padded cards (`p-4 md:p-5`).
* Gaps: Strict $12\text{ px}$ / $16\text{ px}$ spacing between metric cards (`gap-3` or `gap-4`).

### Step 4 — Typography & Readout Precision
Robotics telemetry demands monospaced numeric precision and modern display typography:
* **Display / Headings:** Modern sans-serif (e.g., `Inter`, `Outfit`, or system font stack) with `font-semibold tracking-tight`.
* **Telemetry & Coordinates:** Strict tabular monospace (`font-mono` / `JetBrains Mono` / `SF Mono`) for all coordinates, latencies, FPS, and memory numbers to prevent layout jitter when numbers change.
* Heading scales: `text-xl font-bold` for section titles; `text-xs uppercase font-medium tracking-wider text-muted` for metric labels.

### Step 5 — Color Token System & Semantic Gating
No arbitrary hex codes. Strict semantic color palette:
* `Background:` Deep Charcoal / Slate (`#0B0F17`, `#0F172A`)
* `Card Surface:` Translucent Glass (`rgba(15, 23, 42, 0.75)` with `backdrop-blur-md`)
* `Border / Dividers:` Subtle Zinc (`rgba(255, 255, 255, 0.08)`)
* `Electric Green (Traversable / Memory Saved):` `#10B981` / `#059669`
* `Amber / Yellow (Rough Terrain / Caution):` `#F59E0B`
* `Crimson Red (Impassable Obstacle / 3D Baseline):` `#EF4444`
* `Cyan / Neon Blue (Fovea Focus Ring / Ego Path):` `#06B6D4` / `#3B82F6`
* `Violet / Purple (Dynamic Entity Trackers):` `#8B5CF6`

### Step 6 — Micro-Interactions & Real-Time Transitions
* **Live Telemetry Pulsing:** Small green indicator badge that pulses when frames are arriving at $\ge 25\text{ FPS}$.
* **Fovea Ring Visualization:** Toggling concentric rings reveals glowing rings on the grid canvas that dynamically adjust their radius as the vehicle accelerates.
* **Overhang Cross-Section Slider:** Hovering over any cell displays a vertical holographic slice showing ground clearance and overhead bridge height.

### Step 7 — 3D Viewport Performance (Zero DOM Overhead)
* Never render thousands of point entities in the DOM. Point clouds must be rendered via **deck.gl `PointCloudLayer`** or **Three.js `BufferGeometry`** using interleaved float32 typed arrays.
* Memory management: Re-use geometry buffers (`drawArrays` / instancing) without triggering JavaScript garbage collection spikes.

### Step 8 — The "Memory Paradox" Live Bar
The centerpiece proof for hackathon judges:
* Tri-bar comparative layout:
  1. Dense 3D Voxel (value from the baselines) — grey baseline bar, longest.
  2. Uniform 2.5D Elevation (value from the baselines) — grey baseline bar, intermediate.
  3. FoveaGrid pool (value from the baselines) — accent bar, labelled with the CALCULATED capacity ratio next to the MEASURED occupied-cell ratio.
* Use a log scale so the pool is visible. Never display a regret, recall or compression claim that is not in a results file, and tag each figure MEASURED / CALCULATED / ESTIMATE.

### Step 9 — Failure-State & Sensor Dropout Visuals
* When simulated sensor dropout or beam occlusion occurs, affected grid cells show a translucent diagonal-striped pattern indicating "High Uncertainty / Degraded Evidence".
* Never leave the viewport blank or crashing on unexpected NaN inputs.

### Step 10 — Accessibility & Contrast Verification
* Contrast ratio $> 4.5:1$ between text and card backgrounds.
* All interactive controls (ring toggles, playback controls, dataset switcher) are keyboard-focusable and clearly labeled.
