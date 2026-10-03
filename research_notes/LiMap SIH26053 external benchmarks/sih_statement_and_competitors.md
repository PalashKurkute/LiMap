# SIH26053 official statement, SIH 2026 process, and public competitor repositories (as of 3 Oct 2026)

Research method notes: The official PS text was pulled directly from the HTML of https://www.sih.gov.in/sih2026PS (fetched 3 Oct 2026). SIH 2026 process facts come from the official "SIH 2026 Guidelines" PDF, the official Idea Presentation PPT template and the sih.gov.in homepage/FAQ. Repository facts come from the GitHub REST API (metadata, commit counts, file trees) and raw README files fetched on 3 Oct 2026. **All competitor numbers are self-reported in READMEs and were not reproduced.**

## Q1. Official text of SIH26053 (verbatim)

### Takeaway
The official sih.gov.in listing exists and is quoted verbatim below. It names four deliverables: a DL segmentation model (PointNet++ or Sparse CNN given as examples), a variable-resolution grid engine (e.g. 5 cm within 10 m, 50 cm up to 100 m), a real-time colour-coded dashboard showing memory reduction against a uniform high-res 3D map, and FPS/accuracy-across-distance metrics. No evaluation rubric specific to the PS, YouTube link or dataset is given. **The idea submission deadline for this PS was extended to 5 Oct 2026 and had not closed on 3 Oct.**

### Cited Findings
- **Verbatim official text** (from sih.gov.in PS page, modal "ViewProblemStatement26053"; HTML entities decoded, bullet structure preserved) — [SIH 2026 Problem Statements](https://www.sih.gov.in/sih2026PS):

  > **Problem Statement ID:** 26053
  > **Problem Statement Title:** Adaptive Variable Resolution 2.5D Lidar Mapping for Dynamic Environment Perception
  > **Description:**
  > • Background:
  > Autonomous navigation depends on the ability of a vehicle to perceive its surroundings with high precision. While 3D Lidar point clouds provide rich spatial data, processing millions of points in real-time creates immense computational bottlenecks and memory latency. Conversely, standard 2D occupancy grids lose critical height information necessary for detecting curbs, potholes, or overhanging obstacles. To balance precision and performance, there is a need for a 'foveated' mapping approach—similar to human vision— where the immediate vicinity is rendered in high detail for safety, and distant areas are simplified to reduce the processing load.
  > • Description:
  > The goal is to build a deep learning pipeline that transforms raw Lidar point clouds into a variable resolution 2.5D grid (an elevation map with semantic layers). The system must perform three primary tasks:
  > 1. Terrain Analysis: Distinguish between drivable surfaces and non-drivable terrain.
  > 2. Object Detection: Identify and classify static obstacles (walls, poles) and dynamic objects (pedestrians, other vehicles).
  > 3. Adaptive Spatial Representation: Implement a non-uniform grid where the cell size increases as the distance from the sensor increases. This requires a sophisticated data structure that can handle variable resolution without causing alignment errors or data loss during the projection from 3D to 2.5D.
  > • Expected Solution:
  > A software framework consisting of:
  > • A Deep Learning Model: A network (e.g., PointNet++ or a Sparse Convolutional Neural Network) capable of semantic segmentation of point clouds into terrain, static obstacles, and moving objects.
  > • Variable Resolution Grid Engine: An algorithm that projects classified 3D points into a 2.5D grid where the resolution is high (e.g., 5cm cells) within a 10m radius and decreases (e.g., 50cm cells) up to a 100m radius.
  > • Real-time Visualization: A dashboard showing the 2.5D map with distinct color-coding for terrain and objects, demonstrating a significant reduction in memory usage compared to a uniform high-resolution 3D map.
  > • Performance Metrics: Evidence of low latency (high FPS) and high accuracy in object classification across varying distances.
  >
  > **Organization:** DRDO · **Department:** Department of Defence R&D · **Category:** Software · **Theme:** Smart Vehicles · **Youtube Link / Dataset Link:** (blank)

- The listing shows an idea counter of **202/500** and a deadline of **5 October 2026 (05-10-2026)** for SIH26053 (and for all listed PSs) on 3 Oct 2026 — [SIH 2026 Problem Statements](https://www.sih.gov.in/sih2026PS). A third-party mirror showed 200/500 slightly earlier — [zaidsayyed.in mirror](https://zaidsayyed.in/tools/sih-problem-statements/sih26053).
- Homepage banner: "Team Nomination & Idea Submission deadline extended to 05 Oct 2026." and "SPOCs and Team Leaders can edit/update Team Name, Consent, and PPT from 02–05 Oct 2026 (one-time only)." — [sih.gov.in](https://www.sih.gov.in/)
- The original deadline in the official guidelines was 30 Sep 2026: "The last date for team nomination and idea submission by College SPOC and Team leader on SIH portal is till 30th Sept 2026 only." — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf). This conflicts with the later homepage extension notice; the extension is newer and takes precedence.
- Secondary paraphrase (not official): some team READMEs add claims to the PS that are not in the official text, such as "At 50 m, consecutive laser rings land about 10.8 m apart… 99.87% of a uniform 5 cm grid cannot receive a return". This is Pragyaam's own analysis, and search engines sometimes present it as part of the PS — [Pragyaam README](https://github.com/Stxtics03/Pragyaam-SIH26053). sam-eer12 labels the organisation "DRDO — Department of Defence Production / iDEX" and saxenaatharv "DRDO / IDEX". The official listing says "Department of Defence R&D" — [sam-eer12/sih2026](https://github.com/sam-eer12/sih2026), [saxenaatharv/3D--2.5D-LIDAR](https://github.com/saxenaatharv/3D--2.5D-LIDAR).
- RakshaSetu's README gives its theme as "Transportation & Logistics", but the official theme is "Smart Vehicles" — [p3iyanshu/RakshaSetu](https://github.com/p3iyanshu/RakshaSetu).

### Inferences
- The "5 cm within 10 m, 50 cm at 100 m" values are written as examples ("e.g."). Schedules such as 5/10/20/40 cm or 80 cm far-field should therefore comply, but a team that departs from them should state the reason.
- The official baseline for memory comparison is "a uniform high-resolution 3D map", not a uniform 2.5D grid. Repos that report both (Pragyaam: 286× vs 3D, 21.5× vs 2.5D; pushpam: 210× vs 3D, 26× vs 2.5D) match this framing best.
- "Without causing alignment errors or data loss during the projection" is the PS's only explicit correctness requirement. It is why several teams publish boundary, seam or nesting tests.
- With 202/500 ideas already in and the deadline extended, the field for this PS is large. At 4–5 finalists per PS, roughly ≤2.5% of submitting teams reach the finale.

### Gaps
- The official page gives no PS-specific evaluation rubric, dataset, sensor, or hardware target such as Jetson. Any such requirement in competitor READMEs is the team's own assumption.
- It could not be confirmed whether the 202 count includes edits made during the 02–05 Oct window.

## Q2. SIH 2026 judging criteria, stage timeline, and idea-PPT requirements

### Takeaway
Official 2026 sources state the idea-screening criteria: novelty, complexity, clarity and detail, feasibility, practicability, sustainability, scale of impact, user experience, and future potential. They also give a 6-slide PDF idea template, selection of 4–5 teams per PS for the finale, and an offline Grand Finale at nodal centres "proposed" for December 2026. The current homepage gives no published 2026 dates for shortlisting or the finale (its timeline widget is stale from 2023–24). Grand-finale judging rubrics come only from secondary sources.

### Cited Findings
**Official (primary):**
- Process: SPOC registration from July 2026. Each institute runs an internal hackathon. The SPOC nominates up to 50 teams (45 shortlisted + 5 waitlisted) per institute, or 100 per university. Each team has 6 members including at least one woman, all from the same college. A team can submit ideas against at most 2 PSs. Each PS freezes at 500 ideas — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- Idea submission fields: team name, college authorization letter PDF, member names/genders/emails/mobiles, chosen PS, idea title, idea description, and "Idea presentation (PDF)" — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- **Idea selection criteria (verbatim):** "Post Idea submission process, the ideas will be evaluated by experts. Evaluation criteria will include novelty of the idea, complexity, clarity and details in the prescribed format, feasibility, practicability, sustainability, scale of impact, user experience and potential for future work progression." — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- Shortlisting: "4-5 teams per problem statement may be selected for the grand finale, but the final decision rests with the problem statement creating organization, which isn't obligated to declare a winner unless student proposals meet their expectations". Notification of selected teams is posted on the portal and sent by email. Selected teams must be available for meetings, sessions and trainings during a preparation phase — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- **Grand Finale (verbatim):** "SIH 2026 Grand Finale will be held offline at various nodal centers across pan India… The Grand Finale of Smart India Hackathon (SIH) 2026 is proposed to be organized in December 2026" — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- FAQ: "First stage i.e. idea screening is online. SIH Grand Finale would be conducted in an offline mode." — [SIH FAQs](https://www.sih.gov.in/faqs)
- Prize: one winning team per PS, Rs 1,50,000 per PS, paid only if the organization likes the idea; the PS creator decides ties. IP of the winning idea is split between the PS-giving organization and the team, or set by mutual agreement. Ideas "must be new and must not have been present in any previous event/program" — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- Finalists may bring up to 2 mentors (5+ years of experience). Travel is reimbursed up to Rs 3,000 per person — [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf)
- **Official idea PPT template** ([SIH2026-IDEA-Presentation-Format.pptx](https://www.sih.gov.in/letters/2026/SIH2026-IDEA-Presentation-Format.pptx)) has 6 content slides:
  1. Title page: PS ID, PS title, theme, PS category, team ID, team name.
  2. Idea title / proposed solution: detailed explanation, how it addresses the problem, innovation and uniqueness.
  3. Technical approach: technologies; methodology/process via flow charts, images or a working prototype.
  4. Feasibility and viability: feasibility analysis, challenges and risks, mitigation strategies.
  5. Impact and benefits: target audience; social, economic and environmental benefits.
  6. Research and references.

  Instructions (verbatim): "Kindly keep the maximum slides limit up to six (6). (Including the title slide)", "Try to avoid paragraphs and post your idea in points /diagrams / Infographics /pictures", "Idea should be unique and novel.", "You can only use provided template… without changing the idea details pointers", "save the file in PDF and upload… No PPT, Word Doc or any other format will be supported."
- The sih.gov.in homepage timeline widget still shows 2023–24 dates (e.g., "Grand Finale … 19th December 2024 – 22nd December 2024 (Tentative)"), so no current official dated 2026 timeline is published there — [sih.gov.in](https://www.sih.gov.in/)

**Secondary (non-official; treat with caution):**
- Aggregator timelines give: SIH 2026 launched 21 Aug 2026; PSs released 25 Aug 2026; internal hackathons in September; SPOC nomination by 30 Sep; expert scoring of ideas on "novelty, feasibility, impact and clarity" in Oct–Nov; 4–5 teams per PS to the finale; and a Nov/Dec 36-hour finale. One aggregator listed a "Final Idea Submission up to September 15, 2026", which conflicts with the official 30 Sep (then 5 Oct) deadline — [Reskilll blog](https://reskilll.com/blogs/smart-india-hackathon-2026-launched-timeline-registration-how-to-participate/), [thenewviews](https://thenewviews.com/smart-india-hackathon/), [FirstVidya](https://firstvidya.com/sih-2026-guide/)
- A DTU circular dated 28.08.2026 concerns the SIH 2026 internal hackathon. It was not opened; title only — [DTU PDF](https://www.dtu.ac.in/Web/upload/events/aug/file0807.pdf)
- Grand finale format described by past participants and blogs: 36 hours of live building at nodal centres, with 3 mentoring rounds (no marks) and 3 evaluation rounds (marks). Reported jury criteria are "Innovation, Invention, Technical Feasibility, Impact and Benefits, and Architecture", or alternatively "Innovation, Scalability, Feasibility, Impact, and Tech Implementation" — [whereuelevate](https://whereuelevate.com/blogs/smart-india-hackathon-2026), [hashnode "how we won SIH 24"](https://how-we-won-sih-24-and-survived-it.hashnode.dev/everything-about-winning-sih-2024), [zaidsayyed SIH 2026 playbook](https://zaidsayyed.in/blog/sih-2026)

### Inferences
- With the deadline moved to 5 Oct, results of idea evaluation and finalist announcements likely come later than aggregator timelines suggest. Past editions announced finalists 4–8 weeks after idea close. This is inferred from the pattern and is not an official date.
- The idea-stage criteria reward "complexity", "clarity and details in the prescribed format" and "user experience" as well as novelty and feasibility. A dashboard/UX screenshot and a clear architecture flowchart within the 6-slide limit are therefore directly scored items.

### Gaps
- No official SIH 2026 grand-finale scoring rubric, finale dates, nodal-centre list or finalist-announcement date was found. The homepage "Hackathon Timeline" section is stale.
- The SIH 2026 "SPOC-updated" guidelines PDF appeared textually identical in size and length to the main guidelines and was not diffed line by line.

## Q3. What each named competitor repository claims and has implemented

### Takeaway
Of the 8 named repos, 7 are reachable. `Stxtics03/vrgrid` returns 404 and was renamed or replaced by `Stxtics03/Pragyaam-SIH26053`. `kaushik521645/lidar-2.5D` and `lidar-2.5D-mapping` return 404; the live repo is `kaushik521645/lidar-2.5D-mapping-main`. The strongest by README depth and evidence are:
- Pragyaam/VRgrid: SemanticKITTI, FRNet, fixed 8.94 MB, ghost removal, planner regret, 338 commits.
- pushpam2404/sih_053: C++ engine, ROS 2/Nav2/FAST-LIO2, negative obstacles, but no trained DL model.
- LiFovea: simulator-only, PointNet++-lite at 0.827 mIoU, quadtree with alignment audit.
- sam-eer12 NEXA: polar ring-sector grid, deployed web app, CPU ONNX.

The others are thinner: kaushik (4 commits), saxenaatharv (RandLA-Net wrapper), RakshaSetu (team scaffold with ROS 2 nodes and a PointNet++ checkpoint claim).

### Cited Findings

#### 3.1 Stxtics03/Pragyaam-SIH26053 (formerly "vrgrid"; Team Chronicles.exe, team ID 178295)
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

#### 3.2 victorysingh/vrgrid-26 (fork of Stxtics03/Pragyaam-SIH26053)
- A GitHub fork (parent: Stxtics03/Pragyaam-SIH26053), created 2026-09-12. Last commit 2026-09-12 ("gpu-lane: the float audit, and the overflow bound measured not reasoned"); pushed 2026-09-23; 215 commits; 198 files, 0 C++/CUDA — [GitHub repo](https://github.com/victorysingh/vrgrid-26)
- This snapshot predates the Pragyaam rename and is more conservative. It says: "The mapping pipeline is a CPU reference implementation in numpy. There is no CUDA kernel in this repository, and every latency figure quoted here was measured single-threaded on an Intel i7-14650HX." It reports end-to-end latency of "89.18 ms p50 / 100.43 p99", "Zero allocation in the frame loop — 8.15 → 1.31 MB/frame, p99 74.7 → 49.4 ms", and "No model training is required" (labels come from SemanticKITTI ground-truth .label files). It gives the same 8.94 MB / 21.5× / 286× / 0 of 4,071 ghost figures, a coarsening ratio of "1.18–1.84 across rings 1–3", and a partition test over 10⁶ points. It admits: "No universal planner-regret curve yet… The current synthetic evaluation scene does not provide a sufficiently graded cost field" — [vrgrid-26 README](https://github.com/victorysingh/vrgrid-26)
- Inference: between 12 Sep and 28 Sep the team added FRNet (a real DL model) and a GPU (CuPy) path. Their latency claim fell from ~89 ms CPU to ~22 ms GPU. The fork exposes the earlier, GT-label-only state.

#### 3.3 pushpam2404/sih_053
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

#### 3.4 sam-eer12/sih2026 ("NEXA", Team KANVSS)
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

#### 3.5 kaushik521645/lidar-2.5D(-mapping) → actual: kaushik521645/lidar-2.5D-mapping-main ("FoveaMap")
- `kaushik521645/lidar-2.5D` and `kaushik521645/lidar-2.5D-mapping` both return 404. The user's repo list shows `lidar-2.5D-mapping-main`: last commit 2026-09-23 (message "new"), **4 commits**, 53 files (36 .py, 7 JS), no model weights committed — [GitHub user repos](https://github.com/kaushik521645?tab=repositories)
- Claims: "Extreme Memory Efficiency (85–90% Savings)" with a sparse 2.5D polar grid; multi-layer z_ground / z_obstacle_bottom / z_obstacle_top; "Kinematic Dynamic Foveation" (speed stretch, steering shear); RandLA-Net via Open3D-ML collapsed to 4 classes; constant-velocity Kalman tracker with ghost-trail erasure; FastAPI WebSocket to a deck.gl dashboard "at up to 30 FPS"; mIoU, distance-bucketed accuracy and latency utilities. It reports no measured mIoU, latency or MB, and admits that "lightweight AI checkpoints may overfit" — [kaushik README](https://github.com/kaushik521645/lidar-2.5D-mapping-main)

#### 3.6 akumar4be26-crypto/LiFovea
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

#### 3.7 p3iyanshu/RakshaSetu (Team JanSetu)
- Created 2026-08-31; last commit 2026-09-28; 69 commits; 213 files (55 .py, 28 JS). It includes a ROS 2 package `ros2_ws/src/rakshasetu` (nodes: lidar_ingest, preprocessing, segmentation, grid_engine, tracking, fusion, ego_odometry; plus a launch file), a vanilla-JS/WebGL dashboard, an admin console, and android-app and desktop-admin folders. No model weights are committed — [GitHub repo](https://github.com/p3iyanshu/RakshaSetu)
- The top-level README is a team-organization scaffold (6-member task briefs, mock data generator) with no metrics. It says the `security/` module "hasn't started yet" — [RakshaSetu README](https://github.com/p3iyanshu/RakshaSetu)
- Sub-READMEs:
  - The grid engine is a polar (range_bin, angular_bin) dict with "8 bands from 0 to 100m, 5cm cells out to 10m, growing to 50cm at 100m". It uses a fixed angular step per band to avoid alignment error and explicitly handles the atan2 ±180° **seam**. It uses RANSAC ground — [grid_engine/README.md](https://github.com/p3iyanshu/RakshaSetu/blob/main/grid_engine/README.md)
  - The models README cites a PointNet++ checkpoint trained on SemanticKITTI (~19K scans, 50 epochs) with "held-out validation mIoU (0.868)". It also reports per-frame mIoU of 0.558, and 0.32 → 0.62 on one real frame after downsampling to 8192 points — [models/README.md](https://github.com/p3iyanshu/RakshaSetu/blob/main/models/README.md)
  - There is DBSCAN + Kalman/SORT tracking with ego-motion compensation (tracking/ folder).

#### 3.8 saxenaatharv/3D--2.5D-LIDAR
- Created 2026-08-22; last commit 2026-09-20 ("Delete 000015.bin"); 49 commits; 25 files (13 .py) — [GitHub repo](https://github.com/saxenaatharv/3D--2.5D-LIDAR)
- What it is: a wrapper around the **pretrained Open3D-ML RandLA-Net SemanticKITTI checkpoint**, with fine-tuning on a 90/10 split. Components:
  - Ring grid "VaRLA" (0–10 m at 5 cm, 10–30 m at 20 cm, 30–60 m at 35 cm, 60–100 m at 50 cm).
  - OpenCV desktop dashboard, plus a FastAPI and HTML web app with a heuristic fallback.
  - `run_log.csv` (fps, active cells, memory saving, mIoU).
  - Evaluation module E1–E6: obstacle recall vs uniform 5 cm, height error, range-band breakdown, point spacing, ring-schedule ablation, size/time.
  - Unit test asserting "a point sitting exactly on a ring boundary is assigned to exactly one ring".
  - Jetson `tegrastats` instructions, with the note "I have not run this myself (no Jetson available here)".

  No numeric results are quoted in the README. No ROS 2, ghost/dynamic handling, or tracking — [saxenaatharv README](https://github.com/saxenaatharv/3D--2.5D-LIDAR)

#### 3.9 Other notable public SIH26053 repos (GitHub search for "SIH26053", "SIH 26053", "2.5D lidar variable resolution", "foveated lidar", "sih 2026 lidar" returned 40+ PS-26053 repos)
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

### Inferences
- Commit count and recency put Pragyaam (338 commits, 28 Sep) and NEXA (116) ahead in engineering effort among the named repos. pushpam has few commits (15) but dense, specific, self-critical documentation. kaushik (4 commits) looks like a single code drop.
- The Pragyaam README's "custom CUDA kernels" claim and its fork's "There is no CUDA kernel in this repository" (12 Sep) are not necessarily contradictory, since GPU work came later via CuPy. However, no .cu files exist, so an evaluator checking the repo may question it.
- Several teams pre-empt "inflated baseline" criticism by reporting an honest comparison (pushpam's uniform-20 cm, LiFovea's uniform-80 cm, Drishti's uniform 2.5D). Reporting only "X× vs 3D voxels" now looks weak by comparison.

### Gaps
- No README numbers were independently reproduced. Live demos (nexa-drdo.duckdns.org, foveamap-teal.vercel.app, Pragyaam YouTube) were not opened.
- NEXA's `docs/RESULTS.md` (latency/mIoU) and Pragyaam's `docs/eval-metric-specs.md` / planner-regret results were not fetched. Pragyaam's README lists planner regret as a metric but quotes no regret number; its fork says no regret curve exists yet.
- It was not verified whether pushpam's committed `minkunet18_*` weights are trained (the README says models are placeholders at 5.01% mIoU).
- Which repos correspond to teams that actually submitted ideas is unknown; repos are not linked to SIH submissions.

## Q4. Table stakes vs. rare capabilities across competitors

### Takeaway
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

### Cited Findings
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

### Inferences
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

### Gaps
- The matrix is built from READMEs only. "Y" means the team claims and describes a feature, not that it was confirmed to run.
- Most of the 40+ other PS-26053 repos were not assessed, so additional strong entrants may exist (e.g., Tonystankers, Prayash-in, Sarasbari/LocoLidar were active in late Sep/early Oct).
