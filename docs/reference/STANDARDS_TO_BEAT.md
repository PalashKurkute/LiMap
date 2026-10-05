# SIH26053: standards to beat the best public repos

**Benchmark target.** The strongest public rival is **Pragyaam-SIH26053** (formerly Stxtics03/vrgrid, forked as victorysingh/vrgrid-26; Team Chronicles.exe). Its closest rivals on single dimensions are **pushpam2404/sih_053** (honesty, negative obstacles, ROS 2/Nav2) and **sam-eer12/sih2026 "NEXA"** (ground/obstacle separation, clean grid math). Rival facts below come from their own READMEs (checked 2026-10-03, **self-reported, not run by us**; details and links in [COMPETITORS.md](COMPETITORS.md)). "(dossier)" marks facts from the Sep 2026 team dossier that were not re-checked.

Each row is a bar a rival has already shipped, or a gap rivals admit. **Status today** is filled only where `benchmark/*.json`, the planner snapshot or the project facts support it; otherwise "not verified". Rows with no rival named are open lanes. Full 38 rows kept; the "why it matters" prose is shortened.

## 1. Core data structure

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 1.1 | Nested ring schedule on one shared fine lattice, each coarse cell an exact block of fine cells (prevents the named failure: alignment errors at boundaries) | Pragyaam, sih_053 (1:2:10 integer nesting), NEXA | 4 rings: 5/10/25/50 cm cells to 10/25/50/100 m, all integer multiples of 5 cm. Seam test result: not verified |
| 1.2 | Zero measured mismatches at seams, proven by a test ("what happens at ring boundaries?" needs a number) | sih_053: 0 mismatches over 4,000,000 positions | not verified |
| 1.3 | Fixed, preallocated memory envelope, no per-frame allocation | Pragyaam 8.94 MB fixed; sih_053 18.3 MB | 3.2616 MB = 106,875 cells x 32 B, preallocated; no heap reallocation during a 50,000-point burst (`edge_hardware_profile.json`) |
| 1.4 | Ground height and obstacle height stored separately per cell (curbs, potholes and overhangs together) | NEXA, sih_053 | One synthetic underpass: the one-height grid finds no route, the clearance-aware grid finds one (cost 26.36, empty-map route 22.0; planner snapshot). One scenario only |
| 1.5 | Empty cells cost zero memory (spatial hash) | Pragyaam, sih_053 | Pool of 106,875 cells; mean 57,524 occupied per frame over 20 real frames (`fidelity_study_results.json`) |
| 1.6 | Closed-form O(1) cell index, no per-point search | NEXA | not verified |

Whitespace (dossier): no repo combined 1.1-1.6 with equal rigour. The dossier's claim that Pragyaam lacks 1.4 was not confirmed.

Why it matters: 1.3, a hard bound is a strong embedded claim ("usually low" is not); 1.4, one elevation value structurally cannot hold curbs, potholes and overhangs together; 1.5, without it memory numbers lose; 1.6, it removes a class of projection-alignment bugs by construction.

## 2. Uncertainty and confidence

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 2.1 | Per-cell height variance, updated online (Welford) | Pragyaam, sih_053 | Welford running mean and variance |
| 2.2 | Coarsening preserves uncertainty (law of total variance): a merged kerb must not look falsely certain | Pragyaam: sigma 6.3 cm on a merged kerb cell | not verified |
| 2.3 | Confidence exposed to and used by a downstream planner | none shown (Pragyaam computes regret but shows no planner avoiding low-confidence cells) | not verified |
| 2.4 | Bayesian elevation fusion: height is an estimate updated per scan | LiFovea claims per-cell Kalman fusion and inverse-variance coarsening | Kalman update exists (`welford_fusion.py:109`) but only a test calls it: heights are Welford, not wired in |

Bar: do 2.1-2.2, then go beyond every repo on 2.3 by feeding per-cell confidence into a planner cost and showing a path that avoids a low-confidence region.

Why it matters: 2.2, without it a curb can vanish statistically in the far field though the raw data shows it; 2.4, one noisy frame cannot corrupt a stable map.

## 3. Dynamic and moving-object handling

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 3.1 | Zero ghost trails, measured over a real multi-thousand-frame sequence (the PS title's headline claim) | Pragyaam: 0 of 4,071 frames missed (seq 08) | 509 ghost cells carved over 50 frames (`real_dynamic_mos_results.json`). No full-sequence ghost metric in a results file |
| 3.2 | Viewpoint-robust moving test: a parked car must not read as moving when the ego view changes; test against a naive tracker | sih_053: 0/286 static objects misreported vs 69/337 for DBSCAN+SORT (dossier adds 0/129) | Static FPR 1.05% on 44 straight frames, 1.54% on 6 turning frames (+0.491 points) |
| 3.3 | Recall by range band and ego speed, with honesty about where it drops | sih_053: recall by range 100/86/67% at 18 km/h (dossier: 100% to 74%) | Overall over 50 frames: precision 61.6%, recall 47.65%, FPR 1.103%. Banded results: not verified (file not in the repo) |
| 3.4 | Occlusion modelled in the test scene | sih_053 | not verified |

Whitespace (dossier): no repo shows dynamic handling under degraded sensing (dropped beams, rain, dust).

Why it matters: 3.2, a speed-only tracker fails this constantly, so test against it; 3.3, judges reward an unflattering honest number (for example near-field recall falling at high ego speed) over one blanket accuracy; 3.4, occlusion lowers recall but makes it defensible.

## 4. Negative obstacles and terrain hazards

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 4.1 | Dedicated negative-obstacle detection (below-ground returns), not just "high point = obstacle". India: potholes and vertical anomalies caused 4,446 accidents and 1,856 deaths (MoRTH 2022, dossier) | sih_053: a 40 cm pothole changed from FREE to NEGATIVE; NEXA pothole depth error 0.0108 m; Drishti claims range-shadow physics | not verified |
| 4.2 | False-positive rate on slopes measured ("a slope is not a trench") | sih_053: 0/8,404 cells misflagged on 2-4% downgrades (dossier) | not verified |
| 4.3 | Overhang / passable-underneath detection | sih_053 (overhang class); NEXA gantry clearance error 0.0024 m; LiFovea clearance | As 1.4: one synthetic scenario |
| 4.4 | Local per-patch ground plane (RANSAC/PCA), not one global ground | Corrected: RakshaSetu uses RANSAC ground, NEXA a RANSAC fallback, Pragyaam Patchwork++. sih_053's roadmap lists it unbuilt (about 27 m reach limit on 8% downgrades, dossier) | not verified |

Why it matters: 4.2 pre-empts "what about a hill?"; 4.3, the overhead blind spot is the classic documented 2.5D failure; 4.4 is an open, self-admitted gap in the strongest rival. Bar: replicate 4.1-4.3, then build 4.4.

## 5. Semantic segmentation

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 5.1 | Real pretrained model with a published mIoU, never an untrained placeholder | Pragyaam: FRNet 90.3% points, 65.2% mIoU (seq 08). sih_053 admits placeholder weights at 5.01% mIoU vs a 6.64% uniform-random baseline | SalsaNext ONNX, 100 frames of seq 08: 88.96% accuracy; mIoU 42.25% over 19 classes, 53.52% over the 15 present (`real_miou_results.json`). Model file not in the repo |
| 5.2 | mIoU by distance band (0-10, 10-25, 25-50, 50-100 m), so foveation is shown not to hide far-field loss | Pragyaam accuracy 95.1 / 91.8 / 92.0% at 0-10 / 10-25 / 25-50 m | Ring 0 37.96%, Ring 1 44.04%, Ring 2 30.93%; Ring 3 has no points in the subset (same file) |
| 5.3 | Off-road (RELLIS-3D) evaluation with realistic expectations. Published: SalsaNext 40.20%, KPConv 18.64% (official); a 2024 study: SalsaNext 43.07%, Cylinder3D 46.07%. The dossier's "KPConv 19.07%" was not found in any source | Corrected: Drishti claims 0.619 mIoU on RELLIS-3D (all 5 sequences) | not done: only seq 08 evaluated |
| 5.4 | Indian / off-road classes (gravel, mud, grass, puddle, curb, pothole, cattle, autorickshaw); Western sets contain no autorickshaws or cattle | Rare (dossier) | not verified |
| 5.5 | IDD-3D with pseudo-labelling to turn its boxes into per-point labels | None | not verified |

Why it matters: 5.1, "never demo an untrained model: judges will ask for your mIoU" (dossier); 5.2 shows whether foveation quietly destroys far-field accuracy; 5.3, DRDO vehicles go off-road, so a city-only evaluation is a callable-out gap; 5.4-5.5, KITTI and RELLIS-3D contain no autorickshaws or cattle, so a model trained only on them misclassifies these by construction.

## 6. Determinism, reproducibility, honesty

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 6.1 | Bit-identical map hash for the same input | Pragyaam ("CPU and GPU maps bit-identical") | not verified |
| 6.2 | Stated scope of what was and was not tested | sih_053: "we would rather hand a reviewer numbers that are smaller and true than numbers that are larger and unverifiable" | `KNOWN_LIMITATIONS.md` states CPU only, no embedded run |
| 6.3 | Every number traces to a command that regenerates it | Pragyaam: `results.json` from one command, tied to a git commit (dossier) | Numbers live in `benchmark/*.json` and the Evidence page; docs quote file names |
| 6.4 | Team can explain every module; original vs cited prior work stated | Pragyaam cites 7 papers (dossier); novelty claim is the composition | not verified |

Why it matters: 6.1 reads as engineering maturity; 6.2, matching this honesty defuses the hardest judge questions (the dossier's top pitfall is overclaiming); 6.4, judges may recognise copied repos, and narrow novelty claims survive where broad ones do not.

## 7. Evaluation methodology

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 7.1 | Planner regret as a first-class metric, R(S) = C(P(S)) - C(P(reference)) | Pragyaam (no regret curve yet per its fork) | Mean 3.45%, max 10.52% over 5 real frames (0, 5, 10, 20, 30; `real_regret_results.json`) |
| 7.2 | Regret with a real planner integration (Nav2), not a synthetic cost field | none: Pragyaam is synthetic, sih_053 has Nav2 but no regret | Own Hybrid-A*, no comparison against a Nav2 planner |
| 7.3 | Frechet distance or similar path-shape comparison | Pragyaam | Mean 0.584 m, max 1.626 m (same file) |
| 7.4 | Memory and compute savings reported separately (far-field point savings are small: LiFovea found 78% of returns within 25 m) | LiFovea (dossier) | Reported in separate files: memory in `fidelity_study_results.json`, latency in `latency_profile_results.json` |

Why it matters: 7.1 asks "did compression change what the robot does", the most judge-visible metric found; 7.2 is open: both halves (Pragyaam's regret metric, sih_053's Nav2 hookup) exist separately in public code; 7.3 shows how a path changed, not only its cost; 7.4, conflating the two savings is an easy catch.

## 8. Hardware and deployment

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 8.1 | CUDA/TensorRT path exists | Corrected: sih_053 has 1 .cu file (never compiled); Pragyaam has 0 .cu files (CuPy GPU path claimed) | CPU only |
| 8.2 | GPU path compiled and profiled with a before/after latency | Corrected: Pragyaam claims 22.3 ms typical, 26.7 ms worst 1% (CuPy); Drishti 9.4 FPS (106 ms) on one GPU; foveamap a T4 | not done: CPU only |
| 8.3 | Real embedded-board run with latency (power/thermal if possible) | none: no repo has a Jetson measurement | No embedded run. `edge_hardware_profile.json` projections (e.g. 5,493.71 ms for Jetson AGX Orin) are scaled from the old 4,069 ms host baseline, not runs |
| 8.4 | Compiled (non-Python) rasterise/publish stage | sih_053: Python rasteriser is 27.1 ms of 51.8 ms mean | Grid + costmap warm median 57.9 ms (17.3 FPS), mean 122.0 ms (8.2 FPS); full pipeline with ONNX 0.31 FPS (`latency_profile_results.json`) |

Why it matters: the dossier called 8.2 and 8.3 the most concrete low-research differentiators because rivals said their CUDA code was uncompiled and had no board run. Since then Pragyaam, Drishti and foveamap claim GPU runs (self-reported), so 8.3 is the lane still open: any embedded board, even a cheaper one, counts. 8.4 is directly fixable (sih_053 scoped the C++ path).

## 9. Data readiness and demo robustness

| # | Standard | Best so far | Status today |
|---|---|---|---|
| 9.1 | Datasets and weights pre-staged offline before the finale (dossier: Pragyaam alone needs about 40 GB for three SemanticKITTI sequences) | n/a | not verified |
| 9.2 | Degraded-input harness (dropped beams, noise) showing graceful degradation | none by name | not verified |
| 9.3 | Live dashboard shows the shrinking memory bar, not a static number | NEXA, sih_053, Pragyaam (Rerun) | Evidence page shows 935.7x and 37.4x (CALCULATED) and 1.41x (MEASURED) from the JSON |

Why it matters: 9.1 is a logistics failure (finale connectivity is not guaranteed) that costs nothing to prevent; 9.2 answers "what if the sensor is dirty?" before it is asked; 9.3 is the PS's own named wow feature.

## 10. The combined bar

No public repo clears all of: nested-ring grid with separate ground/obstacle height (section 1); uncertainty-preserving coarsening feeding a planner (2); viewpoint-robust, band-reported dynamic filtering (3); negative obstacles plus local ground fitting (4); a real pretrained model by distance band and on off-road/Indian data (5); deterministic, honestly scoped results (6); regret against a real Nav2 planner (7); a compiled GPU path or real embedded run (8); pre-staged data and a degraded-sensor demo (9). Clearing about 70% of rows with honest, regenerable numbers, and listing the rest as future work, puts a prototype ahead of every public repo found as of 2026-10-03.
