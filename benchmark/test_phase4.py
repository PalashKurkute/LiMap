"""Comprehensive Tests for Phase 4 Dynamic Obstacle Tracking & Anti-Ghosting Pipeline."""

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from core.ingestion.loader import load_kitti_bin, load_kitti_label
from core.grid.spatial_hash import SpatialHashGrid
from core.tracking.mos_filter import MovingObjectSegmentationFilter
from core.tracking.kalman_tracker import DynamicObstacleTracker
from core.tracking.free_space_eraser import FreeSpaceGhostEraser


def test_mos_filter():
    f0_bin = "data/synthetic/scene_c_moving_veh_frame_00.bin"
    f0_lbl = "data/synthetic/scene_c_moving_veh_frame_00.label"

    pts = load_kitti_bin(f0_bin)
    sem, _ = load_kitti_label(f0_lbl)

    mos = MovingObjectSegmentationFilter()
    static_pts, dynamic_pts, is_dyn = mos.separate_dynamic_points(pts, semantic_labels=sem)

    assert len(dynamic_pts) > 100, f"Expected dynamic vehicle points, got {len(dynamic_pts)}"
    assert len(static_pts) > 50000, f"Expected static road points, got {len(static_pts)}"
    assert len(static_pts) + len(dynamic_pts) == len(pts)
    print(f"[PASS] MOS Filter: Separated {len(dynamic_pts)} dynamic points from {len(static_pts)} static points.")


def test_kalman_dynamic_tracker():
    tracker = DynamicObstacleTracker(dt=0.1, min_hits_to_confirm=2)
    mos = MovingObjectSegmentationFilter()

    # Process all 5 frames of Scene C (moving car traveling at 8.0 m/s along +X)
    confirmed_tracks = []
    for frame_idx in range(5):
        bin_path = f"data/synthetic/scene_c_moving_veh_frame_{frame_idx:02d}.bin"
        lbl_path = f"data/synthetic/scene_c_moving_veh_frame_{frame_idx:02d}.label"
        pts = load_kitti_bin(bin_path)
        sem, _ = load_kitti_label(lbl_path)

        _, dyn_pts, _ = mos.separate_dynamic_points(pts, semantic_labels=sem)
        active_tracks = tracker.update(dyn_pts)
        if active_tracks:
            confirmed_tracks = active_tracks

    assert len(confirmed_tracks) >= 1, "Expected at least 1 confirmed track for the moving vehicle"
    veh_track = confirmed_tracks[0]
    est_vx = veh_track.state[2]
    print(f"Tracked Vehicle: ID={veh_track.track_id}, Pos=({veh_track.state[0]:.2f}, {veh_track.state[1]:.2f}), Vx={est_vx:.2f} m/s (GT=8.0 m/s)")
    assert 6.0 <= est_vx <= 10.0, f"Estimated Vx {est_vx} outside realistic bound around 8.0 m/s"
    print(f"[PASS] Kalman Dynamic Tracker: Successfully tracked vehicle at {est_vx:.2f} m/s.")


def test_free_space_ghost_eraser():
    grid = SpatialHashGrid()
    eraser = FreeSpaceGhostEraser(stride=1, clearance_tolerance_m=0.5)

    # Artificially plant a ghost obstacle cell at (X=10.0, Y=1.8, Z=-0.5)
    # where the car was at frame 0
    ix = int(np.floor(10.0 / 0.10))
    iy = int(np.floor(1.8 / 0.10))
    slot = grid._hash_coords(ix, iy, ring_id=1)
    grid.cells[slot]["ix"] = ix
    grid.cells[slot]["iy"] = iy
    grid.cells[slot]["ring_id"] = 1
    grid.cells[slot]["occupied"] = 1
    grid.cells[slot]["count"] = 5
    grid.cells[slot]["mean_z"] = -0.5  # Ghost obstacle height
    grid.cells[slot]["min_z"] = -1.73
    grid.cells[slot]["max_z"] = -0.13
    grid.active_count += 1

    assert grid.cells[slot]["occupied"] == 1

    # Load frame 4 where vehicle has moved to X = 13.2m
    # Beams now pass through X = 10.0m to hit the road/vehicle ahead
    f4_bin = "data/synthetic/scene_c_moving_veh_frame_04.bin"
    f4_pts = load_kitti_bin(f4_bin)

    # Filter beams directed along the vacated corridor
    corridor_mask = (f4_pts[:, 0] > 10.2) & (f4_pts[:, 1] >= 0.0) & (f4_pts[:, 1] <= 4.0)
    erased = eraser.erase_ghost_trails(grid, f4_pts[corridor_mask], max_ray_range_m=30.0)
    print(f"Ghost Eraser: {erased} ghost cells erased by passing rays.")

    # The ghost cell at (ix, iy) should now be cleared / demoted back to nominal ground level
    assert grid.cells[slot]["max_z"] <= -1.70, "Ghost cell was not erased / demoted by passing rays"
    assert grid.cells[slot]["sem_id"] == 40, "Ghost cell semantic class not reset to Road"
    print("[PASS] Free-Space Ghost Eraser: Ghost trail successfully carved away.")


if __name__ == "__main__":
    test_mos_filter()
    test_kalman_dynamic_tracker()
    test_free_space_ghost_eraser()
    print("\nALL PHASE 4 TESTS PASSED.")
