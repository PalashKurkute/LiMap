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
from core.grid.local_plane import LocalPatchPlane
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

_SEM_LUT = np.zeros(256, dtype=np.int32)
for _k, _v in SEMANTIC_COST_LOOKUP.items():
    _SEM_LUT[_k] = _v

try:
    import numba

    @numba.njit(cache=True)
    def _paint_costmap_numba(
        costmap: np.ndarray,
        gx: np.ndarray,
        gy: np.ndarray,
        half_w: np.ndarray,
        total_cost: np.ndarray,
        valid_idx: np.ndarray,
        ny: int,
        nx: int,
    ) -> None:
        for k in range(len(valid_idx)):
            i = valid_idx[k]
            hw = half_w[i]
            y0 = max(0, gy[i] - hw)
            y1 = min(ny, gy[i] + hw + 1)
            x0 = max(0, gx[i] - hw)
            x1 = min(nx, gx[i] + hw + 1)
            tc = total_cost[i]
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if tc > costmap[y, x]:
                        costmap[y, x] = tc

    _HAS_NUMBA = True
except Exception:
    _HAS_NUMBA = False


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

    def fit_terrain_planes(
        self,
        grid: SpatialHashGrid,
        patch_size_m: float = 6.0,
    ) -> Dict[Tuple[int, int], LocalPatchPlane]:
        """Fits local ground tangent planes across spatial patches (SIH Standard 4.4).
        
        Enables slope immunity: distinguishes 8-15% grades from lethal obstacle walls.
        """
        planes: Dict[Tuple[int, int], LocalPatchPlane] = {}
        active = grid.get_active_cells()
        if len(active) < 6:
            return planes

        ring_resolutions = np.array([r.cell_size for r in grid.lattice.rings], dtype=np.float32)
        res = ring_resolutions[active["ring_id"]]
        cx = (active["ix"] + 0.5) * res
        cy = (active["iy"] + 0.5) * res
        cz = active["mean_z"]

        bx = np.floor(cx / patch_size_m).astype(int)
        by = np.floor(cy / patch_size_m).astype(int)
        unique_bins = set(zip(bx, by))
        radius_sq = (patch_size_m * 0.75) ** 2
        min_pts = grid.ground_estimator.min_points

        for bin_idx in unique_bins:
            center_x = (bin_idx[0] + 0.5) * patch_size_m
            center_y = (bin_idx[1] + 0.5) * patch_size_m
            dist_sq = (cx - center_x) ** 2 + (cy - center_y) ** 2
            in_radius = dist_sq <= radius_sq
            if np.sum(in_radius) < min_pts:
                continue
            patch_pts = np.column_stack((cx[in_radius], cy[in_radius], cz[in_radius]))
            plane = grid.ground_estimator.fit_patch_plane(patch_pts)
            if plane is not None:
                planes[bin_idx] = plane

        return planes

    def generate_costmap(
        self,
        grid: SpatialHashGrid,
        dynamic_tracks: Optional[List[TrackedObstacle]] = None,
        ignore_overhang_clearance: bool = False,  # If True, simulates naive 2D collapse
        enable_slope_compensation: bool = True,   # SIH Standard 4.4 slope immunity
    ) -> np.ndarray:
        """Renders 2D costmap array of shape (ny, nx) with values in [0, 254].
        
        Args:
            grid: Active SpatialHashGrid.
            dynamic_tracks: Optional list of Kalman tracked obstacles to inflate.
            ignore_overhang_clearance: Baseline toggle simulating flawed 2D collapse.
            enable_slope_compensation: Distinguishes traversable grade from obstacles.
        Returns:
            np.ndarray of shape (ny, nx) with dtype uint8.
        """
        costmap = np.zeros((self.ny, self.nx), dtype=np.uint8)
        active_cells = grid.get_active_cells()
        if len(active_cells) == 0:
            return costmap

        lattice = grid.lattice

        # --- Step 1: Vectorized coordinate computation ---
        ring_ids = active_cells["ring_id"].astype(np.int32)
        ring_sizes = np.array([r.cell_size for r in lattice.rings], dtype=np.float64)
        c_res = ring_sizes[ring_ids]

        wx = (active_cells["ix"].astype(np.float64) + 0.5) * c_res
        wy = (active_cells["iy"].astype(np.float64) + 0.5) * c_res

        gx = ((wx - self.origin_x) / self.res).astype(np.int32)
        gy = ((wy - self.origin_y) / self.res).astype(np.int32)

        valid_mask = (gx >= 0) & (gx < self.nx) & (gy >= 0) & (gy < self.ny)

        # --- Step 2: Vectorized cost computation ---
        sem = active_cells["sem_id"].astype(np.int32)
        cnt = active_cells["count"].astype(np.int32)
        mean_z = active_cells["mean_z"].astype(np.float64)
        m2_z = active_cells["m2_z"].astype(np.float64)
        overhang_z = active_cells["overhang_z"].astype(np.float64)
        clearance = active_cells["clearance"].astype(np.float64)

        var_z = m2_z / np.maximum(cnt - 1, 1).astype(np.float64)

        base_cost = _SEM_LUT[np.clip(sem, 0, 255)]
        rough_cost = np.minimum(var_z * self.roughness_weight, 80.0).astype(np.int32)
        uncertainty_cost = np.minimum(var_z * self.uncertainty_weight, 240.0).astype(np.int32)
        terrain_risk = np.maximum(rough_cost, uncertainty_cost)

        has_overhang = overhang_z < 900.0
        terrain_risk = np.where(has_overhang, 0, terrain_risk)

        is_solid_obstacle = mean_z > -1.2
        if enable_slope_compensation:
            patch_planes = self.fit_terrain_planes(grid)
            if patch_planes:
                bx = np.floor(wx / 6.0).astype(np.int32)
                by = np.floor(wy / 6.0).astype(np.int32)
                bin_keys = (bx.astype(np.int64) << 32) ^ (by.astype(np.int64) & 0xFFFFFFFF)
                unique_bk, u_inv = np.unique(bin_keys, return_inverse=True)
                for u_idx, bk in enumerate(unique_bk):
                    b_coord = (int(bk >> 32), int(np.int32(bk & 0xFFFFFFFF)))
                    plane = patch_planes.get(b_coord)
                    if plane is not None and plane.is_traversable_grade:
                        idx = np.where(u_inv == u_idx)[0]
                        diff_x = wx[idx] - plane.centroid[0]
                        diff_y = wy[idx] - plane.centroid[1]
                        diff_z = mean_z[idx] - plane.centroid[2]
                        d_norm = diff_x * plane.normal[0] + diff_y * plane.normal[1] + diff_z * plane.normal[2]
                        is_solid_obstacle[idx] = d_norm > 0.3

        if ignore_overhang_clearance:
            total_cost = np.where(
                (sem == 50) | has_overhang | is_solid_obstacle,
                COST_LETHAL,
                np.minimum(COST_LETHAL, base_cost + terrain_risk),
            ).astype(np.uint8)
        else:
            eff_clearance = np.where(
                (clearance > 900.0) & (mean_z > 0.3),
                mean_z - (-1.73),
                clearance,
            )
            is_safe_underpass = (has_overhang | (mean_z > 0.3)) & (eff_clearance >= self.vehicle_height_m + 0.2)
            is_solid_lethal = (~is_safe_underpass) & ((sem == 50) | is_solid_obstacle)

            total_cost = np.where(
                is_safe_underpass,
                terrain_risk,
                np.where(
                    is_solid_lethal,
                    COST_LETHAL,
                    np.minimum(COST_LETHAL, base_cost + terrain_risk),
                ),
            ).astype(np.uint8)

        # --- Step 3: Painting loop ---
        half_w = np.maximum(1, np.round(c_res / (2.0 * self.res))).astype(np.int32)
        valid_idx = np.where(valid_mask)[0]

        if _HAS_NUMBA:
            _paint_costmap_numba(
                costmap, gx, gy, half_w, total_cost, valid_idx, self.ny, self.nx
            )
        else:
            for i in valid_idx:
                hw = int(half_w[i])
                y0 = max(0, int(gy[i]) - hw)
                y1 = min(self.ny, int(gy[i]) + hw + 1)
                x0 = max(0, int(gx[i]) - hw)
                x1 = min(self.nx, int(gx[i]) + hw + 1)
                costmap[y0:y1, x0:x1] = np.maximum(costmap[y0:y1, x0:x1], total_cost[i])

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
