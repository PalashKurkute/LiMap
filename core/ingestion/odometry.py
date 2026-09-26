"""LiDAR Odometry Interface & Deskewing Pipeline.

Wraps KISS-ICP for real-time scan-to-scan ego-motion estimation with an
optimized pure-NumPy voxelized ICP fallback for environments without KISS-ICP.
Provides deskewed point clouds and continuous SE(3) trajectory poses.
"""

from __future__ import annotations

from typing import Optional, Tuple
import numpy as np
from scipy.spatial import cKDTree

from core.ingestion.transforms import deskew_points_constant_velocity, make_se3_matrix, transform_points

try:
    from kiss_icp.kiss_icp import KissICP
    from kiss_icp.config import KISSConfig
    _HAS_KISS_ICP = True
except ImportError:
    _HAS_KISS_ICP = False


class LidarOdometryDeskewer:
    """Manages scan-to-scan odometry tracking and continuous-time motion compensation."""

    def __init__(
        self,
        voxel_size: float = 0.5,
        max_range: float = 80.0,
        min_range: float = 1.0,
        deskew: bool = True,
    ):
        self.voxel_size = voxel_size
        self.max_range = max_range
        self.min_range = min_range
        self.deskew = deskew
        
        # State tracking
        self.last_points: Optional[np.ndarray] = None
        self.current_pose = np.eye(4, dtype=np.float32)  # Global map -> odom pose
        self.last_velocity = np.zeros(3, dtype=np.float32)  # [vx, vy, vz]
        self.last_angular_vel = np.zeros(3, dtype=np.float32)  # [wx, wy, wz]
        self.scan_count = 0

        # KISS-ICP backend if available
        self.kiss_pipeline = None
        if _HAS_KISS_ICP:
            config = KISSConfig()
            config.data.max_range = max_range
            config.data.min_range = min_range
            config.data.deskew = deskew
            self.kiss_pipeline = KissICP(config=config)

    def process_frame(
        self,
        points: np.ndarray,
        timestamps: Optional[np.ndarray] = None,
        dt: float = 0.1,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Processes a single LiDAR frame.
        
        Args:
            points: (N, 3+) float32 array in current sensor frame.
            timestamps: (N,) float32 relative timestamps in seconds within the scan.
            dt: Inter-scan interval in seconds (default 0.1s for 10 Hz).
        Returns:
            Tuple of:
              - deskewed_points: (N, 3+) float32 points deskewed to end-of-scan frame.
              - relative_delta_pose: 4x4 SE(3) transformation from previous scan to current scan.
              - global_pose: 4x4 SE(3) accumulated ego pose in odom frame.
        """
        self.scan_count += 1
        xyz = points[:, :3]

        if self.kiss_pipeline is not None:
            # Use KISS-ICP native pipeline
            frame_pts = self.kiss_pipeline.register_frame(xyz, timestamps)
            delta_pose = np.asarray(frame_pts.delta_pose, dtype=np.float32)
            self.current_pose = np.asarray(frame_pts.pose, dtype=np.float32)
            
            # Extract velocity
            self.last_velocity = delta_pose[:3, 3] / dt
            deskewed_xyz = np.asarray(frame_pts.points, dtype=np.float32)
            if points.shape[1] > 3:
                deskewed = np.column_stack([deskewed_xyz, points[:, 3:]]).astype(np.float32)
            else:
                deskewed = deskewed_xyz
            return deskewed, delta_pose, self.current_pose

        # Fallback NumPy Voxel-ICP Odometry
        if self.last_points is None:
            self.last_points = self._voxel_downsample(xyz, self.voxel_size)
            return points.copy(), np.eye(4, dtype=np.float32), self.current_pose

        # Step 1: Deskew points using last estimated velocities
        if self.deskew and timestamps is not None:
            deskewed = deskew_points_constant_velocity(
                points=points,
                timestamps=timestamps,
                linear_velocity=self.last_velocity,
                angular_velocity=self.last_angular_vel,
                reference_time=dt,
            )
        else:
            deskewed = points.copy()

        # Step 2: Register current scan to previous scan
        curr_downsampled = self._voxel_downsample(deskewed[:, :3], self.voxel_size)
        delta_pose = self._align_scans_icp(curr_downsampled, self.last_points)

        # Step 3: Update velocities and accumulated pose
        self.last_velocity = delta_pose[:3, 3] / dt
        self.current_pose = self.current_pose @ delta_pose
        self.last_points = curr_downsampled

        return deskewed, delta_pose, self.current_pose

    def _voxel_downsample(self, points: np.ndarray, voxel_size: float) -> np.ndarray:
        """Fast grid downsampling by picking first point in each voxel."""
        voxel_coords = np.floor(points / voxel_size).astype(np.int32)
        # Unique voxel coordinates
        _, unique_indices = np.unique(voxel_coords, axis=0, return_index=True)
        return points[unique_indices]

    def _align_scans_icp(
        self,
        source: np.ndarray,
        target: np.ndarray,
        max_iters: int = 15,
        tolerance: float = 1e-4,
    ) -> np.ndarray:
        """Point-to-point ICP registration using KD-tree nearest neighbors."""
        T_accum = np.eye(4, dtype=np.float32)
        src_transformed = source.copy()
        kdtree = cKDTree(target)

        for _ in range(max_iters):
            distances, indices = kdtree.query(src_transformed, k=1, distance_upper_bound=1.5)
            valid = np.isfinite(distances)
            if np.sum(valid) < 30:
                break

            P = src_transformed[valid]
            Q = target[indices[valid]]

            # Center of mass
            p_mean = np.mean(P, axis=0)
            q_mean = np.mean(Q, axis=0)
            P_cent = P - p_mean
            Q_cent = Q - q_mean

            # SVD of covariance matrix
            H = P_cent.T @ Q_cent
            U, S, Vt = np.linalg.svd(H)
            R_step = Vt.T @ U.T

            # Reflection correction
            if np.linalg.det(R_step) < 0:
                Vt[2, :] *= -1
                R_step = Vt.T @ U.T

            t_step = q_mean - (R_step @ p_mean)

            T_step = make_se3_matrix(R_step, t_step)
            T_accum = T_step @ T_accum
            src_transformed = (src_transformed @ R_step.T) + t_step

            # Convergence check
            if np.linalg.norm(t_step) < tolerance:
                break

        return T_accum
