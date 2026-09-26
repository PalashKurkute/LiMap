"""Dual-Elevation & Overhang Clearance Extractor.

Solves the fundamental 2D elevation grid collapse failure mode.
Preserves both ground elevation z_ground and overhead structure height z_overhang.
Computes net traversable vertical clearance Delta_h = z_overhang - z_ground.
Underpasses with clearance > vehicle_height (e.g. 2.0m) are marked traversable
rather than false-positive impenetrable walls.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import Tuple
import numpy as np


class TraversabilityStatus(IntEnum):
    UNOBSERVED = 0
    TRAVERSABLE_GROUND = 1
    TRAVERSABLE_OVERPASS = 2  # Safe overhead clearance (e.g. bridge underpass)
    OBSTACLE_LOW_OVERHANG = 3  # Overhang too low for vehicle height
    OBSTACLE_GROUND_BLOCKED = 4  # Wall, pole, vehicle, rubble
    HAZARD_NEGATIVE = 5  # Pothole, ditch, trench crater


@dataclass
class DualElevationCell:
    z_ground: float
    z_overhang: float
    clearance_m: float
    status: TraversabilityStatus
    roughness_var: float


class DualElevationExtractor:
    """Extracts ground and overhead elevation layers per spatial column."""

    def __init__(
        self,
        vehicle_height_m: float = 1.8,
        safety_margin_m: float = 0.2,
        ground_max_height_m: float = -0.5,
        overhang_min_height_m: float = 0.3,
    ):
        self.vehicle_height_m = vehicle_height_m
        self.safety_margin_m = safety_margin_m
        self.required_clearance_m = vehicle_height_m + safety_margin_m  # 2.0m
        self.ground_max_height_m = ground_max_height_m
        self.overhang_min_height_m = overhang_min_height_m

    def analyze_column(
        self,
        z_values: np.ndarray,
        roughness_variance: float = 0.0,
    ) -> DualElevationCell:
        """Analyzes a vertical distribution of LiDAR heights in a single 2.5D cell column.
        
        Args:
            z_values: 1D array of Z coordinates falling into this cell.
            roughness_variance: Running Welford elevation variance for ground.
        Returns:
            DualElevationCell with distinct ground, overhang, clearance, and status.
        """
        if len(z_values) == 0:
            return DualElevationCell(
                z_ground=0.0,
                z_overhang=999.0,
                clearance_m=999.0,
                status=TraversabilityStatus.UNOBSERVED,
                roughness_var=0.0,
            )

        z_min = float(np.min(z_values))
        z_max = float(np.max(z_values))

        # Check for vertical separation between ground and overhead structures
        lower_mask = z_values <= self.ground_max_height_m
        upper_mask = z_values >= self.overhang_min_height_m

        has_ground = np.any(lower_mask)
        has_overhang = np.any(upper_mask)

        # Case 1: Dual-Elevation Column (both ground and overhead canopy/deck observed)
        if has_ground and has_overhang:
            z_ground = float(np.mean(z_values[lower_mask]))
            # The lowest point of the overhang determines clearance
            z_overhang = float(np.min(z_values[upper_mask]))
            clearance = z_overhang - z_ground

            if clearance >= self.required_clearance_m:
                status = TraversabilityStatus.TRAVERSABLE_OVERPASS
            else:
                status = TraversabilityStatus.OBSTACLE_LOW_OVERHANG

            return DualElevationCell(
                z_ground=z_ground,
                z_overhang=z_overhang,
                clearance_m=clearance,
                status=status,
                roughness_var=roughness_variance,
            )

        # Case 2: Only ground observed
        if has_ground and not has_overhang:
            z_ground = float(np.mean(z_values))
            
            # Check for negative hazard (pothole or ditch)
            if z_min < -1.95 or roughness_variance > 0.08:
                status = TraversabilityStatus.HAZARD_NEGATIVE
            else:
                status = TraversabilityStatus.TRAVERSABLE_GROUND

            return DualElevationCell(
                z_ground=z_ground,
                z_overhang=999.0,
                clearance_m=999.0,
                status=status,
                roughness_var=roughness_variance,
            )

        # Case 3: Points strictly at mid/obstacle height (solid wall, pillar, vehicle)
        z_ground = float(np.mean(z_values))
        return DualElevationCell(
            z_ground=z_ground,
            z_overhang=z_max,
            clearance_m=0.0,
            status=TraversabilityStatus.OBSTACLE_GROUND_BLOCKED,
            roughness_var=roughness_variance,
        )
