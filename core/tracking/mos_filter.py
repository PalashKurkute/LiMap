"""Moving-Object Segmentation (MOS) Filter.

Isolates dynamic points (vehicles, pedestrians, two-wheelers) from static background
using semantic classification heads and ego-compensated range residuals.
Ensures moving objects never contaminate static elevation lattice accumulation.
"""

from __future__ import annotations

from typing import Optional, Tuple
import numpy as np

from core.ingestion.transforms import transform_points
from core.perception.range_projection import SphericalRangeProjector


# SemanticKITTI Moving Object Class IDs (252 to 259)
MOVING_CLASS_MIN = 252
MOVING_CLASS_MAX = 259


class MovingObjectSegmentationFilter:
    """Classifies points as dynamic vs static before grid integration."""

    def __init__(
        self,
        range_disparity_thresh_m: float = 0.35,
        projector: Optional[SphericalRangeProjector] = None,
    ):
        self.disparity_thresh = range_disparity_thresh_m
        self.projector = projector or SphericalRangeProjector(
            height=64, width=2048, fov_up_deg=3.0, fov_down_deg=-25.0
        )
        self.last_range_img: Optional[np.ndarray] = None
        self.last_pose: Optional[np.ndarray] = None

    def separate_dynamic_points(
        self,
        points: np.ndarray,
        semantic_labels: Optional[np.ndarray] = None,
        delta_pose_from_last: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Separates point cloud into static background points and dynamic obstacle points.
        
        Args:
            points: (N, 3+) float32 array in current sensor frame.
            semantic_labels: Optional (N,) uint32 class labels.
            delta_pose_from_last: 4x4 SE(3) transform from t-1 frame to current t frame.
        Returns:
            Tuple of:
              - static_points: (S, 3+) points for static elevation grid accumulation
              - dynamic_points: (D, 3+) points for dynamic object tracker
              - is_dynamic_mask: (N,) bool array
        """
        N = points.shape[0]
        is_dynamic = np.zeros(N, dtype=bool)

        # 1. Semantic-based classification
        if semantic_labels is not None:
            semantic_dynamic = (semantic_labels >= MOVING_CLASS_MIN) & (semantic_labels <= MOVING_CLASS_MAX)
            is_dynamic |= semantic_dynamic

        # 2. Residual range disparity check (for unlabeled/unseen moving objects)
        if self.last_range_img is not None and delta_pose_from_last is not None:
            # Transform current points into previous sensor frame
            inv_delta = np.linalg.inv(delta_pose_from_last)
            prev_frame_pts = transform_points(points, inv_delta)

            # Project into previous range image coordinate system
            _, _, p2pix = self.projector.project(prev_frame_pts)
            valid = (p2pix[:, 0] >= 0) & (p2pix[:, 1] >= 0)

            u = p2pix[valid, 0]
            v = p2pix[valid, 1]

            cur_depth = np.linalg.norm(prev_frame_pts[valid, :3], axis=1)
            last_depth = self.last_range_img[u, v, 0]

            has_prev_return = last_depth > 0.5
            disparity = np.abs(cur_depth - last_depth)

            # If current depth is significantly different from last depth at same line of sight
            dynamic_disparity = valid.copy()
            disparity_triggered = has_prev_return & (disparity > self.disparity_thresh)
            
            # Gating: Disparity is physically checked on candidate movable classes (vehicles, humans, unlabeled)
            # Static infrastructure (road, terrain, building, trees) is immune to ground-gradient false triggers
            if semantic_labels is not None:
                is_movable = np.isin(semantic_labels, [10, 11, 13, 15, 18, 20, 30, 31, 32, 0])
                disparity_triggered &= is_movable[valid]

            dynamic_disparity[valid] = disparity_triggered
            is_dynamic |= dynamic_disparity

        # Update historical range image for next scan
        cur_range_img, _, _ = self.projector.project(points)
        self.last_range_img = cur_range_img.copy()

        static_pts = points[~is_dynamic]
        dynamic_pts = points[is_dynamic]

        return static_pts, dynamic_pts, is_dynamic
