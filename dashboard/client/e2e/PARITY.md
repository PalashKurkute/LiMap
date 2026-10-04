# Feature parity checklist

Every feature that existed before the overhaul, and where it lives now. Status: ✅ kept · 🔀 moved · ✂️ removed on purpose (with why).
Pre-overhaul screenshots: `e2e/__baseline__/`.

## Navigation
- ✅ Scenario switcher with 5 scenes; keys `1`–`5` (now a compact pill, top-left stack)
- 🔀 View switch 3D hook / data inspection → header tabs **3D Explore · Map Inspector · Evidence**
- 🔀 "Inspect Map & Proofs" CTA → "Open Map Inspector →"
- ✅ Judge Walkthrough → rewritten as a 4-step guide, first visit only, reopened from the header (`Walkthrough`)
- ✅ `T` toggles the side panel; `Esc` closes dialog / panel (new); `Shift+T` toggles theme (new)
- ✅ Side panel tabs View / Vehicle / Proofs / Stress
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
