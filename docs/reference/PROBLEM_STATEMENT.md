# SIH26053: problem statement and context

Source: [sih.gov.in/sih2026PS](https://www.sih.gov.in/sih2026PS), fetched 2026-10-03; process facts are date-stamped, re-check them. CALCULATED = arithmetic, MEASURED = `benchmark/*.json`, "(dossier)" = earlier team dossier, not re-checked.

## 1. Official text (verbatim)

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

Reading notes:
- 5 cm / 10 m and 50 cm / 100 m are "e.g." examples. LiMap uses 5/10/25/50 cm to 10/25/50/100 m.
- The memory baseline named is "a uniform high-resolution 3D map", not a uniform 2.5D grid; rivals report both.
- The only explicit correctness clause: "without causing alignment errors or data loss during the projection from 3D to 2.5D".
- The page gives no rubric, dataset, sensor, hardware target or numeric threshold. Anything presented as a DRDO threshold is invented.
- Rival READMEs add claims the PS does not make (Pragyaam's "99.87% of a uniform 5 cm grid cannot receive a return" is its own analysis) and mislabel it (sam-eer12: "Department of Defence Production / iDEX"; RakshaSetu: theme "Transportation & Logistics"; official: Department of Defence R&D, Smart Vehicles).

## 2. SIH 2026 process (as of 2026-10-03)

Sources: [SIH 2026 Guidelines PDF](https://www.sih.gov.in/letters/2026/SIH%202026%20Guidelines.pdf), [idea PPT template](https://www.sih.gov.in/letters/2026/SIH2026-IDEA-Presentation-Format.pptx), [sih.gov.in](https://www.sih.gov.in/), [FAQs](https://www.sih.gov.in/faqs).
- **Counter and deadline.** SIH26053 showed **202/500** ideas on 2026-10-03 (a [third-party mirror](https://zaidsayyed.in/tools/sih-problem-statements/sih26053) showed 200/500 earlier). Deadline **05-10-2026**: the guidelines said 30 Sep; the homepage banner extended it ("Team Nomination & Idea Submission deadline extended to 05 Oct 2026."). SPOCs and leaders can edit team name, consent and PPT 02-05 Oct 2026, once. Unknown if 202 includes those edits.
- **Teams.** 6 members, at least one woman, same college; at most 2 PSs per team; each PS freezes at 500 ideas; a SPOC nominates up to 50 teams per institute (45 + 5 waitlisted) or 100 per university.
- **Idea criteria (verbatim).** "Post Idea submission process, the ideas will be evaluated by experts. Evaluation criteria will include novelty of the idea, complexity, clarity and details in the prescribed format, feasibility, practicability, sustainability, scale of impact, user experience and potential for future work progression."
- **Shortlist.** "4-5 teams per problem statement may be selected for the grand finale, but the final decision rests with the problem statement creating organization, which isn't obligated to declare a winner unless student proposals meet their expectations." Idea screening is online.
- **Finale.** Offline at nodal centres, "proposed to be organized in December 2026". No official 2026 dates or rubric are published (homepage timeline still shows 2023-24). Secondary sources ([whereuelevate](https://whereuelevate.com/blogs/smart-india-hackathon-2026), [zaidsayyed playbook](https://zaidsayyed.in/blog/sih-2026)): 36-hour build, 3 mentoring and 3 scoring rounds, jury criteria "Innovation, Invention, Technical Feasibility, Impact and Benefits, and Architecture".
- **Prize and IP.** One winner per PS, Rs 1,50,000, paid only if the organization likes the idea; IP split between the organization and the team or set by agreement; ideas "must be new and must not have been present in any previous event/program". Up to 2 mentors (5+ years); travel up to Rs 3,000 per person.
- **Idea PPT.** 6 slides including the title, PDF only: title page, idea / proposed solution, technical approach, feasibility and viability, impact and benefits, research and references. Instructions: "Avoid paragraphs", "Idea should be unique and novel.", "No PPT, Word Doc or any other format will be supported."
- **Inferences (not official).** At 4-5 finalists per PS, about 2.5% or fewer of submissions reach the finale; past editions named finalists 4-8 weeks after idea close; a dashboard screenshot and a flowchart inside 6 slides are scored items (clarity, user experience).

## 3. Operational context

- **Users.** DRDO ground-autonomy labs: CAIR (Bengaluru), CVRDE (Chennai; MUNTRA BMP-class UGVs), R&DE(E) (Pune), VRDE (Ahmednagar). Their public UGV pages list capability areas (AI perception, field SLAM, swarms) with no performance figures ([foresight: UGV](https://drdo.gov.in/drdo/en/offerings/technology-foresight/ugv)). Settings: Ladakh and desert terrain with GNSS jamming, counter-IED work, low-power boards (Jetson Orin class). A "15-30 FPS at 30-60 W" target is a team assumption, not in the PS.
- **Indian roads (dossier, MoRTH "Road Accidents in India", 2022).** 1,68,491 deaths in a year (about 461 a day); potholes and vertical anomalies: 4,446 accidents, 1,856 deaths. Unstructured traffic (two-wheelers, autorickshaws, cattle) argues for fine cells on thin objects and negative obstacles at any range.

## 4. Sensor physics and the memory problem

| Sensor | Beams | Points/s (dossier) | Range | Rate | Frame (CALCULATED, 16 B XYZI) |
|---|---|---|---|---|---|
| Velodyne HDL-64E | 64 | 1.3-2.2 M | 120 m | 10 Hz | about 2.1 MB (130k points) |
| Ouster OS1-128 | 128 | 2.6-5.2 M | 120 m | 10-20 Hz | about 2.1-4.2 MB |
| Livox Mid-360 | non-repetitive | 200,000 | 40 m | 10 Hz | about 0.32 MB (20k points) |

The earlier dossier gave 20-35 MB, 40-80 MB and 3.2 MB per frame, which do not follow from the point rates. KITTI scans in [`edge_hardware_profile.json`](../../benchmark/edge_hardware_profile.json) hold about 123k points.

**Memory, CALCULATED.** Rings: 0-10 m at 5 cm, 10-25 m at 10 cm, 25-50 m at 25 cm, 50-100 m at 50 cm.
- Full coverage of the ring schedule: 125.7k + 164.9k + 94.2k + 94.2k = 479k cells. A uniform 5 cm disk of 100 m radius is 12.57 M cells, so about **26x fewer cells**.
- Pool actually allocated: 106,875 cells x 32 B = **3.2616 MB**, about 22% of the full-coverage count. It relies on sparsity; nobody has shown it never overflows (see KNOWN_LIMITATIONS).
- Capacity ratios: dense 3D 3,051.8 MB (100 m x 100 m x 10 m at 5 cm, 4 B/voxel) over 3.2616 MB = **935.7x**; uniform 5 cm 2.5D 122.07 MB (2000 x 2000 x 32 B) over 3.2616 MB = **37.4x**. Both are capacity ratios against a calculated array, not a deployed map.
- MEASURED: mean 57,524 occupied cells (pool) vs 80,868.9 (uniform 5 cm) over 20 real frames = **1.41x** ([`fidelity_study_results.json`](../../benchmark/fidelity_study_results.json)). Lead with 26x and 1.41x: nobody deploys a dense 3 GB array (`docs/research/mapping_baselines_sota.md` Q2).

**Beam spacing.** A 64-beam spinner has about 0.4 degrees between beams. At 1.73 m sensor height, adjacent rings on flat ground at 50 m land roughly 8 to 13 m apart (CALCULATED; Pragyaam's README says 10.8 m). At 0.2 degrees, returns are 34.9 cm apart at 100 m (CALCULATED). "99.2% of uniform 5 cm cells beyond 40 m get no return" is a dossier figure, not re-derived. Far-field density is set by the sensor, not by foveation.

## 5. Datasets

| Dataset | Content | Licence | Use in LiMap |
|---|---|---|---|
| SemanticKITTI | 22 sequences, about 43,000 scans, 64-beam; 28 classes (19 evaluated); sequences 00-10 labelled, 11-21 hidden test | CC BY-NC-SA 4.0 | Sequence 08 only: 100 frames (segmentation), 50 (moving objects), 5 (regret) |
| RELLIS-3D | 13,556 scans (Ouster OS1-64, Velodyne 32-ch), 20 off-road classes. Official: SalsaNext 40.20% mIoU, KPConv 18.64%. A 2024 study: Cylinder3D 46.07, SalsaNext 43.07 | CC BY-NC-SA 3.0 | Not used |
| IDD-3D (IIIT Hyderabad) | About 12k LiDAR frames, 5+ h, about 223k boxes, 17 classes (autorickshaw, cattle); boxes only, no per-point labels | Website CC BY-SA 4.0 | Not used |
| GOOSE | Point-wise off-road labels, 64 classes | CC BY-SA 4.0 (commercial use allowed) | Not used |
| SemanticPOSS, KITTI-360 (dossier) | 6 sequences, about 2,988 frames of dense dynamic objects; long multi-sensor trajectories | not checked | Not used |

See `docs/research/deployment_datasets_robustness.md` Q3 and `perception_mos_benchmarks.md` Q6. Real data used: one SemanticKITTI sequence on the team's machine (frames 108-129 missing); the repo holds a 5,000-point sample. Indian and off-road classes are not learned.
