# Frontend Redesign Plan — Closing the Backend/Frontend Honesty Gap

**Source:** `frontend_current_state.md` (line-by-line source audit) + the shared screenshot/video.
**This is the most serious finding in the entire audit chain.** Every prior round (skeptical*judge_audit.md through round5_fix.md) fixed fabricated numbers in \_scripts and reports*. This audit finds that the thing a judge will actually watch — the live demo — is almost entirely disconnected from that hard-won, real, audited pipeline. The backend now has genuine SemanticKITTI Seq 08 results, a verified 3.2616 MB memory bound, real dynamic-object recall, and a real regret metric. **None of it reaches the screen.** The 3D view is hand-written sine waves. The regret number on screen (3.94%) is a different, unrelated string from the real regret value the backend actually computed. This is not a UI-polish problem. It is a credibility problem, and it is more dangerous than any single fabricated number from earlier rounds, because it's the very first thing a judge sees.

---

## 0. The blunt version

If a judge clicks anything beyond the landing screen — drags the cross-section slider, opens "Proofs," asks "is this the real regret from your planner" — the honest answer for almost every number on screen right now is **no**. The backend team spent five audit rounds removing exactly this failure mode from reports and scripts. It is currently still fully present, arguably worse, in the one place a judge is guaranteed to look.

**The good news:** the visual language, layout, and interaction design are genuinely good — the scenario switcher, the telemetry drawer, the "Judge Walkthrough" button, the tactical objective cards. Nothing here needs a redesign from scratch. It needs its data source fixed, one panel at a time, using exactly the same triage discipline already proven on the backend.

---

## 0.5. A structural decision to make before wiring anything: what should carry the argument?

There are two separable problems here, and it's worth naming both:

1. **Honesty** — numbers on screen that don't trace to real data. Fixable in a day (Tier 0/1 below).
2. **Framing** — even once every number is real, is a first-person 3D driving scene the right _primary_ artifact for proving the PS's four judged deliverables (segmentation, grid correctness, memory reduction, FPS/accuracy by distance)?

On (2): a cinematic 3D viewport is a proven, engaging demo format, and several rivals use variations of it — the WebGL2 mountain-road scene, the React Three Fiber digital twin. But it's optimized to _feel_ impressive, not to let a judge _check_ the specific claims in `SIH26053_Standards_To_Beat.md`. A UGV driving under a bridge looks good, but it doesn't visibly show "did this curb survive coarsening" or "what happens at a ring boundary" — the judge has to trust that the pretty render implies the underlying math is right, which is precisely the kind of unverifiable implication this whole audit chain has been eliminating from the backend.

There's also a positioning risk: if the demo _looks_ like the cinematic rival repos at a glance, a judge's first read may be "another pretty simulator," which buries the actual differentiator — this is the one running on real SemanticKITTI data with a real, audited memory bound and real recall numbers, not a synthetic world.

**Decision: keep the 3D view, but demote it.** Restructure the app around two tiers instead of one blended experience:

- **Hook (10–15 seconds, first thing shown):** the existing 3D viewport, UGV, scenario switcher — this establishes "this is a real perception system," and it's genuinely good work. Keep it, once the Tier 0 honesty fixes below are applied to it.
- **Primary artifact (where the argument actually gets made):** a **data-inspection screen** — a top-down 2.5D view where individual grid cells are visible and clickable: resolution tier, class label, height/variance, confidence, and the raw points that produced that cell, all real, all traceable. This is not a rendering _of_ the idea — it _is_ the idea's actual output, inspectable the way `BENCHMARK_REPORT.md` is inspectable. The per-range fidelity data (P2), recall-by-band (P3), and memory comparison should live here as the main event, not as a sidebar tab underneath the driving simulator.

Practically: the "Judge Walkthrough" flow should move _through_ the 3D hook and land on the data-inspection screen within a few clicks, not leave the judge orbiting a pretty scene indefinitely. Section 3 below reflects this structure; the fix tiers in Section 2 are reordered so this restructuring happens alongside the honesty fixes, not after them — doing the wiring fixes first and the restructuring later would mean redoing the same components twice.

---

## 1. Triage: every element gets one of three fates

Apply this to every hardcoded item `frontend_current_state.md` found. No exceptions, no "we'll get to it later" left silently in place.

- **REAL** — a genuine backend value already exists (from P1–P4 work). Wire it. Never hardcode a fallback that could be mistaken for the real thing.
- **LABELED-SYNTHETIC** — no real data source exists yet, but the visual is legitimately useful for explaining a capability (e.g., "here is what a bridge underpass looks like conceptually"). Keep it, but make it **visibly, unmissably** labeled as illustrative — not quietly disclosed in a README, but stamped on the screen itself.
- **REMOVE OR BLOCK** — actively dangerous: a number or "LIVE" label that contradicts, or could be checked against, the real audited value elsewhere in the repo. Delete it or replace it with an honest "not yet available" state until real data exists.

| Element                                                                                   | Current state                                                           | Fate                                                                                                                             | Why                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D terrain (roads, bridge, potholes, poles) via `evalElevation()`                         | 100% hardcoded math, no point cloud/DEM streamed                        | **LABELED-SYNTHETIC** for 4 of 5 scenarios; **REAL** for "Real City Driving"                                                     | The four hazard scenarios (bridge, potholes, traffic, poles) are legitimately useful _staged demonstrations_ — keep them, but stamp "SYNTHETIC TEST SCENE" on screen. "Real City Driving" must render actual Seq 08 points/labels or be renamed/removed.                                                                                                      |
| Vehicle position/telemetry                                                                | Static zeros, labeled "Live Vehicle Telemetry"                          | **REMOVE the word "Live"** until wired, or **REAL** if wiring is cheap                                                           | A static value labeled "live" is the single worst pattern here — it's a false claim sitting in the UI, not a report.                                                                                                                                                                                                                                          |
| Fovea rings (10/25/50m)                                                                   | Static `RingGeometry`, not adaptive                                     | **LABELED-SYNTHETIC** (fine as a fixed illustration of _how_ foveation works) until P5 (adaptive foveation) lands, then **REAL** | Do not claim adaptivity you don't have (P5 is not started per the roadmap).                                                                                                                                                                                                                                                                                   |
| `THROTTLED CELLS: 47,307 / 106,875`                                                       | Numerator possibly real, denominator hardcoded                          | **REAL**                                                                                                                         | `106,875` is a genuine, audited constant (the pool size) — fine to hardcode _this specific_ number since it's architecturally fixed, but confirm the numerator is live.                                                                                                                                                                                       |
| `INGESTION: 123K pts → 3.26 MB (99.89% throttled)`                                        | Entirely hardcoded string                                               | **REAL, and fix the stale value**                                                                                                | This is a **newly found regression** — it still says `3.26 MB`, not the corrected `3.2616 MB`, meaning the round 4/5 fix missed this exact string. Wire it to live telemetry; it should update per scene/frame, not sit as one frozen sentence.                                                                                                               |
| `SEAM GAPS: 0.00% (PROVED)`                                                               | Hardcoded string                                                        | **REAL**                                                                                                                         | The underlying claim is genuinely true (`test_phase1_invariants.py` proves it) — just read it from the actual test output/report instead of typing it into the component.                                                                                                                                                                                     |
| `CYCLE LATENCY: 24.8 ms (40.3 FPS)`                                                       | Entirely hardcoded, no timing logic at all                              | **REMOVE immediately, replace with the real number**                                                                             | This is the most dangerous single element in the UI. The backend's own audited profile shows **~4,069 ms/frame on real data**. A fake `24.8 ms` sitting on screen directly contradicts your own audited report. This is the frontend equivalent of the original "ZERO FABRICATED METRICS" regression — fix it first, before anything else in this whole plan. |
| `RegretPanel`: "3.94% REGRET", "0.14 m Fréchet"                                           | Entirely hardcoded, no planner paths ever computed for display          | **REMOVE immediately, replace with real value or an honest "pending" state**                                                     | Second-most dangerous element. This number has no relationship to `regret_benchmark.py`'s real output at all — it isn't even a stale copy of a real number, it's an unrelated invented one.                                                                                                                                                                   |
| `MemoryMeter`: `3,051.8 MB` dense baseline, `122.1 MB` uniform, per-ring allocation table | Hardcoded text, though the _values_ are legitimate calculated baselines | **REAL**                                                                                                                         | Same fix pattern as the backend's `baselines.py` — read from `calculate_baselines()` output, don't retype it. Low risk today since the numbers happen to be right, but this is exactly the kind of literal that silently drifted out of sync last time (the 936.1x vs 935.7x incident).                                                                       |
| `InteractiveCrossSection` — generates a fake profile when `data.profile` is null          | Always synthetic today (backend never sends `data.profile`)             | **LABELED-SYNTHETIC** until a real per-scene elevation profile is exposed by the backend                                         | Don't silently fall back to fake data with no indication — show "no real profile available for this scene yet" instead of quietly drawing a perfect mock curve.                                                                                                                                                                                               |
| `StressHarnessPanel` sliders                                                              | Change local state only, no backend effect                              | **LABELED-SYNTHETIC or REMOVE**                                                                                                  | A slider that looks functional but does nothing is worse than no slider. Either wire it to actually re-run/re-render with degraded input, or remove it from the judge-facing build.                                                                                                                                                                           |
| `API:8000 LIVE (28ms)` ping indicator                                                     | Genuinely real (polls `/api/telemetry` every 1.5s)                      | **Keep as REAL**                                                                                                                 | This one is fine — it's an example of the pattern to replicate everywhere else.                                                                                                                                                                                                                                                                               |
| Tactical objective SVGs (bridge cross-section, pothole waveform)                          | Static hand-drawn SVG, not data-driven                                  | **LABELED-SYNTHETIC (acceptable)**                                                                                               | These are diagrams explaining a concept, not measurement claims — fine as-is, just don't caption them with measured-sounding text like "3/3 DETECTED" unless that number is real.                                                                                                                                                                             |
| `"3/3 DETECTED"`, `"ZERO GHOST TRAILS"` captions                                          | Hardcoded string literals                                               | **REAL** (P3/P4 data exists for this)                                                                                            | You now have genuine dynamic-object recall numbers from P3/P4 — use them here instead of a fixed caption.                                                                                                                                                                                                                                                     |

---

## 2. Fix order (do not skip ahead)

### Tier 0 — Today, before anything else (these are actively contradicting your own audited reports)

1. **Remove the hardcoded `24.8 ms (40.3 FPS)` cycle latency string.** Replace with either the real measured latency (once P1's real-time work produces a live-enough number) or a clearly labeled "profiling in progress" state. Never show a number here that contradicts `edge_hardware_profile.json`.
2. **Remove the hardcoded `3.94% REGRET` / `0.14 m Fréchet` panel content.** Wire to `regret_benchmark.py`'s actual latest output, or show "no regret result loaded for this scene" until it's wired.
3. **Fix the `3.26 MB` string in the ingestion readout** — this is a real regression the round 4/5 fix missed. Grep the whole frontend (not just the six files fixed last time) for `3.26` again.
4. **Remove or downgrade every "LIVE" label on data that is static** (vehicle telemetry, in particular). A false "live" claim next to zeros is worse than no live claim at all.

### Tier 1 — This week: build the data-inspection screen, and demote the 3D view alongside it

This is the structural change from Section 0.5. Do it now, not after Tier 2/3 — building the inspection screen after more polish goes into the 3D view means redoing layout work twice.

5. **Build the new primary screen**: a top-down 2.5D grid view of real Seq 08 output. Clicking or hovering a cell shows its resolution tier, class label, height/variance, confidence, and (ideally) the raw points that produced it. Every value here traces to a real backend result — no exceptions, this screen exists specifically to be checkable.
6. **Re-route navigation**: the app should open on (or within one click reach) the 3D hook, then a clear "Inspect the map" / "See the proof" action moves to the data-inspection screen. The "Judge Walkthrough" flow should land here, not orbit the 3D scene indefinitely.
7. Wire `MemoryMeter` to `calculate_baselines()` output instead of retyped literals, and place it on the inspection screen rather than three drawer-clicks deep.
8. Wire `SEAM GAPS` and `THROTTLED CELLS` numerator to the real test/telemetry output.
9. Wire the "3/3 DETECTED" / ghost-trail captions to real P3/P4 recall numbers, and surface them on the inspection screen, not only as a caption inside the 3D hook.
10. Add a visible, permanent **"SYNTHETIC SCENE" badge** to the four staged 3D scenarios (Bridge Underpass, Potholes & Craters, Moving Traffic, Thin Poles) — these stay in the hook tier, clearly labeled as illustrative. Build a genuinely separate **"Real Data (Seq 08)"** mode whose 3D view _and_ whose data-inspection screen both render actual pipeline output. Do not let "Real City Driving" imply real data unless it is.

### Tier 2 — As real data lands (tie directly to the roadmap's P1–P7)

11. Once P2 (fidelity-vs-uniform) lands: this becomes the headline chart on the data-inspection screen — real per-band fidelity, not a static ring-allocation table.
12. Once P5 (adaptive foveation) lands: make the fovea rings in the 3D hook actually animate based on real speed/heading/hazard data, and remove the "LABELED-SYNTHETIC" stamp on that element. The inspection screen should also show _why_ a given cell has the resolution it has.
13. Once P6 (Bayesian/Kalman fusion) lands: replace the fake `variance = 0.08 * bell` terrain tint with a real per-cell uncertainty overlay — shown on the inspection screen as the primary view, optionally echoed in the 3D hook as a color tint.
14. Once P7 (Nav2 regret) lands: build the real path-overlay on the data-inspection screen (compressed-map path vs. reference-map path, real regret number attached) — this is a data/proof artifact, not a cinematic one, so it belongs on the inspection screen even though a simplified version could also render in the 3D hook.

### Tier 3 — Polish (only after Tiers 0–2 are done)

15. Wire or remove the stress-harness sliders.
16. Add a persistent, small "Scope" footer across every screen stating dataset, CPU-only status, and what's staged vs real — matching `KNOWN_LIMITATIONS.md`'s honesty, visibly, in the UI itself.
17. Once the inspection screen is the credible core of the demo, invest further polish in the 3D hook if time remains — but only after, never instead of.

---

## 3. What the honest, well-structured version of this UI looks like

Keep the same shell — header, floating scenario bar, viewport, drawer — but reorganize it around two tiers instead of one blended experience, per the Section 0.5 decision:

**Tier A — Hook (3D viewport, first thing shown, ~10–15 seconds of attention):**

- **"Concept Scenarios" mode** (the current Bridge/Potholes/Traffic/Poles scenes): synthetic, hand-built, clearly labeled `SYNTHETIC SCENE`, used to _explain_ a capability visually before the judge sees the real proof. This is a legitimate, common demo pattern — several rivals do exactly this — the only sin is not labeling it.
- **"Real Data" mode**: the same 3D viewport, but rendering actual Seq 08 points/labels. This is the bridge from the hook into the real argument, not a separate island.
- A single, clear call-to-action ("Inspect the map," "See the proof," or similar) that moves the judge from here into Tier B within one click. The hook's job is to earn 15 seconds of trust, not to hold the judge's attention indefinitely — if a judge only ever sees the 3D view, this demo has not made its actual case.

**Tier B — Data-inspection screen (the primary artifact, where the argument is actually made):**

- Top-down 2.5D grid, real Seq 08 output, individually inspectable cells (resolution tier, class, height/variance, confidence, source points).
- Real memory comparison (from `calculate_baselines()`), real per-band fidelity (P2), real recall by range/speed (P3), real regret and path overlay (P7 when it lands).
- Every number here traces to a script/result file, the same standard already applied to `BENCHMARK_REPORT.md` — this screen exists specifically so a judge's "prove it" question has a direct, clickable answer.

A judge who understands they're looking at a labeled demo scene (Tier A) followed by an inspectable, real-data proof screen (Tier B) will trust _both_ far more than a judge who discovers, by asking one question, that an unlabeled "live" number in a single blended view was invented.

---

## 4. Rules for whoever builds this (same discipline as the backend, applied here)

1. Every number rendered in the UI must trace to a backend response, a WebSocket message, or a results file — never a literal in a `.tsx` file, with the sole exception of genuinely fixed architectural constants (e.g., `106,875` cell pool size) that are documented as such.
2. Any panel with no real data source yet must show an explicit "not available yet" or "synthetic" state — never a silently-generated mock value standing in for a real one.
3. The word "Live" may only appear next to something that is actually polled/computed in that session. Everything else says "Replay," "Simulated," or "Staged."
4. After every fix, rebuild (`npm run build`) and inspect the **compiled output**, not just the source — this is exactly how the last backend regression (stale `3.26 MB` surviving in the built JS bundle) was almost missed.
5. Before showing this to any judge, re-run the same grep-for-stale-numbers check used in `round5_fix.md`, but against `dashboard/` specifically — it was evidently not covered by that pass.

---

## 5. One-line verdict

The backend earned real credibility through five audit rounds. The frontend, as it stands, would hand a judge a demonstration of numbers that don't exist and a "LIVE" label on data that never updates — undoing that credibility in the first ten seconds. Fixing Tier 0 (four items) removes the two most dangerous contradictions. But honesty alone isn't the full fix: a cinematic 3D driving scene, even once every number in it is real, is not the artifact that best proves segmentation accuracy, grid correctness, memory reduction, or the standards file's specific judge questions. The structural fix — keep the 3D view as a short, honestly-labeled hook, and build a real, inspectable, cell-level data screen as the actual centerpiece — is what turns "an honest demo" into "a convincing one."
