import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from core.ingestion.loader import (
    compute_azimuth_timestamps,
    load_kitti_bin,
    load_kitti_label,
    sanitize_point_cloud,
)
from core.ingestion.transforms import (
    deskew_points_constant_velocity,
    make_se3_matrix,
    rodrigues_rotation,
    transform_points,
    verify_rep103_compliance,
)
from core.ingestion.odometry import LidarOdometryDeskewer
from core.grid.baselines import calculate_baselines


def test_loader_and_sanitizer():
    scene_a_bin = Path("data/synthetic/scene_a_bridge_underpass.bin")
    scene_a_label = Path("data/synthetic/scene_a_bridge_underpass.label")
    assert scene_a_bin.is_file(), "Scene A bin missing"
    assert scene_a_label.is_file(), "Scene A label missing"

    points = load_kitti_bin(scene_a_bin, use_mmap=False)
    assert points.ndim == 2 and points.shape[1] == 4, f"Shape: {points.shape}"

    sem_ids, inst_ids = load_kitti_label(scene_a_label, use_mmap=False)
    assert len(sem_ids) == len(points)

    sanitized_pts, sanitized_lbl = sanitize_point_cloud(
        points, min_range=0.5, max_range=100.0, labels=sem_ids
    )
    assert len(sanitized_pts) > 50000
    assert len(sanitized_pts) == len(sanitized_lbl)
    print(f"[PASS] Loader & Sanitizer: {len(sanitized_pts)} points sanitized.")


def test_transforms_and_rep103():
    assert verify_rep103_compliance(np.zeros((1, 3)))

    # Pure translation
    T = make_se3_matrix(np.eye(3), np.array([1.0, 2.0, 3.0]))
    pts = np.array([[0.0, 0.0, 0.0, 1.0]], dtype=np.float32)
    t_pts = transform_points(pts, T)
    assert np.allclose(t_pts[0, :3], [1.0, 2.0, 3.0])
    assert t_pts[0, 3] == 1.0

    # 90 deg Yaw rotation
    R_yaw = rodrigues_rotation(np.array([0.0, 0.0, 1.0]), np.pi / 2)
    T_rot = make_se3_matrix(R_yaw, np.zeros(3))
    p_fwd = np.array([[1.0, 0.0, 0.0, 0.5]], dtype=np.float32)
    t_rot_pts = transform_points(p_fwd, T_rot)
    # Rotating (1,0,0) by +90 deg around +Z yields (0, 1, 0)
    assert np.allclose(t_rot_pts[0, :3], [0.0, 1.0, 0.0], atol=1e-5)
    print("[PASS] Transforms & REP 103 verification.")


def test_odometry_tracking():
    # Load 2 consecutive frames from Scene C
    f0_bin = "data/synthetic/scene_c_moving_veh_frame_00.bin"
    f1_bin = "data/synthetic/scene_c_moving_veh_frame_01.bin"
    p0 = load_kitti_bin(f0_bin)
    p1 = load_kitti_bin(f1_bin)

    deskewer = LidarOdometryDeskewer(voxel_size=0.8, max_range=60.0)
    t0 = compute_azimuth_timestamps(p0)
    t1 = compute_azimuth_timestamps(p1)

    pts_deskewed_0, delta_0, pose_0 = deskewer.process_frame(p0, t0, dt=0.1)
    pts_deskewed_1, delta_1, pose_1 = deskewer.process_frame(p1, t1, dt=0.1)

    assert pts_deskewed_0.shape == p0.shape
    assert pts_deskewed_1.shape == p1.shape
    assert delta_0.shape == (4, 4)
    assert delta_1.shape == (4, 4)
    print(f"[PASS] Odometry tracking & deskewing verified.")


def test_baseline_memory_bounds():
    b = calculate_baselines()
    assert b.foveagrid_25d_mb < 3.5, f"Exceeded 3.5 MB bound: {b.foveagrid_25d_mb} MB"
    assert b.reduction_vs_3d > 800.0
    assert b.reduction_vs_uniform_25d > 30.0
    print(f"[PASS] Baseline Memory: {b.foveagrid_25d_mb} MB strictly < 3.5 MB.")


if __name__ == "__main__":
    test_loader_and_sanitizer()
    test_transforms_and_rep103()
    test_odometry_tracking()
    test_baseline_memory_bounds()
    print("ALL PHASE 1 TESTS PASSED.")
