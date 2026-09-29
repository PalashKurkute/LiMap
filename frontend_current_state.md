# FoveaGrid 2.5D — Frontend Current State

*Note: Screenshots could not be generated programmatically in this environment. This documentation is based on a rigorous, line-by-line audit of the current React component source code (`dashboard/client/src/`). It describes exactly what is rendered and where the data is actually sourced.*

## 1. Screen & Component Inventory (with Hardcoded Flags)

The application consists of a single-page layout with a full-bleed 3D viewport, overlaid with floating UI elements and a slide-out drawer.

### 1.1 The Header & Floating Top Bar (`Header.tsx` & `App.tsx`)
**Visuals:**
- Top border-spanning header containing the title ("FoveaGrid 2.5D").
- **Live Backend Connection Indicator:** Shows `API:8000 LIVE` with a ping in ms. This is actually connected, driven by a `setInterval` fetch to `/api/telemetry` every 1.5 seconds.
- **Memory Invariant Badge:** Shows `3.2616 MB`. This is conditionally fetched from `telemetryData?.telemetry?.total_heap_mb`, defaulting to a hardcoded `3.2616 MB`.
- **"Judge Walkthrough" Button:** Opens the `JudgeOnboardingModal`.
- **Floating Top Scenario Bar:** A pill-shaped bar with buttons for 5 scenes (Bridge Underpass, Potholes & Craters, Moving Traffic, Thin Slalom Poles, Real City Driving).

### 1.2 The 3D Viewport (`ThreeViewport.tsx`)
**Visuals:**
- A 3D environment featuring a robotic vehicle (UGV) model with wheels, chassis, headlights, and a spinning LiDAR puck.
- A terrain mesh that colors itself based on height, traversability, uncertainty, or semantics.
- Ring lines indicating 10m, 25m, and 50m boundaries.

**Data Disconnects & Hardcoded Illusions:**
- **Synthetic Terrain Generation:** The terrain heightmap, bridge pillars, potholes, and slalom poles are **100% hardcoded mathematically in the frontend**. The `evalElevation(x, y)` function in `ThreeViewport.tsx` literally hardcodes sine waves for roads, `1.6m` heights for bridge pillars if `x` is between 15 and 25, and `Math.cos()` bell curves for potholes. **No point cloud or DEM data is being streamed into the 3D viewport from the backend.**
- **Vehicle Kinematics:** The vehicle's position is initialized to fixed coordinates (`x=-2.0, y=0.0, z=-1.41`) and is completely static. The `carTelemetry` state in `App.tsx` (which would feed it) is initialized to 0 and is never updated by any WebSocket or API response.
- **Fovea Rings:** The range rings are static `Three.RingGeometry` meshes drawn at fixed radii, not adaptive bounds derived from data.

### 1.3 Tactical Objective Card (`TacticalObjectiveCard.tsx`)
**Visuals:**
- A floating card on the top left showing the current scenario name.
- Contains an SVG diagram for the current scenario (e.g., a cross-section of a bridge, a pothole waveform, a ghost trail graphic).
- Provides camera perspective toggles (Orbit, Follow, Top) and Color Mode toggles (Height, Slope, Density).

**Data Disconnects & Hardcoded Illusions:**
- The SVG diagrams (Bridge, Potholes, Traffic) are static, manually drawn `<svg>` shapes with hardcoded coordinates, not data-driven charts.
- The "Proof" text (e.g., "3/3 DETECTED", "ZERO GHOST TRAILS") is hardcoded string literals.

### 1.4 Bottom Telemetry Status Ribbon (`App.tsx` Footer)
**Visuals:**
- A thin bottom bar showing high-level system invariants.

**Data Disconnects & Hardcoded Illusions:**
- **THROTTLED CELLS:** Shows `[active_cells] / 106,875`. The denominator `106,875` is a hardcoded literal.
- **INGESTION:** The string `"123K pts -> 3.26 MB (99.89% throttled)"` is entirely hardcoded.
- **SEAM GAPS:** The string `"0.00% (PROVED)"` is hardcoded.
- **CYCLE LATENCY:** The string `"24.8 ms (40.3 FPS)"` is purely hardcoded. There is no active frame-timing logic or backend latency metric feeding this number.

### 1.5 Slide-Out Telemetry Drawer
**Visuals & Tabs:**
- Opens on the right side. Contains 4 tabs: View, Vehicle, Proofs, Stress.
- **Tab 1: View (`DisplaysPanel.tsx`)**: Toggles for layers (Voxels, Surface, Points). Works, but toggles purely synthetic Three.js layers.
- **Tab 2: Vehicle**: Shows "Live Vehicle Telemetry". 
  - **Hardcoded:** Speed (`0.0 km/h`), Heading (`0°`), Coordinates (`X: 0.00m Y: 0.00m Z: -1.41m`). Claims to be live but is disconnected.
- **Tab 3: Proofs**:
  - **MemoryMeter.tsx**: Shows a bar chart comparison. The baseline memory (`3,051.8 MB`) and uniform memory (`122.1 MB`) are hardcoded text. The "Ring Allocation Table" numbers (1.22 MB, 1.06 MB, etc.) are static text.
  - **InteractiveCrossSection.tsx**: A 2D slice chart. If the backend `data.profile` is null, it generates a perfect, synthetic mock profile using `Math.abs(x - 8.0) < 0.8` for potholes.
  - **RegretPanel.tsx**: Shows "3.94% REGRET" and "0.14 meters" Fréchet Distance. These are entirely hardcoded literals. No actual planner paths are being compared.
- **Tab 4: Stress (`StressHarnessPanel.tsx`)**: Sliders for beam dropout and rain noise. Moving the slider just changes local component state; there's no evidence it effectively modifies a backend simulation in real-time to alter the 3D view.

---

## 2. Current User Flow

1. **Initial Load**: The user loads the page and is immediately greeted by the `JudgeOnboardingModal` overlay covering the screen.
2. **Main View**: After dismissing the modal, the user sees the 3D full-bleed viewport with the "Bridge Underpass" scene rendered (via hardcoded synthetic math).
3. **Switching Scenes**: The user clicks a scene button on the top-center floating pill bar. This triggers a `POST /api/load_scene/{id}` to the backend, updates the `activeScene` state, and immediately swaps the hardcoded mathematical formula used to draw the 3D terrain in `ThreeViewport.tsx`.
4. **Opening Telemetry**: The user clicks to open the right sidebar or presses `T`.
5. **Viewing Proofs**: The user clicks the "Proofs" tab (1 click). To view planner regret, they click the "Planner Regret" sub-tab (2nd click), which reveals the hardcoded `3.94%` metric.
6. **Slicing Terrain**: The user clicks the "Bridge Clearance" sub-tab, revealing the `InteractiveCrossSection`. They can drag an HTML `<input type="range">` slider to move a vertical line across the synthetic SVG plot.

---

## 3. Tech Stack Inventory

*(Confirmed via `package.json`, `vite.config.ts`, and component imports)*

- **Framework**: React 19.
- **Build Tool / Bundler**: Vite.
- **Styling**: Tailwind CSS (v4) with vanilla CSS (`index.css`) for custom utility classes.
- **Icons**: `lucide-react`.
- **3D / Visualization**: Raw `three` (v0.186.1). *Note: The project does not use declarative wrappers like `@react-three/fiber`, nor does it use geospatial WebGL libraries like `deck.gl` or `mapbox-gl`.*
- **Backend Serving**: The frontend development server runs on port 3000, proxying `/api` and `/ws` requests to a separate Python FastAPI/Uvicorn backend on port 8000.

---

## 4. What's Structurally Impossible Right Now

Based on the current frontend architecture and missing data pipelines, the following features cannot be displayed (even if UI slots were added), as the underlying data is completely absent from the frontend context:

1. **Per-range-band fidelity-vs-uniform comparison**: **Impossible.** The frontend hardcodes Ring 0-3 memory sizes as text. It has no structural awareness of actual point densities or fidelity metrics per ring to visualize a comparison against a uniform grid.
2. **Foveation adaptivity visualization**: **Impossible.** The fovea rings in the 3D viewport are static `Three.RingGeometry` meshes drawn at fixed 10m, 25m, and 50m intervals. They do not dynamically adapt, and there is no spatial hash data structure exposed to the frontend to drive such adaptivity.
3. **Planner-regret path overlay**: **Impossible.** The `RegretPanel` only contains hardcoded text ("3.94%"). The frontend does not receive trajectory arrays, costmaps, or Nav2 paths from the backend. Thus, drawing a comparative overlay of a Hybrid-A* path vs an MPPI path is impossible.
4. **Uncertainty heat-map**: **Partial (Synthetic Only).** The frontend calculates a mock Bayesian variance (`variance = 0.08 * bell`) directly in the `ThreeViewport` render loop to colorize the terrain. True uncertainty data is not streaming from the backend.
5. **Ghost-trail before/after comparison**: **Impossible.** The UI relies on a static text label ("ZERO GHOST TRAILS") and a static SVG schematic. There is no historical temporal point cloud buffer in the frontend to toggle and show raw ghosting vs MOS-filtered results.
6. **Real measured FPS / Cycle Latency**: **Impossible.** The footer's `24.8 ms (40.3 FPS)` is a static string. There is no `requestAnimationFrame` timing logic or WebSocket stream capturing true backend cycle latency.
