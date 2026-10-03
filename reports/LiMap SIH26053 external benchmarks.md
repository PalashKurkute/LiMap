# Fix LiMap's credibility before adding features

LiMap's underlying design is sound and on-brief: integer-nested 5/10/25/50 cm rings, a fixed preallocated cell pool, Welford statistics and dual-elevation clearance. The problem is that its evidence layer currently works against it. The dashboard shows "DRDO thresholds" that DRDO never published, plus a 0.04% planner regret that contradicts the project's own measured 3.45% mean and 10.52% max. The headline 100% moving-object recall comes from ground-truth labels leaking into the evaluation. The ROS 2 package names a fabricated `drdo.res.in` maintainer. The docs quote at least four different latencies and three different mIoU figures for the same pipeline. Even with every number corrected, the system meets none of the four official deliverables in full. Specifically, the "multi-factor foveation" differentiator is not in the code; the pipeline runs at about 0.3 FPS end-to-end on CPU with segmentation; the "map" is an unregistered 10-frame smear in the sensor frame; and the 935.7× memory claim is a capacity ratio against a calculated dense array, while the measured occupied-cell gain over a uniform 5 cm 2.5D grid is only 1.41×. The best rivals publish candid caveats and real-data results: Pragyaam reports 65.2% mIoU, 22 ms on GPU and 0 of 4,071 ghost frames; pushpam calls a 1.6× ratio "the honest headline". Unverifiable or contradictory numbers will be noticed in a side-by-side comparison. The idea deadline is 5 October 2026, so the next 48 hours should go to integrity: strip invented thresholds and leaked metrics, pick one defensible number per claim, and build the 6-slide PDF around what is true. Engineering work for the December finale should then go to registration, real-time GPU inference, honest baselines and implementing the foveation claim.

## A sound grid idea undermined by its own evidence

Several things are genuinely strong and should stay at the centre of the pitch:
- The ring lattice uses integer scale factors 1/2/5/10 over 0–10/10–25/25–50/50–100 m (`core/grid/nested_lattice.py:3-7, 33-37`), which matches the PS's "5 cm within 10 m … 50 cm up to 100 m" example almost exactly.
- The memory pool is fixed and preallocated (`core/grid/spatial_hash.py:45`). Only three public rivals claim the same deterministic memory bound.
- Welford/Chan variance merging, the dual-elevation clearance concept, PCA local ground fitting, and a real pretrained SalsaNext evaluated by distance band are all real.
- The team keeps a candid `docs/reference/KNOWN_LIMITATIONS.md`, a stress harness, and a FastAPI + React dashboard.

The team also has a self-audit culture: `docs/ROADMAP.md:16` already labels 935.7× "a *capacity* ratio". That culture is the asset to build on.

The trouble is that the presentation layer was written ahead of the evidence and never reconciled with it. Two different judges would draw opposite conclusions depending on which file they open first:
- a judge reading `KNOWN_LIMITATIONS.md` sees a careful, self-critical team;
- a judge opening the dashboard's scorecard sees a "5/5 VERIFIED" table against DRDO requirements that do not exist.

At the idea stage, evaluators score "novelty of the idea, complexity, clarity and details in the prescribed format, feasibility, practicability, sustainability, scale of impact, user experience and potential for future work progression" ([SIH 2026 Guidelines](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)). The PS-owning organization makes the final decision and "isn't obligated to declare a winner unless student proposals meet their expectations" (same source). For a DRDO panel, a fabricated DRDO affiliation or invented DRDO pass marks is not a presentation flaw. It is grounds to stop reading.

## Two days to the idea deadline, about ten weeks to the finale

| Item | Fact | Source |
|---|---|---|
| Idea deadline | Team nomination and idea submission extended to **05 Oct 2026**. SPOCs and leaders can edit the team name, consent and PPT once, between 02 and 05 Oct. | [sih.gov.in](https://www.sih.gov.in/) |
| Field size | SIH26053 had **202/500** ideas on 3 Oct 2026 | [SIH 2026 PS list](https://www.sih.gov.in/sih2026PS) |
| Shortlist | "4-5 teams per problem statement may be selected for the grand finale" (roughly ≤2.5% of submissions at current volume) | [Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf) |
| Finale | Offline at nodal centres, "proposed to be organized in December 2026". No official dates are published, and the homepage timeline is stale. | [Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf) |
| Idea format | Exactly ≤6 slides including the title, from the official template, uploaded as PDF only. Slides: title; proposed solution; technical approach; feasibility and viability; impact and benefits; research and references. "Avoid paragraphs." | [Official template](https://www.sih.gov.in/letters/2026/SIH2026-IDEA-Presentation-Format.pptx) |
| Prize/IP | ₹1,50,000 per PS. IP is shared between the PS organization and the team. | [Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf) |

The PS deliverables, verbatim from the official listing ([SIH 2026 PS list](https://www.sih.gov.in/sih2026PS)):

> • A Deep Learning Model: A network (e.g., PointNet++ or a Sparse Convolutional Neural Network) capable of semantic segmentation of point clouds into terrain, static obstacles, and moving objects.
> • Variable Resolution Grid Engine: An algorithm that projects classified 3D points into a 2.5D grid where the resolution is high (e.g., 5cm cells) within a 10m radius and decreases (e.g., 50cm cells) up to a 100m radius.
> • Real-time Visualization: A dashboard showing the 2.5D map with distinct color-coding for terrain and objects, demonstrating a significant reduction in memory usage compared to a uniform high-resolution 3D map.
> • Performance Metrics: Evidence of low latency (high FPS) and high accuracy in object classification across varying distances.

The PS description adds one hard correctness clause: the data structure must handle variable resolution "without causing alignment errors or data loss during the projection from 3D to 2.5D." The official page gives **no PS-specific rubric, dataset, sensor or hardware target**, and no numeric thresholds of any kind ([SIH 2026 PS list](https://www.sih.gov.in/sih2026PS)). Any "DRDO threshold" in LiMap's materials is therefore invented by definition.

## Critical gaps: six integrity failures that can end the run

### C1. Invented DRDO thresholds and a planner-regret figure 86× better than measured

The scorecard in `dashboard/client/src/components/DRDOScorecardModal.tsx:32-79` pairs each result with a made-up "DRDO REQUIREMENT":
- "< 3.50 MB Total RAM" (line 32);
- "Ghost trail persistence < 0.20s at 45 km/h" (line 56);
- "Trajectory cost difference < 1.00% vs 3D map" (line 64).

It then reports "0.04% Planner Regret (near-zero)" (line 65) and "0.04% Divergence vs 3.2 GB Dense Octree -> PASSED" (line 79), along with "5/5 VERIFIED", "0.00s Ghost Persistence", "2.53m clearance" and "0.55m crater (σ²=0.08)".

The same invented bound appears in three more places:
- the cell pool comment "≤ 3.5 MB" (`core/grid/spatial_hash.py:4, 45`);
- "< 3.50 MB DRDO bound" (`dashboard/client/src/components/DataInspectionScreen.tsx:530`);
- "DRDO BOUND" (`dashboard/client/src/App.tsx:706`).

`TacticalObjectiveCard.tsx:219` hardcodes "99.89% LESS RAM".

The project's own measured regret is **3.45% mean / 10.52% max** on real frames and **19.84%** on the synthetic underpass. The 0.04% figure is therefore wrong by two orders of magnitude, and the "dense octree" it cites does not exist in the code: the baseline is a calculated array, not an octree.

**Fix:** delete the scorecard modal, or rebuild it as "Internal targets (team-defined)" with measured values pulled from a results JSON. Remove every "DRDO bound/requirement/threshold" string. If the repo or dashboard will be linked from the PPT, this text edit belongs in the pre-5-Oct list.

### C2. Ground-truth leakage behind the 100% moving-object recall

In `benchmark/full_sequence_eval.py:50`:

```python
stride_onnx: int = 0,  # 0: use gt semantics; >0: run ONNX every N frames
```

With the default of 0, no segmentation engine is built (line 80). The grid receives the ground-truth labels, which include the SemanticKITTI moving classes 252–259. `core/tracking/mos_filter.py:17-19` then flags any point labelled 252–259 as dynamic. The "Moving-Object Recall 100.00%" in `docs/progress_log.md` (P4) therefore measures label lookup, not motion detection. The 11.07% precision reported alongside it shows how much is being flagged.

`benchmark/evaluate_real_regret.py` likewise feeds raw GT labels to both FoveaGrid and the "dense" reference. The regret number therefore never sees a segmentation error.

The standard protocol for this task is IoU on the moving class via `evaluate_mos.py` over seq 08 ([PRBonn/LiDAR-MOS](https://github.com/PRBonn/LiDAR-MOS); [semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)), using predicted inputs only. An expert judge who sees "100% recall" from a two-frame heuristic will assume leakage immediately, because learned SOTA on the same validation split is 71–86% IoU ([MambaMOS](https://arxiv.org/html/2404.12794v1)).

**Fix:** withdraw the 100% figure from every doc. Make predicted semantics the default (`stride_onnx>0`) and fail loudly if any label ≥252 reaches `mos_filter`. Report IoU_MOS, with P/R as secondary metrics.

### C3. A fabricated DRDO maintainer identity

`ros2_ws/src/foveagrid_nav2/package.xml:7` and `setup.py:18-19` declare the maintainer as "FoveaGrid DRDO Perception Team <autonomous-ugv@drdo.res.in>". A student team listing a DRDO email address it does not own, in a DRDO-sponsored contest, is impersonating the PS owner. Of everything in the repo, this is the item most likely to be read as misconduct rather than over-enthusiasm.

**Fix:** replace it with a real team member's name and email today. It is a two-line text change.

### C4. One pipeline, four latencies and three accuracies

| Metric | Value | Where it is stated |
|---|---|---|
| Pipeline latency | 7.04 ms | `benchmark/BENCHMARK_REPORT.md` §7 |
| | 323.74 ms | `docs/reference/KNOWN_LIMITATIONS.md` §4 |
| | 18 ms p50 grid | `docs/progress_log.md` P4 |
| | **121.99 ms mean / 301.77 ms p95** grid+costmap; **3,107 ms** SalsaNext ONNX on CPU; **3,229 ms (~0.3 FPS)** end-to-end | `benchmark/latency_profile_results.json` (latest) |
| mIoU | 42.25% (88.96% accuracy) | `BENCHMARK_REPORT.md`, `real_miou_results.json` |
| | 40.32% (84.83%) | `KNOWN_LIMITATIONS.md` |
| | 32.60% | `pre_pitch_audit.md`, `perception_upgrade_plan.md` |
| MOS precision/recall | 61.75% / 52.00%; "21 turning frames" | `KNOWN_LIMITATIONS.md` |
| | 61.6% / 47.65%; 6 turning frames | `real_dynamic_mos_results.json` |
| Planner regret | 15.11% | `competitive_matrix.md` |
| | 19.84% | `BENCHMARK_REPORT.md` |

`BENCHMARK_REPORT.md` also contradicts itself. In Scenario C, "Diverted Away from Uncertainty: False" sits next to "Standard 2.3: CLEARED (First public implementation)". Scenario B's "3.94% (Target <1.5%)" sits next to "near-zero navigation regret". The report also cites a "Section 10" that does not exist.

Judges do not need to know which number is right. They only need to see two of them.

**Fix:** generate one `results/manifest.json` from a single script. Docs and slides must quote only that file, and every superseded number must be deleted rather than kept for history.

### C5. False claims about rivals

`docs/competitive_matrix.md` makes three claims that the team's own `docs/reference/SIH26053_Standards_To_Beat.md` contradicts:
- It says no rival evaluates planner regret. Pragyaam/VRgrid lists it as a metric.
- It says every rival collapses elevation to one value. sih_053 and NEXA separate ground from obstacle, and sih_053 handles overhangs.
- It says sih_053 uses an "unbounded dynamic hash". That repo reports a fixed 18.3 MB preallocated pool ([pushpam README](https://github.com/pushpam2404/sih_053)).

The matrix also still cites `Stxtics03/vrgrid`, which now returns 404 because it was renamed to `Pragyaam-SIH26053` ([Pragyaam](https://github.com/Stxtics03/Pragyaam-SIH26053)). Competitor teams and mentors read each other's public repos. A mischaracterisation that is easy to disprove costs more credibility than any feature gains. `ARCHITECTURE.md` §6 is also stale: it says Nav2, the real dataset and ONNX are not done, which contradicts `KNOWN_LIMITATIONS.md`.

**Fix:** rewrite the matrix from rival READMEs, labelled "self-reported, not reproduced". Update the URLs and the `ARCHITECTURE.md` status table.

### C6. Cited evidence missing from the repo

The docs cite the following files, none of which exist in the repo (some are gitignored):
- `benchmark/full_sequence_results.json`
- `benchmark/mos_banded_results.json`
- `data/real/seq08_run_results.json` (gitignored)
- `models/salsanext-onnx-float/metadata.json`
- `test_phase1_invariants.py`
- `test_phase3_adversarial.py`
- `JUDGE_QA.md`
- `current_data_snapshot.md`
- `data/rellis_loader.py`
- `data/pseudo_label_idd3d.py`
- `core/perception/negative_hazards.py`
- `scripts/finetune.py`

One doc also leaks an absolute path from another machine (`/Coding/Projects/Personal/2.5D-Lidar-/models/...`). A judge who clicks through to a cited file and gets a 404 will discount every uncited claim as well.

**Fix:** commit the small result JSONs, and remove or rephrase every reference to code that does not exist.

## High gaps: the four deliverables are claimed but not met

### H1. "Multi-factor foveation", the headline differentiator, is not implemented

`ARCHITECTURE.md` §2.4 and `PROBLEM_STATEMENT_CONTEXT` §6.2 promise a fovea driven by:
- distance;
- roughness;
- semantic hazard;
- dynamic velocity;
- compute load.

They also promise that "thin poles/pedestrians stay at 5–10 cm regardless of distance". In the code, `core/grid/nested_lattice.py:52-67` assigns rings purely by radius, and `core/grid/fovea_controller.py` only shifts the ring centre using five speed/yaw presets. No hazard index exists anywhere in the codebase. The pitch therefore promises the one feature that would separate LiMap from the "fixed rings" table stakes every rival already has.

The literature shows what a defensible version looks like:
- Schoppmann et al. drive the level of detail from lateral sensor footprint ([arXiv 2111.06271](https://arxiv.org/abs/2111.06271));
- Montemerlo & Thrun choose "the finest resolution guaranteeing coverage at each range" ([Stanford](https://robots.stanford.edu/papers/Montemerlo04a.pdf));
- RoadRunner M&M uses multi-range, multi-resolution maps at ±50 m/0.2 m and ±100 m/0.8 m ([arXiv 2409.10940](https://arxiv.org/html/2409.10940)).

**Fix (finale):** implement hazard-driven refinement. Cells with step, roughness, negative-gap, pole/person or dynamic evidence get split back to 5 cm inside coarse rings. Measure it by obstacle recall at 25–100 m with and without refinement. **Fix (PPT):** describe it as planned work, not delivered.

### H2. Not real-time by any reading of "low latency (high FPS)"

The measured figures are:
- 3,229 ms end-to-end with SalsaNext on CPU (~0.3 FPS);
- 122 ms mean and 302 ms p95 for grid plus costmap alone (`benchmark/latency_profile_results.json`).

The "21.93 FPS async" path in `core/perception/async_pipeline.py:140` only applies stale semantics `if active_sem is not None and len(active_sem) == len(pts)`. Consecutive KITTI scans almost never have identical point counts, so that path runs without semantics. In the rare frames where the counts do match, labels attach to the wrong points.

For comparison:

| System | Latency | Hardware |
|---|---|---|
| ETH elevation_mapping_cupy, full update | 6.857 ms (19.99 Hz on a 20 Hz LiDAR, 43k points) | Jetson Xavier ([arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)) |
| SalsaNext at 64×2048 | 51 ms | Jetson AGX Orin ([arXiv 2410.08365](https://arxiv.org/html/2410.08365)) |
| Pragyaam | 22.3 ms typical | GPU |
| pushpam | 51.8 ms mean | CPU, single-thread |

**Fix:** run SalsaNext through ONNX Runtime CUDA/TensorRT FP16 at 64×2048 (or 64×1024, which roughly halves time per the same study). Fix the async path by re-projecting stale labels through the pose delta, or drop it. Report p50/p95 per stage with hardware, precision and versions. No public SIH26053 repo has any measured Jetson number, so this is an open lane.

### H3. The "map" is an unregistered smear, not a map

`scripts/run_seq08.py:111-116`, `full_sequence_eval.py` and `evaluate_dynamic_mos.py` accumulate a 10-frame rolling window of points in each frame's own sensor coordinates, with no transform into a common frame. At ~10 m/s, static structure smears by up to ~10 m within one window.

The grid has the following limitations:
- It is ego-centric and reset every window.
- It has no persistence.
- It has no scrolling buffer of the kind grid_map provides "without copying data" ([grid_map](https://github.com/ANYbotics/grid_map)).
- It never uses odometry to register scans.
- It never evaluates odometry against KITTI GT poses (no ATE/RPE).

The reference pipeline does registration first: transform to the map frame, compensate drift, shift the map, then fuse ([arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)). Nav2 expects the local costmap in `odom` ([Nav2 guide](https://docs.nav2.org/rolling/configuration_and_development/first_time_robot_setup_guide/sensors/mapping_localization/)). Every downstream number inherits this smear: elevation, clearance, ghosts and regret.

**Fix:** register scans with KITTI GT poses first, then a LiDAR odometry front-end such as KISS-ICP or FAST-LIO2 for the GNSS-denied story. Add a scrolling circular buffer and report ATE/RPE.

### H4. The spatial hash silently loses data, which the PS explicitly forbids

`core/grid/spatial_hash.py` has five defects:
1. **Silent drops.** Points are dropped when the pool is full or a probe chain exceeds 16 steps, and no counter records them. The PS's "without … data loss" clause is therefore unmeasured, and the "976/976 per-frame memory assertions pass" result is tautological, because `cells.nbytes` is constant by construction.
2. **Count saturation.** The `uint8` count saturates at 255 while the Welford mean/M2 keep updating with `new_cnt=256`. Variance computed as `m2/(count-1)` then grows without bound in dense cells.
3. **Merged overhang statistics.** Overhang returns are merged into the same `mean_z/m2_z` as ground returns. This contradicts the separate ground/ceiling statistics in `ARCHITECTURE.md` §2.3, and overhang cells get inflated variance and a corrupted mean.
4. **No semantic voting.** The semantic id is the first point's label, never voted, and the cell has no confidence, no timestamp, no decay and no velocity.
5. **Dead fusion code.** The range-aware Kalman fusion (P6) is dead code per `docs/audit/pre_pitch_audit.md`.

The expected baseline is a per-cell Kalman update with point variance σp² = σd·d², Mahalanobis gating, and time-variance growth ([arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)). Multi-level surface maps store multiple patches per cell to represent overhangs ([OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)).

There is also an arithmetic problem with the pool size. LiMap's own ring schedule at full coverage needs about 479k cells:

| Ring | Range | Cell size | Cells at full coverage |
|---|---|---|---|
| 0 | 0–10 m | 5 cm | 125.7k |
| 1 | 10–25 m | 10 cm | 164.9k |
| 2 | 25–50 m | 25 cm | 94.2k |
| 3 | 50–100 m | 50 cm | 94.2k |

The pool holds 106,875 cells (`spatial_hash.py:45`), about 22% of that total and smaller than the 5 cm fovea alone. Sparsity may keep occupancy under the cap, but nobody has measured whether it does.

**Fix:**
- Add `dropped_points` and `pool_occupancy` counters and publish them per frame.
- Use `uint16`/`uint32` counts.
- Keep separate ground and overhang statistics.
- Use a majority/probabilistic semantic vote.
- Wire in the Kalman path.

### H5. The seam proof tests a tautology

`verify_zero_seam_gaps` checks two things, both true by construction:
- cell corners are integer multiples of 5 cm;
- every radius maps to some ring.

It does not test the following:
- whether a coarse cell straddling a ring boundary double-represents area already covered by fine cells, with split statistics;
- point conservation;
- frame-to-frame stability under the fovea shift, where ring assignment uses warped coordinates, so the same ground can change rings between frames.

Rivals publish stronger evidence:
- NEXA claims "100.000% point conservation asserted every frame" ([NEXA](https://github.com/sam-eer12/sih2026));
- pushpam reports "0 mismatches over 4M positions" ([pushpam](https://github.com/pushpam2404/sih_053));
- LiFovea assigns level by the nearest cell corner, tested with 12,000 jittered samples ([LiFovea](https://github.com/akumar4be26-crypto/LiFovea)).

**Fix:** add a per-frame invariant `points_in == points_binned + points_out_of_range + points_dropped`. Add a boundary-overlap property test, and a test that a static world point stays in the same cell across fovea shifts.

### H6. The memory headline compares against a strawman, and the measured gain is 1.41×

The 935.7× figure divides a calculated dense array by the pool size:
- The dense array is "100m x 100m x 10m @ 5cm … 800M voxels * 4 bytes = 3051.76 MB" (`benchmark/evaluate_real_regret.py:138-143`).
- The pool is 3.2616 MB.
- That footprint covers a 100 m square, not the 200 m square a 100 m radius needs, so the baseline is internally inconsistent.
- The 3.26 MB counts only the cell pool, not point buffers, model or costmap rasters.

The project's own measured occupied-cell ratio against a uniform 5 cm 2.5D grid is **1.41×** (`benchmark/fidelity_study_results.json`).

The research is blunt on this point:
- Dense arrays are not what anyone deploys. OctoMap's own table shows a 5,162.9 MB dense grid becoming 990.66 MB as a pruned octree at 10 cm ([OctoMap AuRo 2013](http://www.arminhornung.de/Research/pub/hornung13auro.pdf)).
- UFOMap saves a further 61–65% ([arXiv 2003.04749](https://arxiv.org/pdf/2003.04749)).
- nvblox allocates only observed 8×8×8 blocks ([arXiv 2311.00626](https://arxiv.org/pdf/2311.00626)).

Rivals pre-empt this criticism. Pragyaam reports both 286× vs 3D and 21.5× vs uniform 2.5D, and pushpam calls 1.6× vs uniform 20 cm "the honest headline" ([Pragyaam](https://github.com/Stxtics03/Pragyaam-SIH26053); [pushpam](https://github.com/pushpam2404/sih_053)).

A defensible structural number is the cell count at full coverage: 479k cells for LiMap's schedule versus 12.57M for a uniform 5 cm disk of radius 100 m, i.e. **≈26× fewer cells**.

**Fix:** lead with that structural ratio, and show the measured occupied-cell ratio beside it. Add a measured OctoMap/UFOMap run at 5 cm or 10 cm on the same frames as the PS-mandated "uniform high-resolution 3D map" baseline.

### H7. Ghost removal casts about one ray in a thousand

`core/tracking/free_space_eraser.py` has four problems:
- It casts rays only toward points already classified dynamic, subsampled 1/64 and then stride 16 (≈1/1024).
- Erased cells are reset to a hardcoded z = −1.70 m (KITTI sensor height) and semantic 40 (road).
- It runs as per-ray Python loops.
- The metric is "cells carved".

The reference, elevation_mapping_cupy, ray-casts for every point on every scan, with time and surface-normal guards against grazing-angle jitter ([arXiv 2204.12876](https://arxiv.org/pdf/2204.12876)). The standard map-level metric is static accuracy / dynamic accuracy / their geometric mean (SA/DA/AA): DUFOMap reaches **97.96/98.72/98.34** on KITTI 00 ([arXiv 2403.01449](https://arxiv.org/html/2403.01449)) via [DynamicMap_Benchmark](https://github.com/KTH-RPL/DynamicMap_Benchmark). Pragyaam claims "0 of 4,071 frames missed".

**Fix:**
- Vectorised (Numba/GPU) ray casting over all returns.
- Restore cells to the local ground estimate, not to a constant.
- Report SA/DA/AA plus ghost-clearing latency in scans.

### H8. MOS sits between geometric baselines and learned methods

The MOS is a two-frame range-disparity heuristic gated by predicted classes. Its pooled P 61.6% / R 47.65% converts to roughly **36.7% IoU_MOS**, with recall in ring 0 of only 38%. That beats LMNet's published non-learned baselines on test (Residual+RG+Semantics 20.6, SceneFlow+Semantics 28.7; [LMNet](https://ar5iv.labs.arxiv.org/html/2105.08971)). It is well below learned validation results:
- LMNet 59.9–67.1;
- 4DMOS 71.9–77.2;
- MF-MOS 76.1;
- MapMOS 86.1 ([MF-MOS](https://arxiv.org/html/2401.17023v1); [MambaMOS](https://arxiv.org/html/2404.12794v1)).

**Fix:** present it honestly as "geometric MOS ≈37% IoU, above published geometric baselines". Add pose-compensated multi-frame residuals and a Kalman/track confirmation step, or swap in LMNet-style residual channels on the same SalsaNext backbone.

### H9. Segmentation: narrow evaluation, no off-road data, non-commercial weights

The DL deliverable has five separate problems.

**1. The model choice is not justified.** SalsaNext is a range-image CNN, while the PS names "e.g., PointNet++ or a Sparse Convolutional Neural Network", and no document defends the choice. The defence is available. An independent study found SalsaNext the only model it tested that runs in real time at 20 Hz on both RTX 4090 and Jetson AGX Orin ([arXiv 2410.08365](https://arxiv.org/html/2410.08365)).

**2. The evaluation is a small, non-standard subset.** It covers the first 100 consecutive frames of seq 08 (of 4,071), without kNN post-processing. The 42.25% mIoU is depressed by 4 classes absent from that subset. Published SalsaNext numbers are 56.6% without kNN and 59.5% with kNN ([SalsaNext](https://ar5iv.labs.arxiv.org/html/2003.03653)). The standard protocol accumulates one confusion matrix over all of seq 08 ([semantic-kitti-api](https://github.com/PRBonn/semantic-kitti-api)).

**3. The weights carry licensing risk.** The Qualcomm AI Hub export publishes no accuracy figure and no training split ([HF qualcomm/SalsaNext](https://huggingface.co/qualcomm/SalsaNext)), so seq 08 may not even be held out. Its SemanticKITTI-derived weights fall under CC BY-NC-SA 4.0, which is non-commercial ([semantic-kitti.org](http://www.semantic-kitti.org/dataset.html)). That matters for any DRDO or iDEX path.

**4. Indian classes are not learned.** Autorickshaw and cattle exist only as 32,000 pseudo-labelled points from synthetic IDD-3D-style boxes, yet the docs claim "Standards 5.4/5.5 CLEARED". Real IDD-3D has 3D boxes only, not point-wise labels ([arXiv 2210.12878](https://arxiv.org/abs/2210.12878)).

**5. There is no off-road evaluation, despite the defence UGV framing.** On RELLIS-3D, SalsaNext scores 40.20% mIoU, and networks lose 13–24 points versus SemanticKITTI ([RELLIS-3D](https://github.com/unmannedlab/RELLIS-3D); [Springer 2024](https://link.springer.com/article/10.1007/s41315-024-00376-5)). Rival Drishti already reports 0.619 mIoU on RELLIS-3D ([Drishti](https://github.com/GargBhavya-tech/Drishti)). The Cylinder3D plan in `docs/perception_upgrade_plan.md` remains unexecuted.

**Fix:**
- Run `evaluate_semantics.py` over all of seq 08, with kNN.
- Report per-distance-band IoU for terrain/static/dynamic (the PS's "accuracy across varying distances").
- Fine-tune and evaluate on GOOSE, which is CC BY-SA 4.0 and commercially usable ([goose-dataset.de](https://goose-dataset.de/)), and on RELLIS-3D.
- State the licence plan.

### H10. Planner regret uses 5 frames, a 2D "3D reference" and leaked labels

The regret evaluation has six weaknesses:
- It uses the team's own Python Hybrid-A*, not Nav2.
- It covers only frames 0, 5, 10, 20 and 30 (the first 3 seconds of seq 08), with a fixed straight-ahead goal.
- The "dense 3D reference" is a 2D projection of z > −1.2.
- On every real frame, naive-2D cost equals FoveaGrid cost, so dual elevation is never exercised on real data.
- Regret is positive (FoveaGrid worse) on 2 of 5 frames.
- Labels come from GT (C2).

BARN-style planner evaluation uses success, collision and traversal-time ratios over hundreds of environments ([BARN 2024](https://arxiv.org/html/2407.01862)).

**Fix:** run Nav2 Smac Hybrid-A* on ≥200 start/goal pairs spread across seq 08, including turns. Use an OctoMap or full-point-cloud reference and predicted labels, and report success/collision/path-cost ratio distributions.

### H11. The ROS 2 node publishes nothing

`core/planning/nav2_bridge.py` (`FoveaGridNav2Node`) and the `ros2_ws` `costmap_node.py` have six problems:
- They create a publisher only: no PointCloud2 subscription, no TF/odometry, no timer.
- The `resource/foveagrid_nav2` ament marker is missing, so `ros2 run` likely fails.
- The ego-centric grid is stamped `map`, where the local costmap should be `odom` ([Nav2 guide](https://docs.nav2.org/rolling/configuration_and_development/first_time_robot_setup_guide/sensors/mapping_localization/)).
- It is not a costmap layer plugin.
- It has never been built with colcon.
- There is no Docker setup.

Nav2 expects costs of 0–254, with 255 for unknown ([cost_values.hpp](https://github.com/ros-planning/navigation2/blob/0513db1cf94481958d43ac4e3d15100f2c91c245/nav2_costmap_2d/include/nav2_costmap_2d/cost_values.hpp)). If the node publishes an OccupancyGrid through StaticLayer, `trinary_costmap: false` is required, or graded costs collapse to free/lethal ([Nav2 costmap config](https://docs.nav2.org/lyrical/configuration_and_development/configuration_guide/core_servers/costmap_2d/)). Only pushpam claims Nav2 in the field, and it admits it has "never run on a robot".

**Fix:** subscribe to PointCloud2, look up TF, and publish `grid_map_msgs/GridMap` plus an `odom`-frame OccupancyGrid. Ship a rosbag replay launch file and a Docker image, and record a working RViz video.

### H12. Negative obstacles and curbs: heuristic thresholds, synthetic validation, curb failures

- Craters are any z < −1.95 m in the geometric fallback.
- No rim-based detection exists (roadmap P12 is undone).
- Validation uses synthetic potholes only.
- Curb survival **fails in ring 1 and ring 3** (`benchmark/fidelity_study_results.json`).
- Slope immunity is tested only on synthetic ramps.

The accepted LiDAR approaches are:
- treating no-return gaps as hazards (NODR; [DTIC](https://apps.dtic.mil/sti/tr/pdf/ADA561293.pdf));
- the ray-cast upper-bound layer, which separates occlusion holes from drops ([arXiv 2204.12876](https://arxiv.org/pdf/2204.12876));
- the standard step/slope/roughness filter trio, with a 0.12 m critical step ([traversability_estimation](https://github.com/leggedrobotics/traversability_estimation/blob/master/traversability_estimation/config/robot_filter_parameter.yaml)).

Coarse rings average away a pothole's rear wall and a curb's step, which is exactly why H1's hazard refinement matters.

**Fix:** add shadow/gap detection, an upper-bound layer, and refinement on step edges. Report hazard precision/recall/F1 by range band.

## Medium and low gaps: reproducibility and hygiene

| # | Severity | Gap | Evidence | Fix |
|---|---|---|---|---|
| M1 | Medium | A fresh clone does not install | No `README.md`, although `pyproject.toml` declares `readme="README.md"`, so `pip install` fails. No LICENSE, `.github` CI, Dockerfile or Makefile. Tests live in `benchmark/`. `requirements.txt` omits numba, onnxruntime and pytest, so the core path silently falls back to slow pure Python. No model download script. | Add README with a 3-command quickstart, LICENSE, CI running pytest, complete requirements, and a `scripts/fetch_model.sh` with checksum. |
| M2 | Medium | Test suite fails on a fresh clone | Run of 2026-10-03: **22 passed, 6 failed, 1 error**. `KNOWN_LIMITATIONS.md` §8 points to `scripts/generate_synthetic.py` (scene_c only). The tests need `data/generate_synthetic.py`. After that: 28 passed, 1 error. `test_costmap_parity` takes `scan_path`, so the "0/360,000 cell parity" proof never runs. `scripts/verify_all_milestones.py`: 2/6. | Generate fixtures in a conftest, make the parity test a real fixture-driven test, and mark data-dependent tests as skip-with-reason. |
| M3 | Medium | Deployment does not match claims | Vercel serverless deploy cannot hold WebSockets. `data/synthetic` is gitignored, so the default scene is missing. The frontend never opens `/ws/stream`, and its viewport loads static `public/kitti_sample_08.json`. ARCHITECTURE says deck.gl, the code uses Three.js. CORS uses `allow_origins=*` with credentials. | Host on a VM/Render with Docker, stream real frames over the WebSocket, fix CORS, and correct the docs. |
| M4 | Medium | "Full-sequence" covers 24% of the sequence | 976 of 4,071 seq 08 scans. The "second sequence" (P4) is 5 synthetic frames. | Run all of seq 08 plus one other sequence, and RELLIS-3D or GOOSE. |
| M5 | Medium | No standard map-quality metrics | No elevation RMSE/MAE by range band, no coverage, and no hazard P/R/F1. These are the standard elevation/traversability metrics ([RoadRunner M&M](https://arxiv.org/html/2409.10940); [RoadRunner](https://arxiv.org/pdf/2402.19341)). | Build pseudo-ground truth from posed, accumulated seq 08 scans and report per-band RMSE and coverage. This directly answers "what did coarsening cost?" |
| M6 | Medium | No robustness or defence framing | No corruption testing (Robo3D: 8 corruptions × 3 severities, mCE/mRR; [Robo3D](https://arxiv.org/html/2303.17597v4)). No adverse-weather set (SemanticSTF: 2,076 fog/snow/rain scans; [arXiv 2304.00690](https://ar5iv.labs.arxiv.org/html/2304.00690)). No SOTIF triggering-condition list ([TÜV SÜD](https://www.tuvsud.com/-/jssmedia/global/pdf-files/whitepaper-report-e-books/tuvsud-sotif.pdf)). No GNSS-denied statement. | Run SemanticKITTI-C beam-missing/fog/crosstalk as dust proxies, and add a one-page SOTIF hazard list. |
| L1 | Low | Branding and provenance noise | LiMap, FoveaGrid and "Team Abhedya" all in use. `pyproject` lists one author. `.agents/` and "Claude Council" audit personas are committed. 36 docs with no index. Superlatives such as "first public implementation". Internal "Standards 2.3/5.4 CLEARED" read as external standards. | One name. Move agent files out. Add a docs index. Rename "Standards" to "internal targets". |
| L2 | Low | No related-work or contribution statement | No citations of variable-resolution prior art: Montemerlo 2004, Schoppmann 2021, RoadRunner M&M, OctoMap/UFOMap, elevation_mapping_cupy. | Add a references slide and an "our delta" paragraph. |
| L3 | Low | No determinism test | Roadmap P11 (same input gives same hash) is not done. Pragyaam claims bit-identical CPU/GPU maps. | Add a hash test over 50 frames. |

## Gap matrix against the four official deliverables

| PS deliverable (verbatim intent) | What LiMap has | What is missing or wrong | Status |
|---|---|---|---|
| **DL model** segmenting into terrain / static obstacles / moving objects | Pretrained SalsaNext ONNX. 42.25% mIoU on 100 frames, with per-band breakdown. | Model choice vs "PointNet++/Sparse CNN" not justified. Not evaluated on full seq 08, no kNN. "Moving objects" in the eval come from GT leakage (C2), and the real MOS is ≈37% IoU. No off-road data, no Indian classes learned. NC-licensed weights. | **Partial** |
| **Variable-resolution grid engine**, 5 cm ≤10 m → 50 cm ≤100 m, "without alignment errors or data loss" | Integer-nested 5/10/25/50 cm rings. Fixed pool. Welford/Chan statistics. Dual elevation. | Silent point drops with no counter. Pool smaller than the 5 cm fovea alone. Count saturation corrupts variance. Overhangs merged into ground statistics. Seam proof tautological. No registration, so the map smears. Multi-factor foveation absent. | **Partial, correctness unproven** |
| **Real-time visualization** with colour-coded terrain/objects and memory reduction vs a uniform high-res 3D map | React/Three.js dashboard with colour coding and a memory meter. | Shows invented DRDO thresholds (C1). Static JSON instead of a live stream. Memory compared against a calculated dense array, not a real 3D map. Not real-time. Serverless deploy cannot stream. | **Partial, integrity risk** |
| **Performance metrics**: low latency (high FPS) and high classification accuracy across distances | Latency profiler JSON and per-band mIoU. | ~0.3 FPS end-to-end on CPU. Four conflicting latency claims. No GPU/Jetson numbers. Accuracy-by-distance on 100 frames only, not by the PS's three super-classes. | **Not met** |
| PS task 1: terrain analysis (drivable vs non-drivable) | Semantic remap plus PCA slope. | No step/slope/roughness traversability layer with robot-tied thresholds. Curb survival fails in rings 1 and 3. | Partial |
| PS task 2: static/dynamic object detection | Semantic classes plus a geometric MOS. | No tracking confirmation. Ghost carving at 1/1024 rays. No SA/DA/AA. | Partial |

## Competitor positioning: what is table stakes and where the open lanes are

All rival figures below are self-reported in READMEs and were not reproduced. LiMap's column uses its own best defensible, measured values.

| | **LiMap (honest)** | Pragyaam/VRgrid | pushpam sih_053 | NEXA | Drishti | LiFovea |
|---|---|---|---|---|---|---|
| Seg model / mIoU | SalsaNext, 42.25% (100 frames) | FRNet 65.2% seq 08 | none shipped | SqueezeSegV2 (in RESULTS.md) | 0.619 RELLIS-3D | 0.827 (simulator only) |
| Latency | 122 ms grid (CPU); 3.2 s with DL | 22.3 ms (GPU) | 51.8 ms (CPU) | n/q | 106 ms (GPU) | 230 ms (CPU) |
| Memory | 3.26 MB pool; 1.41× measured vs uniform 2.5D | 8.94 MB; 21.5× vs 2.5D | 18.3 MB; 26× vs 2.5D | 22.67× fewer cells | 12.6 MB; 16× | 9.9 MB; 97× |
| Seam / conservation | Corner-alignment check only | Partition tests | 0/4M mismatches | 100% conservation | Property tests | 12k-jitter audit |
| Ghost metric | Cells carved | 0/4,071 frames missed | 0/286 false-moving | — | Tracker | — |
| ROS 2 / Nav2 | Publisher stub | — | Humble + Nav2 (unrun) | — | — | — |
| Jetson measured | — | — | — | — | — | — |

Sources: [Pragyaam](https://github.com/Stxtics03/Pragyaam-SIH26053), [pushpam](https://github.com/pushpam2404/sih_053), [NEXA](https://github.com/sam-eer12/sih2026), [Drishti](https://github.com/GargBhavya-tech/Drishti), [LiFovea](https://github.com/akumar4be26-crypto/LiFovea).

**Table stakes**, meaning LiMap merely matches the field:
- 5 cm/10 m → ~50 cm/100 m rings;
- an MB or ×-reduction figure;
- a SemanticKITTI-to-terrain/static/dynamic remap;
- a colour-coded dashboard;
- an answer to the PS's alignment/data-loss clause.

**Already beaten**, where LiMap trails:
- segmentation accuracy and GPU speed, against Pragyaam;
- point conservation and seam proof, against NEXA and pushpam;
- the honesty of the memory headline, against pushpam and Pragyaam;
- ghost metrics, against Pragyaam.

Copying Pragyaam's FRNet/CuPy stack in ten weeks is unlikely to win. The lanes that remain open, i.e. claimed by at most one rival and verified by none, are better targets:
- **Measured Jetson Orin latency.** No repo has any.
- **A ROS 2/Nav2 stack that actually runs**, demonstrated on a rosbag. pushpam's admits it never ran.
- **Truly adaptive, hazard-driven foveation.** No rival goes beyond kinematic stretch, and LiMap already promises it.
- **Off-road and defence-relevant evaluation:** RELLIS-3D/GOOSE plus SemanticKITTI-C corruption robustness. Only Drishti has RELLIS-3D, and no rival frames dust or GNSS-denial.
- **Planner regret with a real 3D reference across a full sequence.** Pragyaam lists the metric, but its fork admits "no universal planner-regret curve yet" ([vrgrid-26](https://github.com/victorysingh/vrgrid-26)).

The candour bar is high: pushpam, LiFovea and saxenaatharv all publish "what we did not measure" sections. LiMap's `KNOWN_LIMITATIONS.md` can compete on that axis, but only after C1–C6 are fixed.

## Action plan

### Before the 5 October idea submission (documents, PPT and string edits only)

| Priority | Action | Why |
|---|---|---|
| 1 | Replace the `drdo.res.in` maintainer in `package.xml:7` and `setup.py:18-19`. | Impersonation risk (C3). Two-line edit. |
| 2 | Remove every "DRDO requirement/bound/threshold" string and the 0.04%, 99.89%, 935.7× and 100%-recall figures from the dashboard and docs (`DRDOScorecardModal.tsx`, `TacticalObjectiveCard.tsx:219`, `DataInspectionScreen.tsx:530`, `App.tsx:706`). If time is short, at least hide the scorecard. | C1 and C2. Matters if the PPT links the repo. It is not known whether idea evaluators open repos, so assume they might. |
| 3 | Freeze one number per claim in a one-page "numbers sheet". Use: mIoU 42.25% (100 frames, no kNN, labelled as such); MOS ≈37% IoU geometric; latency 122 ms grid / ~3.2 s with CPU DL, stated as "GPU port planned"; regret 3.45% mean / 10.52% max on 5 frames; memory ≈26× fewer cells vs uniform 5 cm 2.5D (structural) and 1.41× occupied (measured). | C4. Judges punish contradictions more than modest numbers. |
| 4 | Build the 6 slides around what is true. Slide 2: foveated nested lattice plus dual-elevation clearance plus hazard-driven refinement (planned). Slide 3: pipeline flowchart (LiDAR → SalsaNext → registered nested grid → ghost ray-cast → Nav2 costmap) and one dashboard screenshot. Slide 4: risks and mitigations taken from KNOWN_LIMITATIONS (CPU latency → TensorRT; NC weights → GOOSE retrain; registration → KISS-ICP). Slide 5: UGV/GNSS-denied defence use, iDEX path. Slide 6: references (SalsaNext, elevation_mapping_cupy, OctoMap, Schoppmann, RoadRunner M&M, SemanticKITTI/GOOSE). | Template compliance plus the scored criteria: clarity, feasibility, novelty ([template](https://www.sih.gov.in/letters/2026/SIH2026-IDEA-Presentation-Format.pptx)). |
| 5 | Present multi-factor foveation, Nav2, Jetson and off-road as roadmap items, never as delivered. | H1, H2, H9, H11. |
| 6 | Fix `competitive_matrix.md` and `ARCHITECTURE.md` §6, or remove them from the public repo, and add a minimal README. | C5, M1. |

### Before the finale (about ten weeks, in dependency order)

| Week | Work | Acceptance evidence |
|---|---|---|
| 1 | Integrity infrastructure: a single `results/manifest.json` generator; commit the result JSONs; remove the GT-label path from MOS and regret by default (C2, C4, C6). | Every doc number traces to the manifest, and a CI check fails if any label ≥252 enters `mos_filter`. |
| 1–2 | Spatial hash correctness: drop/occupancy counters; wider counts; separate ground/overhang statistics; semantic vote; range-variance Kalman wired in; point-conservation and boundary-overlap tests (H4, H5). | Per-frame `dropped_points` = 0, or reported, on all of seq 08. Conservation test passing. |
| 2–3 | Registration and persistence: GT poses, then KISS-ICP/FAST-LIO2; scrolling buffer; ATE/RPE (H3). | Static walls sharp across a 10-frame window, plus an ATE/RPE table. |
| 2–4 | GPU real-time: ONNX Runtime CUDA/TensorRT FP16; Numba grid; fix the async label re-projection; Jetson Orin run if any board can be borrowed (H2). | p50/p95 per stage, with hardware, precision and versions stated. Target ≤100 ms end-to-end at 10 Hz. |
| 3–4 | Honest evaluation: full seq 08 `evaluate_semantics.py` with kNN; IoU_MOS via `evaluate_mos.py`; per-band elevation RMSE and coverage; measured OctoMap/UFOMap and uniform 5/10/20 cm 2.5D baselines (H6, H8, H9, M5). | Protocol-comparable numbers next to SalsaNext 56.6/59.5 and LMNet 59.9+. |
| 4–6 | Implement hazard-driven foveation and negative obstacles: refinement on step/gap/pole/person/dynamic evidence; upper-bound and shadow layer (H1, H12). | Far-range curb and pothole recall with versus without refinement, and curb survival passing in rings 1 and 3. |
| 5–6 | Ghost removal at full rate: vectorised ray casting over all returns; SA/DA/AA on DynamicMap_Benchmark KITTI 00 (H7). | SA/DA/AA reported against DUFOMap's 97.96/98.72/98.34. |
| 6–7 | ROS 2/Nav2 that runs: PointCloud2 subscription, TF, `odom` frame, GridMap plus OccupancyGrid output, `trinary_costmap: false`, Smac Hybrid-A* + MPPI on a rosbag, Docker (H11). | Screen recording of Nav2 planning on LiMap's costmap from `docker run`. |
| 7–8 | Regret at scale: ≥200 start/goal pairs across seq 08 with predicted labels and a 3D reference (H10). | Distribution plot of regret, success and collision. |
| 8–9 | Off-road and robustness: GOOSE fine-tune (commercially licensable), RELLIS-3D eval, SemanticKITTI-C corruptions as dust proxies, SOTIF hazard list, licence statement (H9, M6). | mIoU on an off-road set, an mCE/mRR table, and a one-page SOTIF sheet. |
| 9–10 | Reproducibility and polish: README quickstart, CI green from a fresh clone, fetch scripts, determinism hash test, a live WebSocket dashboard on a non-serverless host, one brand name (M1–M3, L1–L3). | A fresh clone reaches a green test run and a live demo in ≤3 commands. |

## Conclusion

LiMap's biggest risk is not a missing feature but missing trust. The field for SIH26053 is crowded (202 ideas and rising) and already publishes candid caveats, so a reviewer will judge LiMap first on whether its numbers survive a click-through. Right now they do not. The upside is that most of the damage is textual and can be fixed within the 5 October window. After that, the strongest finale story is not "more memory savings". It is the claim LiMap already makes but has not built: a map whose resolution follows hazards rather than radius, registered in `odom`, served to a working Nav2 stack, and timed on embedded hardware. No public rival has verified that combination.

Two uncertainties remain. It is unknown whether idea-stage evaluators look at GitHub repos at all, and every rival number cited here is self-reported and unreproduced. Neither changes the recommendation. A team that leads with measured, modest, consistent numbers and a precise roadmap is better placed for a DRDO panel than one leading with a "5/5 VERIFIED" scorecard against requirements DRDO never wrote.
