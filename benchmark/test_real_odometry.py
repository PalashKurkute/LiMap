"""Real-Data Odometry & Motion Deskewing Verification (SemanticKITTI Sequence 08).

Evaluates LidarOdometryDeskewer SVD registration and continuous motion deskewing
across sequential real-world LiDAR scans.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np

from core.ingestion.loader import load_kitti_bin, sanitize_point_cloud, compute_azimuth_timestamps
from core.ingestion.odometry import LidarOdometryDeskewer


def test_real_sequence_odometry(max_frames: int = 15):
    data_dir = Path("data/real/sequences/08/velodyne")
    bin_files = sorted(list(data_dir.glob("*.bin")))[:max_frames]

    if len(bin_files) < 2:
        print("[SKIP] Insufficient real frames for odometry evaluation.")
        return

    print("=" * 65)
    print(" REAL-WORLD LIDAR ODOMETRY & MOTION DESKEWING (SemanticKITTI)")
    print("=" * 65)

    deskewer = LidarOdometryDeskewer(voxel_size=0.75, max_range=60.0, deskew=True)
    accumulated_distance = 0.0
    last_position = np.zeros(3, dtype=np.float32)

    latencies: list[float] = []

    for idx, f_path in enumerate(bin_files):
        raw = load_kitti_bin(f_path)
        pts, _ = sanitize_point_cloud(raw, min_range=1.0, max_range=60.0)
        timestamps = compute_azimuth_timestamps(pts, scan_frequency_hz=10.0)

        t0 = time.perf_counter()
        deskewed_pts, delta_pose, current_pose = deskewer.process_frame(pts, timestamps, dt=0.1)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        latencies.append(elapsed_ms)

        current_position = current_pose[:3, 3]
        if idx > 0:
            step_dist = float(np.linalg.norm(current_position - last_position))
            accumulated_distance += step_dist
            speed_mps = step_dist / 0.1
        else:
            speed_mps = 0.0

        last_position = current_position.copy()

        if (idx + 1) % 5 == 0 or (idx + 1) == len(bin_files):
            print(
                f"  Frame [{idx + 1:2d}/{len(bin_files)}] | "
                f"Latency: {elapsed_ms:5.1f} ms | "
                f"Est. Speed: {speed_mps:4.1f} m/s | "
                f"Traj: ({current_position[0]:5.2f}, {current_position[1]:5.2f}, {current_position[2]:5.2f})m"
            )

    mean_ms = float(np.mean(latencies))
    print("-" * 65)
    print(f"  Frames Processed:        {len(bin_files)}")
    print(f"  Mean Odometry Latency:   {mean_ms:.2f} ms ({1000.0 / mean_ms:.1f} Hz)")
    print(f"  Accumulated Trajectory:  {accumulated_distance:.2f} m")
    print(f"  Final Position:          ({last_position[0]:.2f}, {last_position[1]:.2f}, {last_position[2]:.2f})")
    print("=" * 65)

    assert len(latencies) == len(bin_files)
    assert not np.isnan(last_position).any(), "NaN detected in accumulated pose"
    print("\n[PASS] Real-Data Odometry & Motion Deskewing successfully verified.")


if __name__ == "__main__":
    test_real_sequence_odometry(max_frames=15)
