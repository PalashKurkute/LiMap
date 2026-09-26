# FoveaGrid 2.5D — Master Task Tracker
**Source:** `Implementation_Plan_Fix_Audit_Findings.md` + `skeptical_judge_audit.md`  
**Submission deadline:** 30 September 2026  

---

## Doc Reorganization

| Action | File | Location |
|:---|:---|:---|
| ✅ Done | `SIH26053_Standards_To_Beat.md` | `docs/reference/` |
| ✅ Done | `PROBLEM_STATEMENT_CONTEXT.md` | `docs/reference/` |
| ✅ Done | `Competitive_Audit_And_Architecture_Comparison.md` | `docs/reference/` |
| ✅ Done | `skeptical_judge_audit.md` | `docs/reference/` |
| ✅ Done | `ROADMAP.md` (superseded) | `docs/archive/` |
| ✅ Done | `ARCHITECTURE.md` | root |
| ✅ Done | `docs/competitive_matrix.md` | `docs/` |
| ✅ Done | `benchmark/BENCHMARK_REPORT.md` | `benchmark/` |

---

## Phase 0 — Remove Fabrications

- [x] **0.1** Remove `min(regret, 1.2)` clamp — `benchmark/regret_benchmark.py:124`
- [x] **0.2** Delete hardcoded `0.0% regret` from `docs/competitive_matrix.md` — replace with value from BENCHMARK_REPORT
- [x] **0.3** Remove "ZERO FABRICATED METRICS" and "100% of SIH26053 benchmark criteria" from `benchmark/BENCHMARK_REPORT.md`
- [x] **0.4** Label `published_base_miou` / `96.5 - spd*0.42` in `benchmark/banded_metrics.py` as "published external baseline, not our measurement"
- [x] **0.5** Rewrite `ARCHITECTURE.md` — clarify C++ `FoveaCell` struct as target spec, clarify Jetson/TRT 18ms claim, clarify Nav2/ROS2 integration status, update milestones table
- [x] **0.6** Create `KNOWN_LIMITATIONS.md` in root — one honest paragraph per gap
- [x] **0.7** Create `data/synthetic/` output OR `scripts/generate_synthetic.py` runnable with no errors

**DoD:** Clone → run tests → zero `FileNotFoundError`. Every `.md` number is either script-generated, labeled external baseline, or declared missing in `KNOWN_LIMITATIONS.md`.

---

## Phase 1 — One Real Dataset End-to-End

- [x] **1.1** Download SemanticKITTI sequence 08 (976 frames downloaded and verified locally)
- [x] **1.2** Wire `core/ingestion/loader.py` to read real `.bin` + `.label` files
- [x] **1.3** Run full ingestion → grid insertion → costmap on real sequence; fix crashes (`scripts/run_seq08.py`)
- [x] **1.4** Regenerate `BENCHMARK_REPORT.md` — separate "Real-data (SemanticKITTI seq 08)" vs "Synthetic stress-test" sections (Section 10 updated)

**DoD:** One metric traceable to real public dataset (500 frames evaluated, 61,968,377 points, 3.26 MB heap < 3.5 MB DRDO bound, 0 crashes recorded in `data/real/seq08_run_results.json`).

---

## Phase 2 — Wire Existing Standalone Modules Into Live Pipeline

- [x] **2.1** Replace `max-min > 1.5` threshold in `_insert_batch()` with `DualElevationExtractor` call — `core/grid/spatial_hash.py` (L200)
- [ ] **2.2** Wire Chan's parallel-variance merge (`welford_fusion.py`) directly into `SpatialHashGrid` coarsening/query path (currently verified in `test_phase2_integration.py` but not called in grid engine)
- [ ] **2.3** Call `local_plane.py` PCA ground-fit during real cell insertion in `spatial_hash.py` (currently verified in `test_phase2_integration.py` but not in live hash insertion)
- [x] **2.4** Integration test: high-confidence path vs low-confidence-but-shorter → assert planner picks high-confidence (`benchmark/test_phase2_integration.py` / `regret_benchmark.py`)

**DoD:** Every "correct but never called" module from audit has a live call site in `core/grid/` + integration test.

---

## Phase 3 — Replace Fake Segmentation With Real Pretrained Model

- [ ] **3.1** Integrate pretrained RandLA-Net weights from Open3D-ML (SemanticKITTI pretrained)
- [ ] **3.2** Export/convert to ONNX to feed existing dead ONNX path in `segmentation_infer.py`
- [ ] **3.3** Run on Phase 1 real sequence; report real mIoU by distance band
- [x] **3.4** Delete geometric-heuristic mIoU headline claim / relabel as "fallback mode (no model available)" in `KNOWN_LIMITATIONS.md` and `banded_metrics.py`

**DoD:** Judge asking "mIoU on SemanticKITTI val by distance band?" gets a real number with provenance stated (currently disclosed as limitation in `KNOWN_LIMITATIONS.md`).

---

## Phase 4 — Real Dynamic-Object Evaluation

- [x] **4.1** Fix `scripts/run_seq08.py` MOS integration: pass odometry `delta_pose_from_last` into `separate_dynamic_points()` (1,009,962 dynamic points separated, 41.8% dynamic ratio)
- [x] **4.2** Report real sequence ghost-trail count and dynamic tracking in `BENCHMARK_REPORT.md` (1,899 ghost cells carved, 9,335 track events recorded)
- [ ] **4.3** Ego-turn viewpoint robustness check on real turning sequence (confirm parked cars not misflagged during turn)

**DoD:** Standards 3.1–3.3 backed by real sequence dynamic metrics in the main pipeline.

---

## Phase 5 — Fix Planner Regret Metric

- [x] **5.1** Replace `cost_ideal_3d = float(dist_direct)` straight-line with kinematically planned 3D path — `benchmark/regret_benchmark.py`
- [ ] **5.2** Re-run regret on real-data SemanticKITTI scene (currently evaluated only on synthetic underpass/pothole scenes)
- [x] **5.3** Add Fréchet distance alongside cost-based regret (`benchmark/regret_benchmark.py`)

**DoD:** "Ideal" baseline is a planned path, not a ruler. Number is unclamped (`benchmark/regret_benchmark.py`).

---

## Phase 6 — Stretch Goals (only after 0–5 solid)

- [x] **6.1** Minimal Nav2 integration: ROS 2 package publishing costmap as `nav_msgs/OccupancyGrid` (`ros2_ws/src/foveagrid_nav2`, `core/planning/nav2_bridge.py`, `benchmark/test_nav2_bridge.py`)
- [ ] **6.2** One real embedded-hardware run (RPi 4/5 or Jetson Nano) with real latency + memory numbers
- [x] **6.3** Dashboard: remove hardcoded footer strings (`13.4ms`, `0.00%`), wire to live benchmark report (`RegretPanel.tsx` & `App.tsx` updated)

---

## Phase 7 — Final Submission Pass (half-day, same day as submission)

- [ ] **7.1** Regenerate all reports fresh from clean clone
- [ ] **7.2** Re-read `KNOWN_LIMITATIONS.md` as a team — everyone states unprompted what is/isn't real
- [ ] **7.3** Cross-check every number in every `.md` against the script that generated it

---

## Priority Order If Time Runs Out

```
Phase 0  ←  always, no exceptions
Phase 1  ←  biggest single credibility shift
Phase 2  ←  cheapest real capability gains (code exists, just unwired)
Phase 3  ←  fixes single named weakest claim
Phases 4–6  ←  as time allows
Phase 7  ←  always, no exceptions (same day as submission)
```
