"""IDD-3D Dataset Bridge and Indian Mixed-Traffic Pseudo-Labeler.

Addresses SIH26053 Standards 5.4 and 5.5:
  - Standard 5.4: Indian & off-road traversability classes (Cattle, Autorickshaw,
    Pothole, Mud, Gravel, Curb) missing from Western datasets (SemanticKITTI/NuScenes).
  - Standard 5.5: Bridges IDD-3D (IIIT-Hyderabad) 3D bounding-box annotations
    into per-point semantic segmentation labels via oriented bounding box (OBB) projection.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np


# 12-Class Granular Defense & Indian Mixed-Traffic Taxonomy
INDIAN_OFFROAD_CLASSES: Dict[int, str] = {
    0: "unlabeled",
    1: "road_asphalt",
    2: "curb_barrier",
    3: "pothole_crater",
    4: "gravel_loose",
    5: "mud_slurry",
    6: "vegetation_canopy",
    7: "overhang_bridge",
    8: "building_structure",
    9: "pole_bollard",
    10: "motor_vehicle",
    11: "autorickshaw",   # Critical Indian mixed traffic class
    12: "cattle_animal",   # Critical Indian dynamic obstacle class
}

INDIAN_CLASS_COST: Dict[int, int] = {
    1: 0,      # Road: free
    2: 160,    # Curb: high traversability resistance
    3: 200,    # Pothole: high damage hazard
    4: 40,     # Gravel: minor friction reduction
    5: 120,    # Mud: high slip uncertainty
    6: 30,     # Vegetation: minor resistance
    7: 10,     # Overhang: safe underpass if clearance >= 2.0m
    8: 254,    # Building: lethal
    9: 254,    # Pole/Bollard: lethal
    10: 254,   # Car: lethal
    11: 254,   # Autorickshaw: lethal
    12: 254,   # Cattle: lethal dynamic hazard
}


@dataclass
class BoundingBox3D:
    cx: float
    cy: float
    cz: float
    length: float  # Along local X
    width: float   # Along local Y
    height: float  # Along local Z
    yaw_rad: float # Rotation around vertical Z axis
    class_id: int


class IDD3DPseudoLabeler:
    """Projects 3D bounding boxes into dense per-point semantic labels."""

    def __init__(self, ground_z_datum: float = -1.73):
        self.ground_datum = ground_z_datum

    def label_points_from_boxes(
        self,
        points_xyz: np.ndarray,
        boxes: List[BoundingBox3D],
        default_label: int = 1,  # Default to road
    ) -> np.ndarray:
        """Assigns per-point semantic labels based on 3D OBB containment.
        
        Args:
            points_xyz: (N, 3) point cloud array.
            boxes: List of 3D bounding boxes from IDD-3D.
            default_label: Default label for background points.
        Returns:
            np.ndarray of shape (N,) uint8 semantic labels.
        """
        N = points_xyz.shape[0]
        labels = np.full(N, default_label, dtype=np.uint8)

        # Flag negative obstacles / potholes
        labels[points_xyz[:, 2] < (self.ground_datum - 0.15)] = 3  # Pothole

        for box in boxes:
            # 1. Translate to box centroid
            dx = points_xyz[:, 0] - box.cx
            dy = points_xyz[:, 1] - box.cy
            dz = points_xyz[:, 2] - box.cz

            # 2. Rotate by -yaw into box's local coordinate frame
            cos_y = np.cos(-box.yaw_rad)
            sin_y = np.sin(-box.yaw_rad)

            local_x = dx * cos_y - dy * sin_y
            local_y = dx * sin_y + dy * cos_y
            local_z = dz

            # 3. Check axis-aligned bounding box containment in local frame
            half_l = box.length * 0.5
            half_w = box.width * 0.5
            half_h = box.height * 0.5

            in_box = (
                (np.abs(local_x) <= half_l) &
                (np.abs(local_y) <= half_w) &
                (np.abs(local_z) <= half_h)
            )

            labels[in_box] = box.class_id

        return labels

    def generate_synthetic_idd3d_scene(self) -> Tuple[np.ndarray, np.ndarray, List[BoundingBox3D]]:
        """Generates a canonical Indian urban scene containing an autorickshaw and cattle."""
        pts_list = []

        # Road asphalt (N=30,000)
        xs = np.random.uniform(2.0, 45.0, 30000)
        ys = np.random.uniform(-6.0, 6.0, 30000)
        zs = np.random.normal(self.ground_datum, 0.015, 30000)

        # 1. Autorickshaw at (x=14.0, y=1.8, z=-1.1), dimensions: 2.6m x 1.3m x 1.7m
        box_auto = BoundingBox3D(
            cx=14.0, cy=1.8, cz=-0.88,
            length=2.6, width=1.3, height=1.7,
            yaw_rad=0.05, class_id=11  # Autorickshaw
        )

        # 2. Stray cattle at (x=22.0, y=-2.2, z=-1.0), dimensions: 2.1m x 0.8m x 1.5m
        box_cattle = BoundingBox3D(
            cx=22.0, cy=-2.2, cz=-0.98,
            length=2.1, width=0.8, height=1.5,
            yaw_rad=-0.20, class_id=12  # Cattle
        )

        boxes = [box_auto, box_cattle]

        # Generate points on the autorickshaw surface (N=1200)
        auto_x = np.random.uniform(-1.2, 1.2, 1200) + box_auto.cx
        auto_y = np.random.uniform(-0.6, 0.6, 1200) + box_auto.cy
        auto_z = np.random.uniform(-0.8, 0.8, 1200) + box_auto.cz

        # Generate points on the cattle surface (N=800)
        cat_x = np.random.uniform(-1.0, 1.0, 800) + box_cattle.cx
        cat_y = np.random.uniform(-0.35, 0.35, 800) + box_cattle.cy
        cat_z = np.random.uniform(-0.7, 0.7, 800) + box_cattle.cz

        all_x = np.concatenate([xs, auto_x, cat_x])
        all_y = np.concatenate([ys, auto_y, cat_y])
        all_z = np.concatenate([zs, auto_z, cat_z])
        points = np.column_stack([all_x, all_y, all_z])

        labels = self.label_points_from_boxes(points, boxes)

        return points, labels, boxes
