# Feature parity checklist

Every feature below existed before the overhaul and must still work after it
(or be consciously relocated; note the new home). Baselines: `e2e/__baseline__/`.

## Navigation
- [ ] Scenario pill with 5 scenes; keys 1-5 switch scene
- [ ] View switch: 3D hook <-> data inspection (now: 3D Explore / Map Inspector / Evidence)
- [ ] "Inspect Map & Proofs" CTA reaches the inspection view
- [ ] Judge Walkthrough opens the onboarding; its scenario launchers load scenes
- [ ] Key `T` toggles the drawer; Esc closes it
- [ ] Drawer tabs: View / Vehicle / Proofs (Memory, Clearance, Regret) / Stress

## 3D viewport
- [ ] Display modes: points / surface / voxels
- [ ] Camera: orbit / follow / top; mouse drag orbit, right-drag pan, wheel zoom
- [ ] Colour modes: elevation / slope / (lateral-distance) ; legend matches
- [ ] Overlays: planned path / bridge canopy / traffic vectors / range rings, plus Reset
- [ ] Hover reticle follows the cursor
- [ ] Scene C: moving vehicle with tracking box
- [ ] Provenance badge: synthetic vs real

## Playback
- [ ] Play/Pause, rewind, 1x/2x/4x, frame scrubber (Space and arrow keys are new)
- [ ] Vehicle tab: speed / heading / xyz, Reset [R]

## Map inspector (BEV)
- [ ] Colourise: semantic / ring / elevation / variance / dual-elevation
- [ ] Ring filter All / R0-R3
- [ ] Zoom in/out/reset, drag pan
- [ ] Click a cell -> inspector shows ring, class, count, mean z, variance, span, clearance

## Proofs / panels
- [ ] Memory proof (baselines + per-ring pool)
- [ ] Interactive cross-section slider (clearance)
- [ ] Planner regret panel
- [ ] Stress modes / dropout preview

## Theme (new)
- [ ] Toggle light/dark/system; persists; no flash; nothing stays the other theme
