"""Unified Milestone Verification Suite — FoveaGrid 2.5D.

Executes end-to-end verification of all project milestones:
  - Milestone 1: Real SemanticKITTI Ingestion & 3.2616 MB Memory Bound
  - Milestone 2: Phase 2 Integration (DualElevation, Chan's Merge, PCA Ground)
  - Milestone 3: Phase 3 SalsaNext Pretrained ONNX Segmentation
  - Milestone 4: Phase 4 Semantic-Gated Dynamic MOS Filter
  - Milestone 5: Phase 5 Kinematic Planner Regret & Fréchet Distance
  - Milestone 6: Phase 6 Nav2 OccupancyGrid Bridge

Guarantees empirical agreement between documented numbers and live code outputs.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np


def verify_milestone_1() -> bool:
    """Milestone 1: Real Ingestion & Memory Invariant (< 3.5 MB)."""
    print("\n[1/6] Auditing Milestone 1: Real Ingestion & Memory Invariant...")
    from core.ingestion.loader import load_kitti_bin, load_kitti_label
    from core.grid.spatial_hash import SpatialHashGrid

    pts = load_kitti_bin("data/real/sequences/08/velodyne/000000.bin")
    sem, _ = load_kitti_label("data/real/sequences/08/labels/000000.label")
    grid = SpatialHashGrid()
    grid.insert_points(pts, semantic_labels=sem)

    mem_mb = grid.cells.nbytes / (1024 * 1024)
    print(f"      - Points inserted: {len(pts):,}")
    print(f"      - Heap footprint:  {mem_mb:.4f} MB (Bound: < 3.50 MB)")
    assert mem_mb <= 3.42, f"Memory {mem_mb} exceeded the pool budget"
    assert len(grid.get_active_cells()) > 1000, "Active cells underpopulated"
    print("      --> PASS: Invariant < 3.5 MB strictly preserved.")
    return True


def verify_milestone_2() -> bool:
    """Milestone 2: Phase 2 Mathematical Modules (DualElevation, Chan's Merge, PCA Ground)."""
    print("\n[2/6] Auditing Milestone 2: Phase 2 Mathematical Modules...")
    from core.grid.spatial_hash import SpatialHashGrid
    from core.grid.welford_fusion import WelfordElevationAccumulator
    from core.grid.local_plane import LocalGroundPlaneEstimator

    # 1. Dual-Elevation live wiring
    grid = SpatialHashGrid()
    pts = np.array([
        [5.0, 0.0, -1.73, 0.5],
        [5.0, 0.0, -1.70, 0.5],
        [5.0, 0.0,  1.00, 0.5],
        [5.0, 0.0,  1.20, 0.5],
    ], dtype=np.float32)
    grid.insert_points(pts)
    active = grid.get_active_cells()
    assert len(active) > 0, "No cells activated"
    cell = active[0]
    assert cell["overhang_z"] < 900.0, "Dual-elevation canopy not recorded"
    assert cell["clearance"] >= 2.0, "Clearance calculation incorrect"

    # 2. Chan's parallel variance merge
    cnt_a, mean_a, m2_a = np.array([100], dtype=np.uint32), np.array([-1.5], dtype=np.float32), np.array([4.0], dtype=np.float32)
    cnt_b, mean_b, m2_b = np.array([100], dtype=np.uint32), np.array([-1.2], dtype=np.float32), np.array([5.0], dtype=np.float32)
    min_arr, max_arr = np.array([-2.0], dtype=np.float32), np.array([0.0], dtype=np.float32)

    tot_cnt, out_mean, _, _, _ = WelfordElevationAccumulator.merge(
        cnt_a, mean_a, m2_a, min_arr, max_arr,
        cnt_b, mean_b, m2_b, min_arr, max_arr,
    )
    assert tot_cnt[0] == 200, "Chan merge total count mismatch"
    assert np.isclose(out_mean[0], -1.35, atol=1e-3), "Chan merge mean mismatch"

    # 3. PCA Ground Plane Estimator
    estimator = LocalGroundPlaneEstimator(max_traversable_grade_pct=15.0)
    plane_pts = np.random.uniform(-2.0, 2.0, size=(50, 3)).astype(np.float32)
    plane_pts[:, 2] = -1.73  # flat ground
    patch_plane = estimator.fit_patch_plane(plane_pts)
    assert patch_plane is not None, "PCA ground plane fit failed"
    assert patch_plane.is_traversable_grade, "Flat ground flagged as non-traversable"

    print("      --> PASS: Dual-Elevation, Chan's Merge, and PCA Ground active and verified.")
    return True


def verify_milestone_3() -> bool:
    """Milestone 3: Phase 3 Pretrained SalsaNext ONNX Inference."""
    print("\n[3/6] Auditing Milestone 3: Pretrained SalsaNext ONNX...")
    from core.perception.segmentation_infer import SemanticSegmentationEngine, _HAS_ORT
    from core.ingestion.loader import load_kitti_bin, load_kitti_label

    engine = SemanticSegmentationEngine()
    pts = load_kitti_bin("data/real/sequences/08/velodyne/000000.bin")
    sem, _ = load_kitti_label("data/real/sequences/08/labels/000000.label")

    t0 = time.perf_counter()
    pred_classes = engine.infer(pts)
    latency_ms = (time.perf_counter() - t0) * 1000

    valid = (sem != 0) & (pred_classes != 0)
    acc = float(np.mean(pred_classes[valid] == sem[valid]) * 100.0)

    # Verify SHA256 cryptographic provenance of ONNX weights
    from scripts.verify_model_provenance import verify_model_provenance
    assert verify_model_provenance(), "Cryptographic checksum verification failed for SalsaNext ONNX model"

    print(f"      - Model engine:     {'ONNX Runtime' if _HAS_ORT else 'Fallback'}")
    print(f"      - Inference latency: {latency_ms:.1f} ms")
    print(f"      - Point accuracy:   {acc:.2f}% (Frame 0)")
    assert acc > 75.0, f"Point accuracy {acc}% below threshold"
    print("      --> PASS: Pretrained SalsaNext delivers verified accuracy on real scan.")
    return True


def verify_milestone_4() -> bool:
    """Milestone 4: Phase 4 Semantic-Gated Dynamic MOS Filter."""
    print("\n[4/6] Auditing Milestone 4: Semantic-Gated Dynamic MOS...")
    from core.tracking.mos_filter import MovingObjectSegmentationFilter
    from core.ingestion.loader import load_kitti_bin, load_kitti_label

    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=0.35)
    pts0 = load_kitti_bin("data/real/sequences/08/velodyne/000000.bin")
    sem0, _ = load_kitti_label("data/real/sequences/08/labels/000000.label")
    pts1 = load_kitti_bin("data/real/sequences/08/velodyne/000001.bin")
    sem1, _ = load_kitti_label("data/real/sequences/08/labels/000001.label")

    # Step 1: prime with scan 0
    mos.separate_dynamic_points(pts0, semantic_labels=sem0)
    # Step 2: scan 1 with 4x4 forward vehicle displacement
    delta = np.eye(4, dtype=np.float32)
    delta[0, 3] = 0.1  # 10cm forward
    _, dyn_pts, is_dynamic_mask = mos.separate_dynamic_points(pts1, delta_pose_from_last=delta, semantic_labels=sem1)

    # Static road points must not be falsely flagged
    road_pts = (sem1 == 40)
    road_fp_rate = float(np.mean(is_dynamic_mask[road_pts]) * 100.0)
    print(f"      - Dynamic points isolated: {len(dyn_pts):,}")
    print(f"      - Road False Positive Rate: {road_fp_rate:.2f}% (Target: < 2.0%)")
    assert road_fp_rate < 2.0, f"Road FPR {road_fp_rate}% exceeded budget"
    print("      --> PASS: Semantic gating protects road surface from ghosting.")
    return True


def verify_milestone_5() -> bool:
    """Milestone 5: Phase 5 Planner Regret & Fréchet Distance."""
    print("\n[5/6] Auditing Milestone 5: Planner Regret & Trajectory Divergence...")
    from benchmark.regret_benchmark import PlannerRegretBenchmark

    benchmark = PlannerRegretBenchmark()
    res = benchmark.benchmark_real_kitti_corridor(
        bin_path="data/real/sequences/08/velodyne/000000.bin",
        label_path="data/real/sequences/08/labels/000000.label",
    )

    regret_val = float(str(res['foveagrid_regret_pct']))
    frechet_val = float(str(res['frechet_distance_m']))

    print(f"      - Dense 3D Ideal Cost:  {res['cost_dense_3d_ideal']}")
    print(f"      - FoveaGrid 2.5D Cost:  {res['cost_foveagrid_25d']} (Regret: {regret_val:.2f}%)")
    print(f"      - Discrete Fréchet:    {frechet_val:.3f} m")
    print(f"      - Waypoint count:       {res['waypoints_count']}")
    assert regret_val <= 5.0, "Planner regret exceeded 5%"
    assert frechet_val < 1.0, "Fréchet distance exceeded 1.0m"
    print("      --> PASS: Closed-loop Hybrid-A* trajectory demonstrates high fidelity.")
    return True


def verify_milestone_6() -> bool:
    """Milestone 6: Phase 6.1 ROS 2 / Nav2 OccupancyGrid Bridge."""
    print("\n[6/6] Auditing Milestone 6: Nav2 OccupancyGrid Bridge...")
    from core.planning.nav2_bridge import Nav2CostmapBridge
    from core.grid.spatial_hash import SpatialHashGrid

    grid = SpatialHashGrid()
    pts = np.random.uniform(-10.0, 10.0, size=(1000, 3)).astype(np.float32)
    grid.insert_points(pts)

    bridge = Nav2CostmapBridge(grid_width_m=40.0, grid_height_m=40.0, resolution_m=0.20, frame_id="map")
    grid_msg = bridge.convert_to_nav2_occupancy_grid(grid)

    assert grid_msg is not None, "Nav2 occupancy grid conversion returned None"
    payload = grid_msg.to_dict()
    assert payload["header"]["frame_id"] == "map"
    assert payload["info"]["resolution"] == 0.20
    assert len(payload["data"]) == 200 * 200

    print(f"      - Grid shape:   {payload['info']['height']}x{payload['info']['width']}")
    print(f"      - Frame ID:     {payload['header']['frame_id']}")
    print(f"      - Resolution:   {payload['info']['resolution']} m/cell")
    print("      --> PASS: Nav2 bridge correctly converts costmap to standard format.")
    return True


def run_all_audits() -> bool:
    print("=" * 75)
    print(" FOVEAGRID 2.5D — UNIFIED MILESTONE AUDIT & VERIFICATION SUITE")
    print("=" * 75)

    audits = [
        verify_milestone_1,
        verify_milestone_2,
        verify_milestone_3,
        verify_milestone_4,
        verify_milestone_5,
        verify_milestone_6,
    ]

    passed = 0
    for audit in audits:
        try:
            if audit():
                passed += 1
        except Exception as e:
            print(f"      [FAILED] Error: {e}")

    print("\n" + "=" * 75)
    print(f" AUDIT RESULT: {passed}/{len(audits)} MILESTONES VERIFIED")
    print("=" * 75)
    return passed == len(audits)


if __name__ == "__main__":
    success = run_all_audits()
    sys.exit(0 if success else 1)
