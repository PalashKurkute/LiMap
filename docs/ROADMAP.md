# Roadmap: Becoming the Clear Best Repo for SIH26053

**Audience:** the coding agent working on this repo.
**PS:** SIH26053 (DRDO) — *Adaptive Variable Resolution 2.5D LiDAR Mapping for Dynamic Environment Perception.*
**What the PS actually asks for (the judging checklist):**
1. A point-cloud segmentation model (PointNet++ or a sparse CNN) that separates terrain, static obstacles, and dynamic objects.
2. A variable-resolution grid engine (5 cm cells within 10 m, growing to 50 cm out to 100 m) with no alignment errors or data loss when projecting 3D to 2.5D.
3. A real-time dashboard showing memory reduction versus a uniform high-resolution 3D map.
4. Metrics showing **high FPS and high accuracy across distances**.

---

## 0. Where we stand (from `checkpoint_audit.md`, independently re-derived)

- Roughly **20 Yes / 8 Partially / 10 No** across the 38 rows of `SIH26053_Standards_To_Beat.md`.
- Strong and verified: nested-lattice grid with zero seam mismatches, fixed 3.2616 MB pool (935.7x smaller than dense 3D, a *capacity* ratio), Welford/Chan variance handling, dual ground/obstacle elevation, PCA slope immunity, a real pretrained SalsaNext ONNX model with distance-banded mIoU, real range-disparity dynamic-object filtering on SemanticKITTI Seq 08, planner regret with Fréchet distance, checksummed model weights, honest `KNOWN_LIMITATIONS.md`.
- Honestly missing (also missing in every rival we found): embedded hardware, CUDA, Nav2, RELLIS-3D, real IDD-3D data.

**Leading rivals (public, as of last check):** VRgrid (uncertainty-preserving coarsening, planner regret, deterministic-by-design, visible self-correcting PR history), `sih_053` (ROS 2/Nav2 scaffolding, negative obstacles, extreme honesty, but no real trained model), NEXA/`sih2026` (clean polar grid, ground/obstacle split). Treat all of their READMEs as *self-reports we have not run.*

### The two gaps a judge will hit first

| Gap | Why it hurts | Evidence |
|---|---|---|
| **We are not real-time.** The PS says "high FPS." Our own real-data profile is **~4,069 ms/frame (~0.25 FPS)**. | This contradicts the headline requirement, and the report now (correctly) shows it. | `edge_hardware_profile.json`; rasterization ≈ 2,864 ms, ONNX inference ≈ 458 ms. |
| **We do not show accuracy is preserved by foveation.** We show memory savings, but a judge will ask "what did you lose?" | A 935.7x saving means little if hazards vanish at the coarse rings. | Capacity-ratio caveat (NEXA's own team flagged the same issue in their PR). |

Fixing these two is worth more than any new feature. They come first.

---

## 1. Rules of engagement (non-negotiable)

This repo's credibility is its main asset. It was earned over five audit rounds. Do not spend it.

1. **Every number in any report, dashboard, or doc must be produced by a script that ran on the current code.** No typed-in metrics. Derive ratios at the point of use.
2. **Label every number** as `MEASURED`, `CALCULATED`, or `EXTERNAL BASELINE (not ours)`.
3. **Never write absolute claims** ("100%", "zero fabricated", "fully verified"). This regressed once already. State scope instead.
4. **Update `KNOWN_LIMITATIONS.md` in the same change** that adds or removes a capability.
5. **One initiative at a time.** After each, re-run the full test suite and `verify_all_milestones.py`, and confirm the seam-invariant test (§1.2) still passes. Any change touching ring boundaries must re-run it.
6. **Do not edit historical audit files** (`docs/audit/*.md`, `*_audit.md`, `round*_fix.md`). They are the paper trail.
7. **Report failures honestly.** A modest real number beats an impressive unverifiable one. If an initiative underperforms, record the real result and move on.
8. **Never claim** Jetson/embedded results, IDD-3D results, or RELLIS-3D results unless the run genuinely happened on that data/hardware.

---

## 2. Priority matrix

Ratings: **Convincing** = how strongly a DRDO/SIH judge will respond. **Feasibility** = likelihood of finishing with real, honest results. Effort is a rough estimate for an agent with a working environment.

| # | Initiative | PS relevance | Convincing | Feasibility | Effort | Depends on |
|---|---|---|---|---|---|---|
| P1 | Make the pipeline genuinely real-time | Direct ("high FPS") | Very high | High (raster) / Medium (inference) | 1-2 days | none |
| P2 | Fidelity-vs-uniform study (what foveation costs) | Direct ("high accuracy across distances") | Very high | High | 1 day | none |
| P3 | Own measured recall by range band and speed | Direct (dynamic perception) | High | High | 0.5 day | none |
| P4 | Full-sequence evaluation (all 4,071 frames of Seq 08) | Direct | High | High after P1 | 0.5 day | P1 |
| P5 | Genuinely adaptive foveation (speed/hazard/heading under a fixed cell budget) | Direct (the word "Adaptive" is in the title) | Very high | Medium | 2 days | P1, P2 |
| P6 | Range-aware Bayesian (Kalman) elevation fusion | Uncertainty, tied to foveation | High | High | 1 day | none |
| P7 | Nav2 costmap layer + regret through a real planner | Downstream proof | Very high (nobody has it) | Medium (environment risk) | 2-3 days | none |
| P8 | Model-compliance and robustness package | Direct (PS names PointNet++/sparse CNN) | High | Medium | 1-2 days | none |
| P9 | RELLIS-3D off-road evaluation | DRDO is off-road/UGV | High | Medium | 1-2 days | dataset download |
| P10 | Dashboard upgrade (demo-grade) | Direct (dashboard is a deliverable) | High | High | 1-2 days | P1-P6 data |
| P11 | Determinism proof (same-input, same-hash) | Engineering maturity | Medium | High | 0.5 day | none |
| P12 | Negative-obstacle rim detection + pothole survival test | India road safety story | Medium-High | Medium | 1-2 days | none |
| P13 | Reproducibility and pitch package | Judge experience | High | High | 1 day | all |
| P14 | GPU path (only if a GPU exists) | Deployment realism | Medium | Low-Medium | 1-2 days | GPU access |
| P15 | Indian-context data (IDD-3D) | Differentiator | High if real | Low (data access) | unknown | dataset access |

**Recommended order:** P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P10 in parallel with P7 -> P8 -> P9 -> P11 -> P12 -> P13. Attempt P14/P15 only if resources genuinely appear.

---

## 3. Initiatives in detail

### P1. Make the pipeline genuinely real-time

**Why this is first:** The PS asks for real-time, high-FPS mapping. Our honest number is ~0.25 FPS on real 123k-point frames. Every rival that claims real-time has the same "measured on synthetic/small data" caveat we just removed from our own report. Being *honestly* fast on real frames would be a decisive edge.

**Where the time goes (from our own profile):** costmap/Nav2 rasterization ≈ 2,864 ms (dominant), ONNX inference ≈ 458 ms (CPU), grid insertion is already fast.

**Plan:**
1. Profile per stage on real Seq 08 frames (cold and warm, separated). Store as `MEASURED` in a versioned JSON.
2. Rasterization: vectorize/numba-parallelize; rasterize only occupied cells and only the region needed; make it **incremental (dirty-cell updates)** or **on-demand at planning time** instead of per frame. This is a design fix, not micro-optimization.
3. Segmentation: quantize (INT8 ONNX), reduce range-image resolution if accuracy holds, and/or run segmentation **asynchronously at a lower rate** while the grid updates at sensor rate, propagating labels between segmentation frames. Report accuracy impact of every trade-off (ties to P2).
4. Define "real-time" honestly: sustained FPS over a full sequence, with p50/p95 latency, and a clear statement of what runs on which processor.

**Feasibility:** rasterization fix is High. Reaching 10 Hz *including* CPU segmentation is unlikely; the honest, defensible target is "grid + costmap at sensor rate (≥10 Hz), segmentation at ≥2 Hz async" or, if a GPU exists, full-rate. Publish whichever is true.

**Definition of done:**
- [ ] `MEASURED` sustained FPS and p50/p95 latency over the full sequence (not a warm micro-benchmark).
- [ ] Per-stage latency table, cold vs warm.
- [ ] The report states exactly which configuration produced each number.
- [ ] Old 4,069 ms figure retained and explained as the pre-optimization baseline (never silently replaced).

---

### P2. Fidelity-versus-uniform study (prove foveation is not lossy where it matters)

**Why:** Memory savings alone invite the question "what did you throw away?" The convincing answer is a measured accuracy-retention curve. This is also the honest fix for the *capacity-ratio* weakness (a preallocated pool versus a dense 1-byte voxel grid).

**Plan:**
1. Build a **uniform 5 cm 2.5D reference** map over the same real frames (memory-heavy but acceptable offline; the dossier estimates ~128 MB).
2. Compare foveated versus reference **per range band (0-10, 10-25, 25-50, 50-100 m)**: elevation RMSE, curb/step height preservation, hazard-cell recall, obstacle-boundary displacement.
3. Add stronger memory baselines and report each separately and labeled: dense 3D voxel (calculated), uniform 2.5D (calculated), and an **occupied-cells-only** figure for our grid and the reference (measured). State plainly that 935.7x is a capacity ratio and give the occupied-cell ratio beside it.
4. Curb-survives-coarsening test on **real** data (find real curb/step cells in Seq 08 via ground-truth road/sidewalk boundaries) rather than only synthetic.

**Feasibility:** High. Uses data and code we already have.

**Definition of done:**
- [ ] Per-band fidelity table generated by a script, committed with its output JSON.
- [ ] Capacity ratio and occupied-cell ratio shown side by side.
- [ ] A real-data curb-survival result (pass or fail, honestly reported).

---

### P3. Our own measured dynamic-object recall by range band and speed

**Why:** Standards §3.3 is currently "No" because the only range/speed recall numbers in the repo are a quarantined external baseline. SemanticKITTI already ships ground-truth moving-object labels (classes 252-259), so we can measure this ourselves and delete the last quarantined block.

**Plan:**
1. Compute precision/recall/FPR for our MOS filter against the ground-truth moving labels, stratified by range band and by ego speed (from poses).
2. Report where recall drops (near-field at high speed, far-field sparsity) and why. Honest drops are a strength.
3. Replace or delete `banded_metrics.py`'s hardcoded baseline numbers once our own exist.

**Feasibility:** High.

**Definition of done:**
- [ ] Recall/precision by range band and by speed bucket, produced by a script, on the full evaluated sequence.
- [ ] No hardcoded recall/precision numbers remain in the repo.

---

### P4. Full-sequence evaluation

**Why:** §3.1 asks for ghost-trail measurement over a real multi-thousand-frame sequence. We evaluated 65 frames for dynamics. Rivals (VRgrid) report thousands. This is only practical after P1.

**Plan:** Run the full Seq 08 (4,071 frames): ghost-trail count, dynamic FPR/recall, memory bound held throughout, latency distribution. Also run one more sequence (e.g., Seq 00 or 07) to show the result is not specific to a single drive.

**Feasibility:** High once P1 lands.

**Definition of done:**
- [ ] Full-sequence ghost/FPR/recall numbers, with the memory bound asserted for every frame.
- [ ] A second sequence's headline numbers, clearly labeled.

---

### P5. Genuinely adaptive foveation

**Why:** The title says *Adaptive*. A fixed set of range rings is variable-resolution but not adaptive. Only one public rival (kaushik521645) attempts speed/heading-adaptive fovea, and VRgrid allocates by range/semantics/direction. A rigorous, budget-constrained adaptive scheme with a measured benefit would be the strongest technical differentiator we can add.

**Plan:**
1. Keep the fixed cell budget (the memory bound is our headline; adaptivity must not break it).
2. Per frame, choose ring radii/allocation from: ego speed (look farther and finer ahead at speed), heading/turn direction (bias the fovea into the turn), and hazard/dynamic-object density (spend budget where risk is).
3. Everything must stay on the shared integer lattice so seams remain provably aligned; **re-run the seam test (§1.2) with the adaptive schedules.**
4. Ablation: static rings vs adaptive under the **same** memory budget, measuring hazard-cell recall, dynamic-object boundary error, and planner regret.

**Feasibility:** Medium. The main risk is breaking the seam invariants or the fixed pool. Mitigate by making schedules a small discrete set of integer-aligned presets rather than continuous radii.

**Definition of done:**
- [ ] Adaptive mode with a documented, integer-aligned policy.
- [ ] Seam invariant test passes for every preset.
- [ ] Ablation table (static vs adaptive, equal memory) with real numbers. If adaptive does not help, report that honestly and keep static as default.

---

### P6. Range-aware Bayesian (Kalman) elevation fusion

**Why:** Standards §2.4 is "No" (we use Welford accumulation, not an explicit observation-noise update). A measurement-noise model that **grows with range** connects the uncertainty story directly to foveation: far cells are legitimately less certain, and the planner should know.

**Plan:**
1. Per-cell Kalman update with measurement variance as a function of range (and incidence angle if available).
2. Ensure it fits the existing cell layout and pool size, or state honestly if the layout changes and re-measure the memory bound.
3. Show the effect: variance heat-map by range, and the planner avoiding low-confidence cells (extends the existing uncertainty-diversion test to real data).

**Feasibility:** High.

**Definition of done:**
- [ ] Kalman/Bayesian update implemented and unit-tested against a known-noise synthetic case.
- [ ] Memory bound re-measured and reported.
- [ ] Real-data variance-by-range plot.

---

### P7. Nav2 costmap layer and regret through a real planner

**Why:** Standards §7.2. No public rival has combined a planner-regret metric with a real Nav2 planner (VRgrid has the metric on a synthetic scene; `sih_053` has Nav2 nodes never run). This is the clearest "nobody else has this" claim available.

**Plan:**
1. Use Docker with ROS 2 (Humble or Jazzy) to avoid host-environment risk.
2. Publish the foveated map as a Nav2 costmap layer (or `grid_map`-compatible message).
3. Replay a real Seq 08 segment (converted to a bag or fed by a node), run Nav2's planner on the foveated costmap and on the full-resolution reference, and compute regret and Fréchet distance between the two.
4. If full ROS 2 proves impractical in the time available, ship a smaller honest step (a Nav2-compatible costmap message plus planner-in-a-container test) and document exactly what is and is not covered.

**Feasibility:** Medium. Primary risk is environment setup, not algorithms. Time-box it; do not let it block P1-P6.

**Definition of done:**
- [ ] Reproducible Docker command that runs the Nav2 comparison.
- [ ] Regret and Fréchet numbers from Nav2's planner (not our standalone Hybrid-A*).
- [ ] `KNOWN_LIMITATIONS.md` states whether it ran on a real robot (it did not).

---

### P8. Model-compliance and robustness package

**Why:** The PS text names *PointNet++ or a sparse CNN*. We use SalsaNext (a range-image CNN). That is a legitimate, faster choice, but a judge may ask about it directly. Also, the earlier mIoU evidence may rest on a very small number of frames.

**Plan:**
1. Write a short, honest justification (speed, published SemanticKITTI accuracy, range-image suitability for CPU) in the docs.
2. Optionally add **one** comparator from the PS-named families (e.g., a pretrained RandLA-Net or MinkUNet via Open3D-ML) and report accuracy and latency side by side on identical frames.
3. Verify the pretrained weights' **training split** does not include Seq 08 (Seq 08 is the standard validation sequence). If provenance is unclear, say so.
4. Expand the mIoU evaluation to a statistically meaningful number of frames (state the count), and include **all four** distance bands including 50-100 m.
5. Degraded-input robustness: beam dropout, noise, rain/dust simulation, with mIoU/dynamic-detection degradation curves.

**Feasibility:** Medium. Pretrained comparator availability and CPU inference time are the risks.

**Definition of done:**
- [ ] Model-choice justification in the docs.
- [ ] mIoU by all four distance bands over a stated frame count.
- [ ] Training-split provenance statement.
- [ ] At least the degraded-input curves; the comparator if time allows.

---

### P9. RELLIS-3D off-road evaluation

**Why:** DRDO's use case is off-road UGVs; a SemanticKITTI-only evaluation is an easy attack. Published LiDAR baselines are weak (SalsaNext ≈ 43.07% mIoU, KPConv ≈ 19.07% per the dossier), so honest modest numbers are expected and credible.

**Plan:** Map RELLIS-3D classes to our terrain/static/dynamic categories, run our pipeline zero-shot on a subset, report mIoU and grid-level traversability results, and compare against the published baselines. Do not train from scratch.

**Feasibility:** Medium (dataset size and class mapping). A subset is fine if stated.

**Definition of done:**
- [ ] Documented class mapping.
- [ ] Zero-shot results with the frame count, next to published baselines, honestly labeled.

---

### P10. Dashboard upgrade (demo-grade)

**Why:** The dashboard is a graded deliverable and the thing judges actually watch. All items below use data the pipeline already produces.

**Must show:**
- [ ] Live memory bars: dense 3D vs uniform 2.5D vs ours, each labeled calculated/measured, plus the occupied-cell figure (P2).
- [ ] Color-coded 2.5D map from real Seq 08 output (terrain / static / dynamic / overhang / hazard).
- [ ] Metrics **by distance band** (mIoU, recall, fidelity, latency) as charts, not raw JSON.
- [ ] Real measured FPS and latency (from P1).

**Differentiators:**
- [ ] Interactive **foveation toggle/slider** showing rings tighten and loosen (and adaptive mode from P5).
- [ ] **Ghost-trail before/after** view (with and without dynamic clearing).
- [ ] **Uncertainty heat-map** layer (P6).
- [ ] **Planner path overlay** on compressed vs reference map with the regret number shown.
- [ ] **Scope footer** on the dashboard itself: dataset, CPU-only, no embedded hardware yet.

**Rules:** no hardcoded telemetry strings; every displayed value comes from the backend or the latest result JSON. Rebuild and verify the compiled bundle, not just the source.

**Feasibility:** High.

---

### P11. Determinism proof

**Why:** Standards §6.1 (currently "No"). Cheap and a visible engineering-maturity signal.

**Plan:** Hash the final grid state after processing the same frames twice (same process, then separate processes) and assert equality. Prefer integer/fixed-point accumulation for heights where practical. **Claim only what is proven** (same-machine, same-input determinism); state plainly that bit-identical results across different hardware are not guaranteed for floating point.

**Feasibility:** High. **Definition of done:** an assert-backed test plus a scoped claim.

---

### P12. Negative-obstacle rim detection and pothole survival

**Why:** Potholes caused 4,446 accidents and 1,856 deaths in India in 2022 (MoRTH, per the dossier). Standards §4.1 is "Partially" because detection relies on a Z-threshold rather than rim-based crater logic.

**Plan:** Implement below-ground-with-intact-rim detection, test on controlled synthetic pits at several sizes and ranges, prove slopes are not misflagged (already have slope tests), and show the pit survives coarsening. **Be explicit that SemanticKITTI has no pothole labels**, so validation is synthetic plus qualitative real-data inspection.

**Feasibility:** Medium. **Definition of done:** detection-vs-size-vs-range table and a survival-under-coarsening test, all labeled synthetic.

---

### P13. Reproducibility and pitch package

**Plan:**
- [ ] One command to reproduce every number (`make reproduce` or equivalent), from a clean clone, using pre-staged data.
- [ ] Docker image so nothing depends on the host.
- [ ] A one-slide competitive matrix naming VRgrid, `sih_053`, and NEXA, restricted to claims we have verified about them and clearly marking what we have not run.
- [ ] `JUDGE_QA.md` with honest answers to: mIoU at 50 m vs 5 m; memory savings and against what baseline (capacity vs occupied); does a curb survive coarsening; what happens at ring boundaries; how a passing car is removed; will it run on an embedded board (no hardware run yet, here is the CPU profile and the portability path).
- [ ] Data and weights pre-staged offline (SemanticKITTI subset, ONNX weights, RELLIS subset if used).

**Feasibility:** High.

---

### P14. GPU path (conditional)

Only if a CUDA GPU is actually available. Enable `onnxruntime-gpu`, compile a Numba-CUDA or CuPy version of the hottest stage, and report measured before/after on the same frames. If no GPU exists, leave the gap listed in `KNOWN_LIMITATIONS.md`. Never claim Jetson/TensorRT results without hardware.

---

### P15. Indian-context data (conditional)

The Indian-road classes (autorickshaw, cattle, pothole) are a real differentiator, but IDD-3D provides 3D bounding boxes, not per-point labels, and access may require registration. Pursue only if the data is genuinely obtained; then pseudo-label points from boxes and report results with the labeling method disclosed. Otherwise keep the class definitions and synthetic tests, clearly labeled synthetic, and do not present them as validated on Indian data.

---

## 4. Things that would hurt us (avoid)

| Temptation | Why not |
|---|---|
| Quoting the 3.19 ms micro-benchmark as "our latency" | Already caught and corrected; do not regress. |
| Presenting 935.7x as "memory saving" without the capacity caveat | Invites the exact critique NEXA's team raised about its own number. |
| Training a segmentation network from scratch in the time available | A rival's untrained head scored below a random baseline. Use pretrained weights. |
| Claiming Jetson, TensorRT, or IDD-3D results without them | Instant credibility loss; rivals are honest about this gap. |
| Adding features faster than they are verified | This repo's failure mode is fluent claims outrunning measurements. Verify each initiative before the next. |
| Editing historical audit files | They are the evidence that our process is real. |

---

## 5. Suggested audit cadence

After P1-P4, and again after P5-P7, run the same skeptical-judge audit used previously (open every file, recompute hashes and math, grep for stale numbers, re-verify all prior fixes, quote `SIH26053_Standards_To_Beat.md` verbatim). New work is where the last four contradictions originated.

## 6. The winning narrative (what all of this adds up to)

> "It runs at sensor rate on real LiDAR frames, and here is the measured sustained FPS. It uses a fixed, provable memory bound, and here is exactly what accuracy that costs at each range band versus a uniform 5 cm map. It adapts its foveation to speed and hazards under that same budget, tracks uncertainty that grows with range, removes moving-object ghosts with our own measured recall by range and speed, and a real Nav2 planner picks the same route on our compressed map as on the full-resolution one. Here is precisely what we did not do, and here is the single command that reproduces every number."

That combination — real-time honesty, quantified fidelity, true adaptivity, downstream planner proof, and transparent scope — is not currently claimed by any public repo we found.
