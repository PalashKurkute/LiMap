"""Spherical Range-Image Projector for 3D LiDAR Point Clouds.

Converts unorganized (N, 4+) point clouds into structured (H, W, 5) range images
representing channels: [range, x, y, z, remission].
Maintains a bidirectional mapping (H, W) <-> N for instant O(1) unprojection of
2D neural network semantic masks back to the full 3D point cloud.
"""

from __future__ import annotations

from typing import Optional, Tuple
import numpy as np


class SphericalRangeProjector:
    """Projects 3D LiDAR points into spherical range images (e.g. 64x2048)."""

    def __init__(
        self,
        height: int = 64,
        width: int = 2048,
        fov_up_deg: float = 2.0,
        fov_down_deg: float = -24.8,
        max_range: float = 100.0,
        min_range: float = 0.5,
    ):
        self.height = height
        self.width = width
        self.fov_up_rad = np.radians(fov_up_deg)
        self.fov_down_rad = np.radians(fov_down_deg)
        self.fov_rad = self.fov_up_rad - self.fov_down_rad
        self.max_range = max_range
        self.min_range = min_range

        # Preallocated buffers for zero-allocation execution loop
        self.range_image = np.zeros((height, width, 5), dtype=np.float32)
        self.proj_idx = np.full((height, width), -1, dtype=np.int32)
        self.point_to_pixel = np.full((1, 2), -1, dtype=np.int32)

    def project(
        self, points: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Projects (N, 3+) point cloud into spherical range image.
        
        Args:
            points: (N, 3+) float32 array [x, y, z, (remission)].
        Returns:
            Tuple of:
              - range_image: (H, W, 5) float32 [r, x, y, z, remission]
              - proj_idx: (H, W) int32 index of original point at pixel (u, v) (-1 if empty)
              - point_to_pixel: (N, 2) int32 [row, col] coordinates for each input point
        """
        num_points = points.shape[0]
        xyz = points[:, :3]
        rem = points[:, 3] if points.shape[1] > 3 else np.zeros(num_points, dtype=np.float32)

        # Range r = sqrt(x^2 + y^2 + z^2)
        depth = np.linalg.norm(xyz, axis=1)

        # Drop points too close or too far
        valid_range = (depth >= self.min_range) & (depth <= self.max_range)
        depth_safe = np.maximum(depth, 1e-4)

        # Pitch / Elevation angle theta in [-pi/2, pi/2]
        pitch = np.arcsin(xyz[:, 2] / depth_safe)

        # Yaw / Azimuth angle phi in [-pi, pi]
        # In Velodyne/SemanticKITTI coordinate frame: X forward, Y left
        yaw = -np.arctan2(xyz[:, 1], xyz[:, 0])

        # Project pitch to row index [0, H-1]
        # Top row (0) corresponds to fov_up, bottom row (H-1) to fov_down
        proj_y = 1.0 - (pitch - self.fov_down_rad) / self.fov_rad
        proj_y = np.clip(np.floor(proj_y * self.height), 0, self.height - 1).astype(np.int32)

        # Project yaw to column index [0, W-1]
        proj_x = 0.5 * (yaw / np.pi + 1.0)
        proj_x = np.clip(np.floor(proj_x * self.width), 0, self.width - 1).astype(np.int32)

        # Reset buffers
        self.range_image.fill(0.0)
        self.proj_idx.fill(-1)
        
        point_to_pixel = np.full((num_points, 2), -1, dtype=np.int32)
        valid_indices = np.where(valid_range)[0]

        if len(valid_indices) == 0:
            return self.range_image, self.proj_idx, point_to_pixel

        # Sort points by depth in descending order so closer points overwrite farther points
        sub_depth = depth[valid_indices]
        sort_order = np.argsort(sub_depth)[::-1]
        sorted_indices = valid_indices[sort_order]

        u = proj_y[sorted_indices]
        v = proj_x[sorted_indices]

        # Populate range image channels: [depth, x, y, z, remission]
        self.range_image[u, v, 0] = depth[sorted_indices]
        self.range_image[u, v, 1] = xyz[sorted_indices, 0]
        self.range_image[u, v, 2] = xyz[sorted_indices, 1]
        self.range_image[u, v, 3] = xyz[sorted_indices, 2]
        self.range_image[u, v, 4] = rem[sorted_indices]

        # Store reverse index
        self.proj_idx[u, v] = sorted_indices

        # Forward index for all valid points
        point_to_pixel[valid_indices, 0] = proj_y[valid_indices]
        point_to_pixel[valid_indices, 1] = proj_x[valid_indices]

        return self.range_image, self.proj_idx, point_to_pixel

    def unproject_semantics(
        self,
        semantic_image: np.ndarray,
        point_to_pixel: np.ndarray,
        default_label: int = 0,
    ) -> np.ndarray:
        """Unprojects 2D predicted semantic mask (H, W) back to 3D points (N,) in O(1).
        
        Args:
            semantic_image: (H, W) uint8/uint16/int32 semantic class predictions.
            point_to_pixel: (N, 2) int32 [u, v] mapping from project().
            default_label: Fallback label for points outside valid range.
        Returns:
            np.ndarray of shape (N,) uint32 with per-point semantic IDs.
        """
        num_points = point_to_pixel.shape[0]
        point_labels = np.full(num_points, default_label, dtype=np.uint32)

        valid = (point_to_pixel[:, 0] >= 0) & (point_to_pixel[:, 1] >= 0)
        u = point_to_pixel[valid, 0]
        v = point_to_pixel[valid, 1]

        point_labels[valid] = semantic_image[u, v]
        return point_labels
