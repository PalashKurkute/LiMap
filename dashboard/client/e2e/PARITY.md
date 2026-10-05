# Feature parity checklist

Every feature that existed before the overhaul, and where it lives now. Status: ✅ kept · 🔀 moved · ✂️ removed on purpose (with why).
Pre-overhaul screenshots: `e2e/__baseline__/`.

## Navigation
- ✅ Scenario switcher with 5 scenes; keys `1`–`5` (now a compact pill, top-left stack)
- 🔀 View switch 3D hook / data inspection → header tabs **3D Explore · Map Inspector · Evidence**
- ✂️ "Open Map Inspector →" button on the 3D view: it repeated the **Map Inspector** header tab, so it was removed
- 🔀 Judge Walkthrough (4-step welcome dialog) → **Take the tour**: a header button that is always available, a dismissible first-visit callout, and a click-Next guided tour of every feature (`?tour=1` starts it). The welcome dialog was removed as redundant
- ✅ `T` toggles the side panel (now also a visible **Controls** button in the header); `Esc` closes the panel; `Shift+T` toggles theme; `R` resets the vehicle and camera (was advertised, now implemented); shortcuts stay inert while the tour runs
- 🔀 Side panel tabs View / Vehicle / Proofs / Stress → **Layers / Vehicle / Section / Stress** (proper `tablist`). The camera and colour pickers that were duplicated on the View tab now live only on the scene card
- 🔀 Proofs › Memory, Regret → **Evidence** page (Proofs keeps the clearance slicer + a link)

## 3D viewport
- 🔀 Display modes points / surface / voxels → in **Pipeline output**: "FoveaGrid cells" / "Raw LiDAR returns"; the original three remain in **Concept view**
- ✅ Camera orbit / follow / top (scene card + side panel); mouse orbit, right-drag pan, wheel zoom
- 🔀 Colour modes: Height / Slope / Lateral (concept) → Height-above-ground / Class / Ring / Welford variance (pipeline)
- ✂️ "Bayesian confidence / density" colour mode: it was lateral distance from the corridor, not a measurement → relabelled "Lateral (illustrative)"
- ✅ Overlays: planned path / bridge canopy / traffic vectors / range rings (+ 100 m ring added); Reset
- ✅ Hover reticle; scene C moving vehicle with tracking box (concept view)
- 🔀 Provenance badge (was hidden behind the scene card) → always visible in the top-left stack
- ✅ On-canvas legend for every colour mode (new)

## Playback
- ✅ Play/Pause, rewind, 1×/2×/4×, scrubber — in **Concept view** only (pipeline output is a single scan and says so)
- ✅ `Space` play/pause, `←/→` step (previously advertised but not implemented)
- ✅ Vehicle tab: speed / heading / xyz, Reset

## Map inspector
- ✅ Colourise: class / ring / elevation / variance / overhang
- ✅ Ring filter All / R0–R3; zoom in/out/reset; drag pan; wheel zoom at cursor (new); keyboard pan/zoom (new)
- ✅ Click a cell → inspector (ring, class, count, mean z, variance, span, clearance) — hit-testing fixed
- ✂️ "Audited System Invariants" panel (retyped literals) → derived scene statistics + link to Evidence

## Proofs / panels
- 🔀 Memory proof → Evidence › Memory (log-scale, capacity vs measured occupied cells)
- ✅ Interactive cross-section slider (now draws gaps for unobserved samples; no mock profile)
- 🔀 Planner regret → Evidence › Planner regret (real values from `real_regret_results.json`)
- ✂️ Stress presets "monsoon" and "ghost": they did nothing → only the 50% dropout preview remains, labelled VISUAL ONLY
- ✂️ DRDO scorecard modal and cell HUD (unused, contained fabricated figures)

## Theme (new)
- ✅ Light / dark / system toggle in the header; persisted; no flash; reaches DOM, SVG, 3D scene, map canvas, dialogs

## Added with the tour and inspector work
- ✅ **Take the tour**: header button, first-visit callout (`limap.welcomeSeen`), resume (`limap.tour.v1`), `?tour=1`; 40 steps over every view; restores the app on every exit path
- ✅ **Isometric Map Inspector**: Top-down / Isometric switch, overhang canopies drawn at their real height, cursor readout (X fwd, Y lat, distance, ring), guides toggle, per-scene hint, colour-mode descriptions
- ✅ **Foveation presets** in the Map Inspector (stationary, city, highway, turn left, turn right) with a dashed fovea outline and a statistics card, from precomputed variant snapshots (`docs/DATA_VARIANTS.md`)
- ✅ **Uniform 5 cm vs FoveaGrid** swipe comparison (key `B`), with occupied-cell (MEASURED) and reserved-memory (CALCULATED) figures
- ✅ Scene stamp, scene card and drawer wording made plain ("Illustrative drive", "Layers", "Section"); the illustrative path, bridge deck and vehicle-box overlays only appear in the Concept view and are labelled hand-built
- ✂️ Header API and pool chips: duplicated the status bar, which keeps both
- ✂️ Upstream "CAR #1 / CAR #2 / TRUCK #3 / TREE / CURB" boxes in the Data Matrix: hard-coded, drawn on every scene whatever the data said. Not carried over (`parked-upstream/README.md`)
- ✅ **Underpass: one height vs 2.5D** (Map Inspector): the bridge scan as two costmaps side by side, from the project's own planner run (`limap.planner/1`), with the path found on each and a card of figures; excludes the uniform comparison; top-down only
- ✅ **Fly under the bridge** (3D view, scene card): a camera shot along the planner's route; self-ending, takes the user's input at once, still pose under reduced motion
- 🔧 `R` now resets the camera as well as the vehicle (it used to reset only the hidden vehicle, so an orbited camera stayed where it was)
