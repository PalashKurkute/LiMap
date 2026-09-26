"""Multi-Layer Costmap Exporter for Autonomous Navigation.

Translates FoveaGrid 2.5D multi-factor spatial hash into continuous 2D/2.5D costmaps:
  Layer 0: Terrain roughness / elevation variance cost (alpha * var_z)
  Layer 1: Semantic risk cost (road=0, terrain=40, crater=200, obstacle=254)
  Layer 2: Dynamic obstacle footprint and velocity inflation
  Layer 3: Dual-elevation clearance cost (underpasses traversable, low overhangs lethal)

Generates standard ROS Nav2 / OccupancyGrid compatible 8-bit costmaps.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Safe repo root bootstrapping
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from typing import Dict, List, Optional, Tuple
import numpy as np

from core.grid.spatial_hash import SpatialHashGrid
from core.tracking.kalman_tracker import TrackedObstacle


# Costmap Values (0 to 255)
COST_FREE = 0
COST_LOW_RISK = 30       # Gravel / grass
COST_MEDIUM_RISK = 80    # Rough terrain
COST_HIGH_RISK = 180     # Pothole / depression
COST_LETHAL = 254        # Solid obstacle or impassable overhang
COST_UNKNOWN = 255


# Semantic Class Cost Mapping
SEMANTIC_COST_LOOKUP: Dict[int, int] = {
    0: 0,                 # Unlabeled -> neutral
    40: COST_FREE,        # Road -> 0
    72: COST_HIGH_RISK,   # Terrain Crater / Pothole -> 180
    80: COST_LETHAL,      # Pole -> 254
    10: COST_LETHAL,      # Car -> 254
    50: COST_LETHAL,      # Building / Structure -> 254 (unless underpass clearance permits)
}


class CostmapGenerator:
    """Generates multi-layer Nav2-compatible costmaps from FoveaGrid."""

    def __init__(
        self,
        grid_width_m: float = 60.0,
        grid_height_m: float = 60.0,
        resolution_m: float = 0.10,  # 10 cm costmap cell size
        roughness_weight: float = 200.0,
        uncertainty_weight: float = 350.0,  # Bayesian variance penalty weight (Standard 2.3)
        vehicle_height_m: float = 1.8,
    ):
        self.width_m = grid_width_m
        self.height_m = grid_height_m
        self.res = resolution_m
        self.nx = int(grid_width_m / resolution_m)
        self.ny = int(grid_height_m / resolution_m)
        self.roughness_weight = roughness_weight
        self.uncertainty_weight = uncertainty_weight
        self.vehicle_height_m = vehicle_height_m
        self.origin_x = -grid_width_m * 0.5
        self.origin_y = -grid_height_m * 0.5

    def generate_costmap(
        self,
        grid: SpatialHashGrid,
        dynamic_tracks: Optional[List[TrackedObstacle]] = None,
        ignore_overhang_clearance: bool = False,  # If True, simulates naive 2D collapse
    ) -> np.ndarray:
        """Renders 2D costmap array of shape (ny, nx) with values in [0, 254].
        
        Args:
            grid: Active SpatialHashGrid.
            dynamic_tracks: Optional list of Kalman tracked obstacles to inflate.
            ignore_overhang_clearance: Baseline toggle simulating flawed 2D collapse.
        Returns:
            np.ndarray of shape (ny, nx) with dtype uint8.
        """
        costmap = np.zeros((self.ny, self.nx), dtype=np.uint8)
        active_cells = grid.get_active_cells()

        if len(active_cells) == 0:
            return costmap

        lattice = grid.lattice

        for c in active_cells:
            r_id = int(c["ring_id"])
            c_res = lattice.rings[r_id].cell_size
            wx = (int(c["ix"]) + 0.5) * c_res
            wy = (int(c["iy"]) + 0.5) * c_res

            # Map world coordinate to costmap image pixel
            gx = int((wx - self.origin_x) / self.res)
            gy = int((wy - self.origin_y) / self.res)

            if gx < 0 or gx >= self.nx or gy < 0 or gy >= self.ny:
                continue

            sem = int(c["sem_id"])
            cnt = int(c["count"])
            mean_z = float(c["mean_z"])
            m2 = float(c["m2_z"])
            var_z = m2 / max(cnt - 1, 1)
            overhang_z = float(c["overhang_z"])
            clearance = float(c["clearance"])
            base_cost = SEMANTIC_COST_LOOKUP.get(sem, 0)
            rough_cost = int(min(var_z * self.roughness_weight, 80.0))
            uncertainty_cost = int(min(var_z * self.uncertainty_weight, 240.0))
            terrain_risk = max(rough_cost, uncertainty_cost)

            # 3. Dual-elevation clearance check vs naive 2D collapse
            if ignore_overhang_clearance:
                # Naive 2D collapse: treats any elevated structure as a lethal obstacle
                if sem == 50 or overhang_z < 900.0 or mean_z > -1.2:
                    total_cost = COST_LETHAL
                else:
                    total_cost = min(COST_LETHAL, base_cost + terrain_risk)
            else:
                # FoveaGrid 2.5D: Evaluates true 3D vehicle clearance
                eff_clearance = clearance
                if eff_clearance > 900.0 and mean_z > 0.3:
                    eff_clearance = mean_z - (-1.73)  # Clearance relative to road datum (-1.73m)

                if (overhang_z < 900.0 or mean_z > 0.3) and eff_clearance >= self.vehicle_height_m + 0.2:
                    total_cost = terrain_risk  # Safe overhead underpass (nominal road cost)!
                elif sem == 50 or mean_z > -1.2:
                    total_cost = COST_LETHAL      # Solid pillar, wall, or low obstacle
                else:
                    total_cost = min(COST_LETHAL, base_cost + terrain_risk)

            # Fill cell's spatial footprint on costmap based on ring resolution (min 1 pixel radius to prevent pinholes)
            half_w = max(1, int(round(c_res / (2.0 * self.res))))
            y0 = max(0, gy - half_w)
            y1 = min(self.ny, gy + half_w + 1)
            x0 = max(0, gx - half_w)
            x1 = min(self.nx, gx + half_w + 1)
            costmap[y0:y1, x0:x1] = np.maximum(costmap[y0:y1, x0:x1], total_cost)

        # 4. Inflate dynamic obstacles
        if dynamic_tracks:
            for track in dynamic_tracks:
                cx, cy = track.state[0], track.state[1]
                cgx = int((cx - self.origin_x) / self.res)
                cgy = int((cy - self.origin_y) / self.res)

                radius_cells = int(max(track.bbox.length, track.bbox.width) / self.res) + 2
                y_min = max(0, cgy - radius_cells)
                y_max = min(self.ny, cgy + radius_cells + 1)
                x_min = max(0, cgx - radius_cells)
                x_max = min(self.nx, cgx + radius_cells + 1)

                costmap[y_min:y_max, x_min:x_max] = COST_LETHAL

        return costmap

    def world_to_grid(self, wx: float, wy: float) -> Tuple[int, int]:
        gx = int((wx - self.origin_x) / self.res)
        gy = int((wy - self.origin_y) / self.res)
        return gx, gy

    def grid_to_world(self, gx: int, gy: int) -> Tuple[float, float]:
        wx = self.origin_x + (gx + 0.5) * self.res
        wy = self.origin_y + (gy + 0.5) * self.res
        return wx, wy
