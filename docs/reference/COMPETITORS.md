# SIH26053: competitor repositories

Public entries for the same problem statement and what they claim. **Every rival figure is self-reported in a README and
was not run by us.** Checked 2026-10-03 unless a row says otherwise. Re-date a row whenever you re-check it. Our own
figures come only from `benchmark/*.json` (see `KNOWN_LIMITATIONS.md`). Never name rivals in the product, the demo or slides.

## Positioning at a glance (2026-10-03)

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

## Per-repository findings

#### Takeaway
Of the 8 named repos, 7 are reachable. `Stxtics03/vrgrid` returns 404 and was renamed or replaced by `Stxtics03/Pragyaam-SIH26053`. `kaushik521645/lidar-2.5D` and `lidar-2.5D-mapping` return 404; the live repo is `kaushik521645/lidar-2.5D-mapping-main`. The strongest by README depth and evidence are:
- Pragyaam/VRgrid: SemanticKITTI, FRNet, fixed 8.94 MB, ghost removal, planner regret, 338 commits.
- pushpam2404/sih_053: C++ engine, ROS 2/Nav2/FAST-LIO2, negative obstacles, but no trained DL model.
- LiFovea: simulator-only, PointNet++-lite at 0.827 mIoU, quadtree with alignment audit.
- sam-eer12 NEXA: polar ring-sector grid, deployed web app, CPU ONNX.

The others are thinner: kaushik (4 commits), saxenaatharv (RandLA-Net wrapper), RakshaSetu (team scaffold with ROS 2 nodes and a PointNet++ checkpoint claim).

#### Cited Findings

### 3.1 Stxtics03/Pragyaam-SIH26053 (formerly "vrgrid"; Team Chronicles.exe, team ID 178295)
- Repo status: `Stxtics03/vrgrid` returns HTTP 404 from the GitHub API. `Stxtics03/Pragyaam-SIH26053` was created 2026-09-10, last commit 2026-09-28 ("Update README.md"), with **338 commits**. The tree has 342 files (166 .py, 11 .cpp/.h — apparently the Unreal viewer — and **0 .cu files**). The README says "The Python package is still named `vrgrid`, from the project's earlier name." — [GitHub repo](https://github.com/Stxtics03/Pragyaam-SIH26053)
- Claims, measured on SemanticKITTI (self-reported):
  - Schedule: rings 0–10 m at 5 cm, 10–25 m at 10 cm, 25–50 m at 20 cm, 50–100 m at 40 cm; PS 5/10/50 schedule supported as a config.
  - Memory: "745,000 cells × 12 B = 8.94 MB" allocated once (6.24 MB on the PS schedule), "21.5× smaller" than a uniform 5 cm 2.5D grid (192 MB) and "286× smaller" than dense 5 cm 3D voxels (2.56 GB).
  - Speed: GPU frame time "22.3 ms typical / 26.7 ms worst 1% (~45 FPS)"; map + FRNet half precision "79.5 ms worst 1%, inside the 10 Hz budget".
  - Segmentation: FRNet "90.3% points, 65.2% mIoU (seq 08, held out)"; accuracy vs distance "95.1 / 91.8 / 92.0% at 0–10 / 10–25 / 25–50 m".
  - Mapping: near-field height error "1.59 cm median"; ghost cleanup "0 of 4,071 frames missed (seq 08)"; "CPU and GPU maps bit-identical".
  - Tests: "667 tests".

  [Pragyaam README](https://github.com/Stxtics03/Pragyaam-SIH26053)
- Other features: law-of-total-variance merge ("merged kerb cell reports σ = 6.3 cm"), range-image visibility ghost removal, Patchwork++ ground segmentation, deskewing, a single world-coordinate query API, and planner regret listed as an evaluation metric. Tech stack: "Python 3.11 · NumPy · CuPy + custom CUDA kernels · PyTorch (FRNet) · Patchwork++ · Rerun · Unreal Engine 5.8 · pytest". It has a demo video, a Canva deck, Rerun dashboard demo scripts (foveation, ghosts-on/off, traffic), and a `docs/gpu-lane/` folder with AWS runbook, CUDA port plan, float audit and VRAM-contention logs — [Pragyaam README](https://github.com/Stxtics03/Pragyaam-SIH26053); [file tree via GitHub API](https://github.com/Stxtics03/Pragyaam-SIH26053/tree/main/docs/gpu-lane)
- No ROS 2/Nav2 integration and no Jetson measurement are claimed. "Custom CUDA kernels" is claimed, but there are no .cu files; GPU code appears to be CuPy, and this was not verified in source — [Pragyaam README](https://github.com/Stxtics03/Pragyaam-SIH26053)

### 3.2 victorysingh/vrgrid-26 (fork of Stxtics03/Pragyaam-SIH26053)
- A GitHub fork (parent: Stxtics03/Pragyaam-SIH26053), created 2026-09-12. Last commit 2026-09-12 ("gpu-lane: the float audit, and the overflow bound measured not reasoned"); pushed 2026-09-23; 215 commits; 198 files, 0 C++/CUDA — [GitHub repo](https://github.com/victorysingh/vrgrid-26)
- This snapshot predates the Pragyaam rename and is more conservative. It says: "The mapping pipeline is a CPU reference implementation in numpy. There is no CUDA kernel in this repository, and every latency figure quoted here was measured single-threaded on an Intel i7-14650HX." It reports end-to-end latency of "89.18 ms p50 / 100.43 p99", "Zero allocation in the frame loop — 8.15 → 1.31 MB/frame, p99 74.7 → 49.4 ms", and "No model training is required" (labels come from SemanticKITTI ground-truth .label files). It gives the same 8.94 MB / 21.5× / 286× / 0 of 4,071 ghost figures, a coarsening ratio of "1.18–1.84 across rings 1–3", and a partition test over 10⁶ points. It admits: "No universal planner-regret curve yet… The current synthetic evaluation scene does not provide a sufficiently graded cost field" — [vrgrid-26 README](https://github.com/victorysingh/vrgrid-26)
- Inference: between 12 Sep and 28 Sep the team added FRNet (a real DL model) and a GPU (CuPy) path. Their latency claim fell from ~89 ms CPU to ~22 ms GPU. The fork exposes the earlier, GT-label-only state.

### 3.3 pushpam2404/sih_053
- Created 2026-09-16; last commit 2026-09-21; 15 commits; 88 files (42 .py, 7 C++/CUDA including 1 .cu, ROS 2 packages and launch files). Model files `minkunet18_drdo.onnx`, `minkunet18_drdo_ep30.pth` and `minkunet18_traced.pt` are present — [GitHub repo](https://github.com/pushpam2404/sih_053)
- Target platform is "NVIDIA Jetson AGX Orin + Ouster OS1-64, ROS 2 Humble". The README states: "We did not test on Jetson AGX Orin hardware… Every number in this repository is CPU latency on an Apple M4 laptop, single-threaded, against synthetic OS1-64 scans." It also says "The CUDA kernels exist but have never been compiled" and "ROS 2 nodes… have never run on a robot" — [pushpam README](https://github.com/pushpam2404/sih_053)
- Claims (self-reported):
  - Schedule: 5 cm within 10 m, 10 cm to 25 m, 50 cm to 100 m. One preallocated spatial-hash pool of 40-byte cells with min/max/mean height and Welford roughness.
  - Nesting: "0 mismatches over 4M positions" between levels, via integer division 1:2:10.
  - Endurance: "3.3 km at 40 km/h, 0 dropped points" with bounded memory.
  - Latency: "51.8 ms mean / 60.2 ms p95 … 19.3 Hz". The Python rasteriser takes 27.1 ms of that.
  - Memory: "18.3 MB" vs 479 MB uniform 5 cm 2.5D (26×) and 3,835 MB 3D voxels (210×). The README calls the uniform-20 cm (~30 MB, 1.6×) comparison "the honest headline".
  - Moving objects: whole-footprint shift plus vacated-space test. "0 / 286" static objects misreported, compared with 69/337 for DBSCAN+SORT. Recall by range is 100/86/67% at 18 km/h.
  - Negative obstacles: a 40 cm pothole changes from FREE to NEGATIVE.
  - Object classification is a geometric decision tree, "~100% on the synthetic scene" (caveated by the team).
  - Navigation: FAST-LIO2 → map → Nav2 (SmacPlannerHybrid + MPPI), with RViz markers and an offline HTML dashboard.

  [pushpam README](https://github.com/pushpam2404/sih_053)
- On deep learning: "The problem statement names a segmentation network. We did not ship one, and we do not claim one." The SalsaNext-Lite pipeline and ONNX export are built, but the "models/* files are placeholders… 5.01% mIoU against a 6.64% uniform-random baseline". RELLIS-3D could not be downloaded — [pushpam README](https://github.com/pushpam2404/sih_053)

### 3.4 sam-eer12/sih2026 ("NEXA", Team KANVSS)
- Created 2026-08-28; last commit 2026-09-10; 116 commits; 3 stars; 260 files (63 .py, 58 TS/JS). Model files `squeezesegV2_5class.pt` and `squeezesegV2_fp32.onnx` are present. Live demo: nexa-drdo.duckdns.org (not checked) — [GitHub repo](https://github.com/sam-eer12/sih2026)
- Claims (self-reported):
  - Grid: ring-sector polar grid with "662 rings, 705,771 cells … 22.67× fewer cells than a uniform 5 cm grid"; "Closed-form O(1) projection… 100.000% point conservation asserted every frame".
  - Hazard errors on synthetic scenes: pothole depth "0.0108 m", gantry clearance "0.0024 m", curb "0.0026 m"; 0 false positives on a flat scene.
  - Perception: CPU-only range-image CNN via ONNX Runtime with a RANSAC fallback; "19 SemanticKITTI classes → 5 PS classes".
  - Decision layer: Kalman tracking, costmap, A*, and template reason strings with "no LLM".
  - Tests: "382 tests".
  - Stack: FastAPI binary WebSocket → Next.js 16/React 19/Three.js; Firebase auth; MongoDB Atlas; Docker/Caddy on AWS Graviton; plus a Scilab drone payload model.
  - Latency and mIoU are deferred to `docs/RESULTS.md` and not quoted in the README.

  [NEXA README](https://github.com/sam-eer12/sih2026)
- No ROS 2, CUDA or Jetson ("Embedded-GPU latency measurement on Jetson-class hardware" is listed as future scope). Temporal accumulation is also future scope, so the map is single-scan — [NEXA README](https://github.com/sam-eer12/sih2026)

### 3.5 kaushik521645/lidar-2.5D(-mapping) → actual: kaushik521645/lidar-2.5D-mapping-main ("FoveaMap")
- `kaushik521645/lidar-2.5D` and `kaushik521645/lidar-2.5D-mapping` both return 404. The user's repo list shows `lidar-2.5D-mapping-main`: last commit 2026-09-23 (message "new"), **4 commits**, 53 files (36 .py, 7 JS), no model weights committed — [GitHub user repos](https://github.com/kaushik521645?tab=repositories)
- Claims: "Extreme Memory Efficiency (85–90% Savings)" with a sparse 2.5D polar grid; multi-layer z_ground / z_obstacle_bottom / z_obstacle_top; "Kinematic Dynamic Foveation" (speed stretch, steering shear); RandLA-Net via Open3D-ML collapsed to 4 classes; constant-velocity Kalman tracker with ghost-trail erasure; FastAPI WebSocket to a deck.gl dashboard "at up to 30 FPS"; mIoU, distance-bucketed accuracy and latency utilities. It reports no measured mIoU, latency or MB, and admits that "lightweight AI checkpoints may overfit" — [kaushik README](https://github.com/kaushik521645/lidar-2.5D-mapping-main)

### 3.6 akumar4be26-crypto/LiFovea
- Created 2026-09-18; last commit 2026-10-02; 9 commits; 56 files (34 .py, 44 tests claimed); Dockerfile and render.yaml for hosting — [GitHub repo](https://github.com/akumar4be26-crypto/LiFovea)
- Claims (self-reported; **all on a built-in procedural simulator, not real data**, 20 held-out frames, 2 vCPU, no GPU):
  - Segmentation: "point accuracy / mIoU 95.4 % / 0.827". Dynamic-object IoU is 0.548 with recall 0.582.
  - Memory: "9.9 MB vs 960 MB for a uniform 5 cm grid — 97× smaller".
  - Elevation P95 error: 10 mm at 0–10 m, 147 mm at 70–100 m.
  - Latency: "230 ms/frame (4.4 fps) with the network".
  - Structural audit: "0 alignment error, 0 cross-level overlaps, 0 ring violations".
  - Grid: power-of-two quadtree (5/10/20/40/80 cm). The level is decided by the nearest cell corner (ring-boundary test with 12,000 jittered samples). Inverse-variance coarsening and per-cell Kalman elevation fusion.
  - Models: PointNet2Lite (168k params), a sparse-voxel BEV net and a geometric fallback (91.7%).
  - Planning: 0.8 m navigation tiles with A*. The dashboard re-grids live in the browser.

  [LiFovea README](https://github.com/akumar4be26-crypto/LiFovea)
- Admitted limits: "Pedestrian recall is 0.58"; "Ego pose is taken as known"; no deskew; "Foveated inference is currently a no-op"; "Numbers here are not KITTI numbers, and the loaders for real data are not written." No ROS 2, CUDA or Jetson — [LiFovea README](https://github.com/akumar4be26-crypto/LiFovea)

### 3.7 p3iyanshu/RakshaSetu (Team JanSetu)
- Created 2026-08-31; last commit 2026-09-28; 69 commits; 213 files (55 .py, 28 JS). It includes a ROS 2 package `ros2_ws/src/rakshasetu` (nodes: lidar_ingest, preprocessing, segmentation, grid_engine, tracking, fusion, ego_odometry; plus a launch file), a vanilla-JS/WebGL dashboard, an admin console, and android-app and desktop-admin folders. No model weights are committed — [GitHub repo](https://github.com/p3iyanshu/RakshaSetu)
- The top-level README is a team-organization scaffold (6-member task briefs, mock data generator) with no metrics. It says the `security/` module "hasn't started yet" — [RakshaSetu README](https://github.com/p3iyanshu/RakshaSetu)
- Sub-READMEs:
  - The grid engine is a polar (range_bin, angular_bin) dict with "8 bands from 0 to 100m, 5cm cells out to 10m, growing to 50cm at 100m". It uses a fixed angular step per band to avoid alignment error and explicitly handles the atan2 ±180° **seam**. It uses RANSAC ground — [grid_engine/README.md](https://github.com/p3iyanshu/RakshaSetu/blob/main/grid_engine/README.md)
  - The models README cites a PointNet++ checkpoint trained on SemanticKITTI (~19K scans, 50 epochs) with "held-out validation mIoU (0.868)". It also reports per-frame mIoU of 0.558, and 0.32 → 0.62 on one real frame after downsampling to 8192 points — [models/README.md](https://github.com/p3iyanshu/RakshaSetu/blob/main/models/README.md)
  - There is DBSCAN + Kalman/SORT tracking with ego-motion compensation (tracking/ folder).

### 3.8 saxenaatharv/3D--2.5D-LIDAR
- Created 2026-08-22; last commit 2026-09-20 ("Delete 000015.bin"); 49 commits; 25 files (13 .py) — [GitHub repo](https://github.com/saxenaatharv/3D--2.5D-LIDAR)
- What it is: a wrapper around the **pretrained Open3D-ML RandLA-Net SemanticKITTI checkpoint**, with fine-tuning on a 90/10 split. Components:
  - Ring grid "VaRLA" (0–10 m at 5 cm, 10–30 m at 20 cm, 30–60 m at 35 cm, 60–100 m at 50 cm).
  - OpenCV desktop dashboard, plus a FastAPI and HTML web app with a heuristic fallback.
  - `run_log.csv` (fps, active cells, memory saving, mIoU).
  - Evaluation module E1–E6: obstacle recall vs uniform 5 cm, height error, range-band breakdown, point spacing, ring-schedule ablation, size/time.
  - Unit test asserting "a point sitting exactly on a ring boundary is assigned to exactly one ring".
  - Jetson `tegrastats` instructions, with the note "I have not run this myself (no Jetson available here)".

  No numeric results are quoted in the README. No ROS 2, ghost/dynamic handling, or tracking — [saxenaatharv README](https://github.com/saxenaatharv/3D--2.5D-LIDAR)

### 3.9 Other notable public SIH26053 repos (GitHub search for "SIH26053", "SIH 26053", "2.5D lidar variable resolution", "foveated lidar", "sih 2026 lidar" returned 40+ PS-26053 repos)
- **GargBhavya-tech/Drishti** (last commit 2026-09-28; DRDO PS 26053), self-reported:
  - Sensor-derived schedule: "5 cm out to ~16 m, 40 cm by 100 m" on Ouster OS1-64.
  - Segmentation: 5.82M-param range-image network, 10-class defence-UGV taxonomy, **"Overall mIoU 0.619" on RELLIS-3D** (all 5 sequences; off-road).
  - Speed and memory: "9.4 FPS end-to-end (106 ms) on a single GPU"; "16× smaller than a dense uniform 2.5D grid (12.6 MB vs 201 MB)".
  - Multi-layer ground/gap/ceiling cells; negative obstacles from range-shadow physics; "Sparsity Trap" UNKNOWN-vs-FREE logic; Kalman tracker ("moving objects are tracked, never smeared into the grid").
  - Time-to-contact fovea; A* with friction-aware speed envelope; Hypothesis property tests ("0 violations in 1,500 real cells").
  - Also uses SemanticPOSS and nuScenes.

  [Drishti](https://github.com/GargBhavya-tech/Drishti)
- **ammar-iitm/foveamap** (last commit 2026-10-01, pushed 2026-10-03), self-reported:
  - "5 cm cells near the vehicle, 50 cm to 100 m, 50× less memory than a uniform 5 cm grid, and no point is lost where the tiers meet".
  - Range-image U-Net (9 classes + moving, using prior sweeps as a motion cue); tiered grid with exact floor-division nesting and 16-byte SoA cells.
  - Torch GPU grid on a T4; Colab notebooks for SemanticKITTI and nuScenes-mini; a Vercel-hosted replay dashboard; PRD and architecture PDFs.

  [foveamap](https://github.com/ammar-iitm/foveamap)
- **subham-sahu06/sentinel-fovea-2.5d**: ROS 2 Jazzy, React/ROSLIB dashboard, safety gateway/e-stop, synthetic LiDAR. The grid is a 50 cm occupancy grid (not truly variable-resolution per its own table) — [sentinel-fovea](https://github.com/subham-sahu06/sentinel-fovea-2.5d)
- **Udit-Agarwal20/avr-map**: a C++20 core with a ROS 2 Jazzy target. Status per its README: "AWAITING DATASET INPUT"; "no model/runtime integration is claimed" — [avr-map](https://github.com/Udit-Agarwal20/avr-map)
- **Team-Beyonders/Fovea-Lidar**: claims ">95% memory reduction" but uses 0.5 m near / 2.0 m far cells, far coarser than the PS example — [Fovea-Lidar](https://github.com/Team-Beyonders/Fovea-Lidar)
- **Aarya562/TERRA-FOVEA**: ROS 2 + C++ description with an "adaptive controller"; the README is conceptual, with no metrics — [TERRA-FOVEA](https://github.com/Aarya562/TERRA-FOVEA)
- Other PS-26053 repos found but not inspected (names, descriptions and last-push dates only, from GitHub search): AbhayVerma628/SIH26053_Lidar, Tonystankers/adaptive-foveated-lidar-mapping and sih26053-lidar-mapping (PointNet++ + UDP ingestion), misense726/MISENSE-SIH26053, Sarasbari/LocoLidar (pushed 2026-10-02), ayush110109mishra/foveated-lidar-mapping (2026-10-02), Prayash-in/risk-aware-lidar-mapping (quadtree + compute-budget control), siddhantkadu0001/AVLM (quadtree), Rj821/AVR-2.5D-LiDAR-Mapping (PointNet++), AmitKumarTripathi123/foveated-lidar-mapping (SemanticPOSS), yodhassu/grideye, prxthzz/Adapt---X-LiDAR-Points, saikoraudhran/AdaVoxel_proto, sih26053/LiDAR, sstharun08/Adaptive-Variable-Resolution-2.5D-LiDAR-Mapping, naveen-elayaraja/ELEVATE-X, LEGiT-47/Vistar-2.5D, arjun-713/veyra, j7452479-a11y/sih, and others — [GitHub search API results](https://github.com/search?q=SIH26053&type=repositories)

#### Inferences
- Commit count and recency put Pragyaam (338 commits, 28 Sep) and NEXA (116) ahead in engineering effort among the named repos. pushpam has few commits (15) but dense, specific, self-critical documentation. kaushik (4 commits) looks like a single code drop.
- The Pragyaam README's "custom CUDA kernels" claim and its fork's "There is no CUDA kernel in this repository" (12 Sep) are not necessarily contradictory, since GPU work came later via CuPy. However, no .cu files exist, so an evaluator checking the repo may question it.
- Several teams pre-empt "inflated baseline" criticism by reporting an honest comparison (pushpam's uniform-20 cm, LiFovea's uniform-80 cm, Drishti's uniform 2.5D). Reporting only "X× vs 3D voxels" now looks weak by comparison.

#### Gaps
- No README numbers were independently reproduced. Live demos (nexa-drdo.duckdns.org, foveamap-teal.vercel.app, Pragyaam YouTube) were not opened.
- NEXA's `docs/RESULTS.md` (latency/mIoU) and Pragyaam's `docs/eval-metric-specs.md` / planner-regret results were not fetched. Pragyaam's README lists planner regret as a metric but quotes no regret number; its fork says no regret curve exists yet.
- It was not verified whether pushpam's committed `minkunet18_*` weights are trained (the README says models are placeholders at 5.01% mIoU).
- Which repos correspond to teams that actually submitted ideas is unknown; repos are not linked to SIH submissions.

## Table stakes vs rare capabilities

#### Takeaway
Table stakes, present in most repos:
- concentric distance-based rings with 5 cm near-field cells;
- a memory-reduction headline vs a uniform grid;
- a mapping from SemanticKITTI to terrain/static/dynamic;
- a web or desktop dashboard;
- some form of ring-boundary or alignment correctness argument.

Rare, present in 1–2 repos:
- real-time ghost-trail removal with a frame-level metric;
- planner-regret evaluation;
- a fixed, preallocated memory bound with bit-identical determinism;
- ROS 2 + Nav2 integration with SLAM odometry;
- negative-obstacle (pothole) detection with measured results;
- a real off-road dataset (RELLIS-3D);
- measured GPU latency with a trained DL model on real data;
- honest per-range accuracy for a trained network on real LiDAR;
- any measured Jetson numbers (zero repos have them).

#### Cited Findings
Capability matrix (self-reported README claims; Y = claimed and described, P = partial, planned or unverified, — = absent):

| Capability | Pragyaam/VRgrid | pushpam sih_053 | NEXA | kaushik FoveaMap | LiFovea | RakshaSetu | saxenaatharv | Drishti | foveamap (ammar) |
|---|---|---|---|---|---|---|---|---|---|
| 5 cm near / coarse far rings | Y (5/10/20/40) | Y (5/10/50) | Y (polar, 5→50) | Y (polar) | Y (5→80 quadtree) | Y (polar 5→50) | Y (5/20/35/50) | Y (5→40, beam-derived) | Y (5→50) |
| Trained DL seg on real data | Y FRNet 65.2% mIoU SemKITTI | — (placeholder 5.01%) | P (SqueezeSegV2 ONNX; mIoU in RESULTS.md) | P (RandLA-Net, no numbers) | — (simulator only, 0.827) | P (PointNet++ 0.868 val claimed) | P (pretrained RandLA-Net) | Y 0.619 mIoU RELLIS-3D | Y (U-Net, SemKITTI/nuScenes) |
| Accuracy by distance band | Y | P (detector recall) | P | P (utility) | Y (sim) | — | Y (E3 recall) | Y | Y |
| Memory figure (MB) | 8.94 MB fixed | 18.3 MB | cells only (22.67×) | % only (85–90%) | 9.9 MB | — | per-run CSV | 12.6 MB | "50×" |
| Alignment/seam/boundary tests | Y (partition, split/merge) | Y (0/4M mismatches) | Y (100% conservation) | P | Y (12k jitter, audit) | Y (atan2 seam) | Y (boundary unit test) | Y (property tests) | Y ("no point lost where tiers meet") |
| Dynamic objects / ghost removal metric | Y 0/4,071 ghosts | Y 0/286 static false-moving | P (Kalman tracker) | P (ghost erasure, no metric) | — (no tracking) | P (SORT) | — | Y (tracker, not smeared) | P (moving class) |
| Negative obstacles / overhangs | P (kerb σ) | Y (pothole, overhang) | Y (pothole, curb, gantry errors) | Y (overhang layers) | Y (curb, clearance) | — | — | Y | Y (overhang, pothole recall in sim) |
| Planner integration / regret | Y regret metric (no curve yet per fork) | Y Nav2 Smac+MPPI | Y A* | — | Y A* | — | — | Y A* + speed envelope | P (cost) |
| ROS 2 | — | Y (Humble, never run on robot) | — | — | — | Y (package skeleton) | — | — | — |
| CUDA/GPU measured | Y (CuPy; 22.3 ms) | — (kernels never compiled) | — (CPU only) | — | — (CPU) | — | P (torch CUDA) | Y (single GPU 106 ms) | Y (T4) |
| Jetson measured | — | — | — | — | — | — | — | — | — |
| Determinism / fixed memory | Y bit-identical | Y preallocated pool | Y preallocated | — | — | — | — | — | — |
| Deployed web dashboard | Rerun + Unreal | offline HTML + RViz | Y (AWS, Next.js) | Y (deck.gl) | Y (Render) | Y (static JS) | Y (FastAPI) | Y (story demo) | Y (Vercel) |

Sources: [Pragyaam](https://github.com/Stxtics03/Pragyaam-SIH26053), [vrgrid-26](https://github.com/victorysingh/vrgrid-26), [pushpam](https://github.com/pushpam2404/sih_053), [NEXA](https://github.com/sam-eer12/sih2026), [kaushik](https://github.com/kaushik521645/lidar-2.5D-mapping-main), [LiFovea](https://github.com/akumar4be26-crypto/LiFovea), [RakshaSetu](https://github.com/p3iyanshu/RakshaSetu), [saxenaatharv](https://github.com/saxenaatharv/3D--2.5D-LIDAR), [Drishti](https://github.com/GargBhavya-tech/Drishti), [foveamap](https://github.com/ammar-iitm/foveamap)

Datasets used: SemanticKITTI (Pragyaam, kaushik, saxenaatharv, RakshaSetu, NEXA, foveamap); RELLIS-3D (Drishti; pushpam attempted but couldn't download); nuScenes(-mini) (foveamap, Drishti); SemanticPOSS (Drishti, AmitKumarTripathi123); synthetic/procedural only (LiFovea, pushpam, sentinel-fovea) — same sources as above.

#### Inferences
- **Table stakes** (a team without these looks behind): 5 cm/10 m → ~50 cm/100 m rings; MB or × memory reduction; terrain/static/dynamic remap from SemanticKITTI; colour-coded dashboard; a stated answer to the PS's "alignment errors or data loss" clause (nesting by integer division, boundary tests, point conservation).
- **Differentiators that are still rare**:
  - measured ghost-trail removal on real sequences (only Pragyaam quantifies it);
  - planner-impact evaluation (Pragyaam's regret, though without a published curve);
  - honest, real-data per-range accuracy of a trained network;
  - negative-obstacle detection with numbers (pushpam, NEXA, Drishti);
  - working ROS 2/Nav2 (pushpam only, unrun);
  - real-off-road data (Drishti/RELLIS-3D) — relevant for a DRDO/UGV framing;
  - any **actual Jetson measurement**, which no repo has; this is a clear open lane;
  - deterministic, fixed-memory guarantees (Pragyaam).
- The bar on candour is high. pushpam, LiFovea and saxenaatharv all have "honesty" sections that flag unmeasured items. Inflated or unverifiable numbers will compare badly side by side.

#### Gaps
- The matrix is built from READMEs only. "Y" means the team claims and describes a feature, not that it was confirmed to run.
- Most of the 40+ other PS-26053 repos were not assessed, so additional strong entrants may exist (e.g., Tonystankers, Prayash-in, Sarasbari/LocoLidar were active in late Sep/early Oct).

## Other rivals noted earlier (2026-09-27, README skim only)

| Repository | What it claims | What was missing then |
|---|---|---|
| `darshan-stack/DRDO` | Feedback-foveated elevation mapping scaffold; uniform baseline first, then adaptive | Scaffold only: no trained model, no quantified metrics |
| `siddhantkadu0001/AVLM` | Quadtree grid; Streamlit dashboard; FPS measurement | No trained backbone |
| `heetkakaria45-bit/LiDAR_Syntrix` | Semantic elevation grid; curbs, speed bumps, potholes, overhang handling | Architecture only: no mIoU or memory figures |
