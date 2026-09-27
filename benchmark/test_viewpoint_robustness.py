"""Test Viewpoint Robustness of Moving Object Segmentation (MOS).

Verifies SIH26053 Standard 3.2 and Task 4.3:
Guarantees that a known static object (e.g. parked vehicle surface) tracked through an
ego-vehicle turn sequence is NEVER falsely flagged as dynamic, and confirms that
truly moving objects are correctly detected.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np

from core.ingestion.transforms import transform_points
from core.perception.segmentation_infer import CLASS_CAR, CLASS_ROAD
from core.tracking.mos_filter import MovingObjectSegmentationFilter


def make_se3(x: float, y: float, z: float, yaw_rad: float) -> np.ndarray:
    """Creates a 4x4 SE(3) transformation matrix (planar yaw + translation)."""
    c = float(np.cos(yaw_rad))
    s = float(np.sin(yaw_rad))
    T = np.eye(4, dtype=np.float32)
    T[0, 0] = c
    T[0, 1] = -s
    T[1, 0] = s
    T[1, 1] = c
    T[0, 3] = x
    T[1, 3] = y
    T[2, 3] = z
    return T


def generate_parked_car_surface(center_x: float = 8.0, center_y: float = 3.0) -> np.ndarray:
    """Generates sensor-facing exterior surface points for a static parked vehicle.
    
    LiDAR physically scans only line-of-sight surfaces (not interior volumetric fills).
    """
    # Facing front/side profile
    ys = np.linspace(center_y - 1.2, center_y + 1.2, 30)
    zs = np.linspace(-1.2, 0.4, 20)
    Y, Z = np.meshgrid(ys, zs)
    Y = Y.ravel()
    Z = Z.ravel()
    # Curved vehicle profile
    X = center_x + 0.15 * ((Y - center_y) ** 2)
    intensities = np.full_like(X, 0.5)
    return np.column_stack([X, Y, Z, intensities]).astype(np.float32)


def generate_road_surface(num_points: int = 1500) -> np.ndarray:
    """Generates a ground plane surface."""
    xs = np.linspace(2.0, 20.0, 50)
    ys = np.linspace(-6.0, 6.0, 30)
    X, Y = np.meshgrid(xs, ys)
    X = X.ravel()
    Y = Y.ravel()
    Z = np.full_like(X, -1.70)
    intensities = np.full_like(X, 0.2)
    return np.column_stack([X, Y, Z, intensities]).astype(np.float32)


def test_static_parked_car_through_ego_turns():
    """Asserts that a known parked car is NEVER flagged dynamic during ego turns."""
    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=0.35)

    # World reference geometry
    parked_car_world = generate_parked_car_surface(center_x=8.0, center_y=3.0)
    road_world = generate_road_surface()
    world_pts = np.vstack([parked_car_world, road_world])

    car_mask = np.zeros(len(world_pts), dtype=bool)
    car_mask[:len(parked_car_world)] = True

    labels = np.full(len(world_pts), CLASS_ROAD, dtype=np.uint32)
    labels[car_mask] = CLASS_CAR

    # Sequence of ego poses [x, y, z, yaw_rad] representing turns
    ego_trajectory = [
        (0.0, 0.0, 0.0, 0.0),                          # Frame 0: origin
        (0.8, 0.05, 0.0, np.deg2rad(4.0)),             # Frame 1: forward + 4 deg turn
        (1.6, 0.18, 0.0, np.deg2rad(9.0)),             # Frame 2: forward + 9 deg turn
        (2.3, 0.40, 0.0, np.deg2rad(15.0)),            # Frame 3: sharp 15 deg turn
        (2.9, 0.70, 0.0, np.deg2rad(22.0)),            # Frame 4: acute 22 deg turn
    ]

    last_pose = None

    for frame_idx, (ex, ey, ez, eyaw) in enumerate(ego_trajectory):
        curr_pose = make_se3(ex, ey, ez, eyaw)

        if last_pose is None:
            delta_pose = None
        else:
            # Transform from previous sensor frame to current sensor frame
            delta_pose = np.linalg.inv(curr_pose) @ last_pose

        # Transform world points into current sensor frame
        curr_sensor_pts = transform_points(world_pts, np.linalg.inv(curr_pose))

        static_pts, dyn_pts, is_dynamic = mos.separate_dynamic_points(
            curr_sensor_pts,
            semantic_labels=labels,
            delta_pose_from_last=delta_pose,
        )

        last_pose = curr_pose

        if frame_idx > 0:
            car_dynamic_count = int(np.sum(is_dynamic[car_mask]))
            total_car_pts = int(np.sum(car_mask))
            car_fp_rate = (car_dynamic_count / total_car_pts) * 100.0

            # Strict Assertion: 0 false positive dynamic detections on static car
            assert car_dynamic_count == 0, (
                f"Frame {frame_idx}: Viewpoint robustness failure! "
                f"{car_dynamic_count}/{total_car_pts} static car points flagged dynamic "
                f"(FPR={car_fp_rate:.2f}%) during ego turn."
            )

            # Strict Assertion: Overall false positive dynamic rate on ground + car is 0
            overall_dynamic = int(np.sum(is_dynamic))
            assert overall_dynamic == 0, (
                f"Frame {frame_idx}: Unexpected dynamic points ({overall_dynamic}) detected in static scene."
            )

    print("[PASS] Viewpoint Robustness: Static parked car perfectly preserved across ego turns.")


def test_moving_object_correctly_detected_under_ego_turn():
    """Asserts that while static objects stay static, an actual moving object IS detected during turn."""
    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=0.35)

    # Frame 0: Ego at origin, static car at (8, 3.0), moving car at (12, -2)
    static_car_0 = generate_parked_car_surface(center_x=8.0, center_y=3.0)
    moving_car_0 = generate_parked_car_surface(center_x=12.0, center_y=-2.0)
    world_0 = np.vstack([static_car_0, moving_car_0])
    labels_0 = np.full(len(world_0), CLASS_CAR, dtype=np.uint32)

    # Prime MOS with frame 0
    mos.separate_dynamic_points(world_0, semantic_labels=labels_0, delta_pose_from_last=None)

    # Frame 1: Ego executes turn (dx=1.0m, dy=0.1m, yaw=8.0 deg)
    ego_pose_1 = make_se3(1.0, 0.1, 0.0, np.deg2rad(8.0))
    ego_pose_0 = np.eye(4, dtype=np.float32)
    delta_pose = np.linalg.inv(ego_pose_1) @ ego_pose_0

    # Static car stays at (8, 3.0); moving car moves forward by +1.5m in world frame
    static_car_1_world = static_car_0.copy()
    moving_car_1_world = moving_car_0.copy()
    moving_car_1_world[:, 0] += 1.5  # true physical displacement

    world_1 = np.vstack([static_car_1_world, moving_car_1_world])
    sensor_1 = transform_points(world_1, np.linalg.inv(ego_pose_1))
    labels_1 = np.full(len(world_1), CLASS_CAR, dtype=np.uint32)

    _, dyn_pts, is_dynamic = mos.separate_dynamic_points(
        sensor_1,
        semantic_labels=labels_1,
        delta_pose_from_last=delta_pose,
    )

    n_static = len(static_car_0)
    static_car_dyn = int(np.sum(is_dynamic[:n_static]))
    moving_car_dyn = int(np.sum(is_dynamic[n_static:]))

    # Assert static car has 0 dynamic detections
    assert static_car_dyn == 0, f"Static car false positive during turn: {static_car_dyn} points flagged"

    # Assert moving car HAS non-zero dynamic detections
    assert moving_car_dyn > 0, "Truly moving car was NOT detected during ego turn!"
    print(f"[PASS] Truly moving car detected ({moving_car_dyn} points) while static car had 0 false detections.")


if __name__ == "__main__":
    test_static_parked_car_through_ego_turns()
    test_moving_object_correctly_detected_under_ego_turn()
    print("\n[ALL TESTS PASSED] Viewpoint-robustness rigorously verified with zero false positives.")
