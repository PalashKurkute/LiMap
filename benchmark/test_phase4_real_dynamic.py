"""Phase 4: Real Dynamic-Object Tracking and Anti-Ghosting Evaluation.

Evaluates Moving Object Segmentation (MOS), Kalman tracking, and FreeSpaceGhostEraser
on sequential real LiDAR scans from SemanticKITTI Sequence 08.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np

from core.ingestion.loader import load_kitti_bin, sanitize_point_cloud
from core.perception.segmentation_infer import SemanticSegmentationEngine
from core.tracking.mos_filter import MovingObjectSegmentationFilter
from core.tracking.kalman_tracker import DynamicObstacleTracker
from core.tracking.free_space_eraser import FreeSpaceGhostEraser
from core.grid.spatial_hash import SpatialHashGrid


def run_phase4_real_dynamic_evaluation(max_frames: int = 30):
    data_dir = Path("data/real/sequences/08/velodyne")
    bin_files = sorted(list(data_dir.glob("*.bin")))[:max_frames]

    if len(bin_files) < 2:
        print("[SKIP] Not enough sequential frames available for dynamic evaluation.")
        return

    print("=" * 60)
    print("  PHASE 4: REAL DYNAMIC OBJECT & MOS EVALUATION (Seq 08)")
    print("=" * 60)

    engine = SemanticSegmentationEngine()
    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=0.40)
    tracker = DynamicObstacleTracker(dt=0.1, min_hits_to_confirm=2)
    eraser = FreeSpaceGhostEraser(stride=16, clearance_tolerance_m=0.4)
    grid = SpatialHashGrid()

    total_dyn_points = 0
    total_static_points = 0
    confirmed_tracks_count = 0
    ghost_erased_count = 0

    # Ego vehicle nominal forward velocity delta ~ 0.8m per frame (8 m/s at 10 Hz)
    delta_pose = np.eye(4, dtype=np.float32)
    delta_pose[0, 3] = 0.8

    for idx, f_path in enumerate(bin_files):
        raw = load_kitti_bin(f_path)
        pts, _ = sanitize_point_cloud(raw)

        # 1. Semantic inference
        labels = engine.infer(pts)

        # 2. MOS separation
        static_pts, dyn_pts, is_dyn = mos.separate_dynamic_points(
            pts, semantic_labels=labels, delta_pose_from_last=delta_pose if idx > 0 else None
        )

        total_dyn_points += len(dyn_pts)
        total_static_points += len(static_pts)

        # 3. Dynamic Tracking
        active_tracks = tracker.update(dyn_pts)
        confirmed_tracks_count += len(active_tracks)

        # 4. Grid Accumulation + Anti-Ghosting on dynamic corridor
        grid.insert_points(static_pts, semantic_labels=labels[~is_dyn])
        
        erased = 0
        if len(active_tracks) > 0 and len(dyn_pts) > 0:
            # Cast rays along dynamic obstacle azimuths to carve vacated space
            erased = eraser.erase_ghost_trails(grid, dyn_pts[::64], max_ray_range_m=35.0)
            ghost_erased_count += erased

        if (idx + 1) % 5 == 0 or (idx + 1) == len(bin_files):
            dyn_pct = (len(dyn_pts) / max(len(pts), 1)) * 100.0
            print(f"  Frame [{idx + 1:2d}/{len(bin_files)}] | Static: {len(static_pts):6d} | Dyn: {len(dyn_pts):5d} ({dyn_pct:4.1f}%) | Tracks: {len(active_tracks)} | Ghost Erased: {erased}", flush=True)

    avg_dyn_pct = (total_dyn_points / max(total_dyn_points + total_static_points, 1)) * 100.0
    print("-" * 60)
    print(f"  Total Evaluated Frames:  {len(bin_files)}")
    print(f"  Total Static Points:     {total_static_points:,}")
    print(f"  Total Dynamic Points:    {total_dyn_points:,} (Mean: {avg_dyn_pct:.2f}%)")
    print(f"  Ghost Carved Cells:      {ghost_erased_count}")
    print(f"  Kalman Track Events:     {confirmed_tracks_count}")
    print("=" * 60)

    assert total_static_points > 100_000, "Expected > 100k static points across frames"
    print("\n[PASS] Phase 4 Real Dynamic Object & MOS Evaluation completed successfully.")

    # Task 4.3 Dedicated Viewpoint Robustness Assertion Check
    print("\nExecuting Dedicated Viewpoint Robustness Assertion Tests...")
    from benchmark.test_viewpoint_robustness import (
        test_static_parked_car_through_ego_turns,
        test_moving_object_correctly_detected_under_ego_turn,
    )
    test_static_parked_car_through_ego_turns()
    test_moving_object_correctly_detected_under_ego_turn()
    print("[PASS] Viewpoint Robustness Hard-Assertions Verified.")


if __name__ == "__main__":
    run_phase4_real_dynamic_evaluation(max_frames=25)
