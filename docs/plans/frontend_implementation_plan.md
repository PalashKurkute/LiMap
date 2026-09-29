# Frontend Implementation Plan: Restructure & Honesty Gap Fix

This actionable plan is derived directly from the findings in `docs/audit/frontend_audit.md`. It tracks the step-by-step engineering tasks required to restructure the frontend into a two-tier experience (Hook vs. Data Inspection), remove fabricated metrics, properly label synthetic demonstrations, and wire the UI to the actual, audited backend outputs.

## Phase 1: Tier 0 Hotfixes (Immediate execution)
**Goal:** Remove every hardcoded number and "live" label that contradicts our audited backend metrics.

- [x] **Task 1.1:** Open `dashboard/client/src/App.tsx`. Locate the footer ribbon. Delete the hardcoded string `"CYCLE LATENCY: 24.8 ms (40.3 FPS)"`. Replace it with a temporary literal `"CYCLE LATENCY: Profiling (Pending)"` or wire it to real metrics if available.
- [x] **Task 1.2:** Open `dashboard/client/src/components/RegretPanel.tsx`. Delete the hardcoded `"3.94% REGRET"` and `"0.14 m Fréchet"`. Replace them with `"PENDING COMPUTATION"` until properly wired.
- [x] **Task 1.3:** Do a full repository search for `3.26`. Update the `123K pts -> 3.26 MB (99.89% throttled)` string in `App.tsx` to read `3.2616 MB` immediately, and structure it to pull from `telemetryData.total_heap_mb` instead of being a hardcoded string.
- [x] **Task 1.4:** Open `App.tsx` and `TacticalObjectiveCard.tsx`. Remove the word "Live" from "Live Vehicle Telemetry" or any other data blocks that are currently fed by static zeros.

## Phase 2: Tier 1 Data-Inspection Screen & 3D Demotion
**Goal:** Build the new primary verifiable screen (Tier B) and demote the 3D viewport to a labeled hook (Tier A). Do this before adding new logic to avoid redoing layout work.

- [x] **Task 2.1 (Build Primary Screen):** Create a new top-down 2.5D grid view component for real Seq 08 output. Ensure cells are clickable/hoverable to show resolution tier, class label, height/variance, confidence, and raw points. All data must trace to real backend results.
- [x] **Task 2.2 (Re-route Navigation):** Update `App.tsx` routing/layout so the app opens on the 3D hook, but prominently features a clear CTA (e.g., "Inspect the map" / "See the proof") to transition the user to the new data-inspection screen. The "Judge Walkthrough" should land on this inspection screen.
- [x] **Task 2.3 (MemoryMeter Relocation):** Fetch data from `calculate_baselines()` (no literals) for `MemoryMeter.tsx`, and move this component onto the new data-inspection screen instead of burying it in a drawer.
- [x] **Task 2.4 (Metrics Wiring):** Wire `SEAM GAPS` and the `THROTTLED CELLS` numerator to real test/telemetry output. Surface the `"3/3 DETECTED"` / ghost-trail captions to real P3/P4 recall numbers on the inspection screen.
- [x] **Task 2.5 (Visual Stamping & Mode Separation):** Add a permanent, visible "SYNTHETIC SCENE" badge overlay to the 3D viewport for the Bridge, Potholes, Traffic, and Poles scenarios. Create a distinct "Real Data (Seq 08)" mode where both the 3D hook and inspection screen render actual pipeline output.

## Phase 3: Tier 2 Roadmap Integration
**Goal:** Expose dynamic visualization capabilities as backend phases P1-P7 land, primarily on the data-inspection screen.

- [ ] **Task 3.1 (P2 - Fidelity):** Build a real per-band fidelity chart as the headline on the data-inspection screen, replacing the static ring-allocation table entirely.
- [ ] **Task 3.2 (P5 - Adaptive Foveation):** Update the 3D hook to animate fovea rings based on real speed/heading/hazard data, and remove its "SYNTHETIC" label. Ensure the inspection screen clearly explains *why* a cell has its specific resolution.
- [ ] **Task 3.3 (P6 - Uncertainty Fusion):** Route per-cell Bayesian variance values to the frontend. Replace the fake `variance = 0.08 * bell` tint with a real per-cell uncertainty overlay, featured prominently on the inspection screen and echoed in the 3D hook.
- [ ] **Task 3.4 (P7 - Planner Regret):** Fetch trajectory paths from `regret_benchmark.py` and draw the compressed vs. reference path overlays on the data-inspection screen, along with the real regret number attached.

## Phase 4: Polish & Truth-in-Advertising (Tier 3)
**Goal:** Ensure the final judge-facing experience maintains the highest standard of technical honesty after the core structure is verified.

- [x] **Task 4.1:** Investigate `StressHarnessPanel.tsx`. Either hook the sliders to backend API calls that dynamically alter sensor input data, or remove them completely from the judge-facing build.
- [x] **Task 4.2:** Add a persistent small "Scope" footer to the main layout that summarizes the current environment (e.g., "CPU-only inference, Pre-processed Dataset Seq 08, 1.5s UI polling").
- [ ] **Task 4.3:** Polish the 3D hook to improve visual quality *only after* the inspection screen is fully credible and wired.
- [x] **Task 4.4:** Run `npm run build` and `oxlint` to verify no stale artifacts or literals remain in the built bundles before presenting to a judge.
