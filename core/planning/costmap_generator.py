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

    @numba.njit(cache=True)
    def _fast_planes_numba(
        cx: np.ndarray,
        cy: np.ndarray,
        cz: np.ndarray,
        patch_size_m: float,
        radius_sq: float,
        min_pts: int,
        max_grade_pct: float,
    ):
        N = len(cx)
        bx = np.empty(N, dtype=np.int32)
        by = np.empty(N, dtype=np.int32)
        min_bx = 999999
        max_bx = -999999
        min_by = 999999
        max_by = -999999
        for i in range(N):
            x = int(np.floor(cx[i] / patch_size_m))
            y = int(np.floor(cy[i] / patch_size_m))
            bx[i] = x
            by[i] = y
            if x < min_bx: min_bx = x
            if x > max_bx: max_bx = x
            if y < min_by: min_by = y
            if y > max_by: max_by = y

        num_bx = max_bx - min_bx + 1
        num_by = max_by - min_by + 1
        num_bins = num_bx * num_by

        head = np.full(num_bins, -1, dtype=np.int32)
        next_node = np.empty(N, dtype=np.int32)

        for i in range(N):
            b_idx = (bx[i] - min_bx) * num_by + (by[i] - min_by)
            next_node[i] = head[b_idx]
            head[b_idx] = i

        centroids = np.zeros((num_bins, 3), dtype=np.float64)
        normals = np.zeros((num_bins, 3), dtype=np.float64)
        is_traversable = np.zeros(num_bins, dtype=np.bool_)
        valid_plane = np.zeros(num_bins, dtype=np.bool_)
        cand_scratch = np.empty(10000, dtype=np.int32)

        for ix in range(num_bx):
            for iy in range(num_by):
                b_curr = ix * num_by + iy
                if head[b_curr] == -1:
                    continue

                center_x = (min_bx + ix + 0.5) * patch_size_m
                center_y = (min_by + iy + 0.5) * patch_size_m

                cand_count = 0
                for dx in (-1, 0, 1):
                    nx_b = ix + dx
                    if nx_b < 0 or nx_b >= num_bx:
                        continue
                    for dy in (-1, 0, 1):
                        ny_b = iy + dy
                        if ny_b < 0 or ny_b >= num_by:
                            continue
                        b_nb = nx_b * num_by + ny_b
                        curr = head[b_nb]
                        while curr != -1:
                            dx_pt = cx[curr] - center_x
                            dy_pt = cy[curr] - center_y
                            if dx_pt * dx_pt + dy_pt * dy_pt <= radius_sq:
                                cand_scratch[cand_count] = curr
                                cand_count += 1
                            curr = next_node[curr]

                if cand_count < min_pts:
                    continue

                sx = 0.0; sy = 0.0; sz = 0.0
                for k in range(cand_count):
                    idx = cand_scratch[k]
                    sx += cx[idx]
                    sy += cy[idx]
                    sz += cz[idx]
                mean_x = sx / cand_count
                mean_y = sy / cand_count
                mean_z = sz / cand_count

                c00 = 0.0; c01 = 0.0; c02 = 0.0
                c11 = 0.0; c12 = 0.0; c22 = 0.0
                for k in range(cand_count):
                    idx = cand_scratch[k]
                    px = cx[idx] - mean_x
                    py = cy[idx] - mean_y
                    pz = cz[idx] - mean_z
                    c00 += px * px
                    c01 += px * py
                    c02 += px * pz
                    c11 += py * py
                    c12 += py * pz
                    c22 += pz * pz

                cov = np.zeros((3, 3), dtype=np.float64)
                cov[0, 0] = c00 / cand_count
                cov[0, 1] = c01 / cand_count
                cov[1, 0] = cov[0, 1]
                cov[0, 2] = c02 / cand_count
                cov[2, 0] = cov[0, 2]
                cov[1, 1] = c11 / cand_count
                cov[1, 2] = c12 / cand_count
                cov[2, 1] = cov[1, 2]
                cov[2, 2] = c22 / cand_count

                evals, evecs = np.linalg.eigh(cov)
                norm = evecs[:, 0].copy()
                if norm[2] < 0:
                    norm = -norm
                cos_th = min(max(norm[2], -1.0), 1.0)
                slope_rad = np.arccos(cos_th)
                slope_pct = np.tan(slope_rad) * 100.0

                centroids[b_curr, 0] = mean_x
                centroids[b_curr, 1] = mean_y
                centroids[b_curr, 2] = mean_z
                normals[b_curr] = norm
                is_traversable[b_curr] = (slope_pct <= max_grade_pct)
                valid_plane[b_curr] = True

        return min_bx, min_by, num_bx, num_by, centroids, normals, is_traversable, valid_plane

    @numba.njit(cache=True)
    def _classify_solid_obstacles_numba(
        wx: np.ndarray,
        wy: np.ndarray,
        mean_z: np.ndarray,
        patch_size_m: float,
        min_bx: int,
        min_by: int,
        num_bx: int,
        num_by: int,
        centroids: np.ndarray,
        normals: np.ndarray,
        is_traversable: np.ndarray,
        valid_plane: np.ndarray,
        is_solid_obstacle: np.ndarray,
    ) -> None:
        N = len(wx)
        for i in range(N):
            bx = int(np.floor(wx[i] / patch_size_m)) - min_bx
            by = int(np.floor(wy[i] / patch_size_m)) - min_by
            if 0 <= bx < num_bx and 0 <= by < num_by:
                b_idx = bx * num_by + by
                if valid_plane[b_idx] and is_traversable[b_idx]:
                    dx = wx[i] - centroids[b_idx, 0]
                    dy = wy[i] - centroids[b_idx, 1]
                    dz = mean_z[i] - centroids[b_idx, 2]
                    d_norm = dx * normals[b_idx, 0] + dy * normals[b_idx, 1] + dz * normals[b_idx, 2]
                    is_solid_obstacle[i] = (d_norm > 0.3)

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
        min_pts = grid.ground_estimator.min_points
        if len(active) < min_pts:
            return planes

        ring_resolutions = np.array([r.cell_size for r in grid.lattice.rings], dtype=np.float32)
        res = ring_resolutions[active["ring_id"]]
        cx = (active["ix"] + 0.5) * res
        cy = (active["iy"] + 0.5) * res
        cz = active["mean_z"].astype(np.float64)
        radius_sq = (patch_size_m * 0.75) ** 2
        max_grade_pct = grid.ground_estimator.max_grade_pct

        if _HAS_NUMBA:
            (
                min_bx, min_by, num_bx, num_by,
                centroids, normals, is_trav, valid_p
            ) = _fast_planes_numba(
                cx, cy, cz, patch_size_m, radius_sq, min_pts, max_grade_pct
            )
            for ix in range(num_bx):
                for iy in range(num_by):
                    b_idx = ix * num_by + iy
                    if valid_p[b_idx]:
                        b_coord = (min_bx + ix, min_by + iy)
                        norm = normals[b_idx]
                        cos_th = min(max(norm[2], -1.0), 1.0)
                        slope_rad = float(np.arccos(cos_th))
                        slope_deg = float(np.degrees(slope_rad))
                        slope_pct = float(np.tan(slope_rad) * 100.0)
                        planes[b_coord] = LocalPatchPlane(
                            centroid=centroids[b_idx],
                            normal=norm,
                            slope_rad=slope_rad,
                            slope_deg=slope_deg,
                            slope_pct=slope_pct,
                            variance_residual=0.0,
                            is_traversable_grade=bool(is_trav[b_idx]),
                        )
            return planes

        bx = np.floor(cx / patch_size_m).astype(int)
        by = np.floor(cy / patch_size_m).astype(int)
        unique_bins = set(zip(bx, by))

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
        if len(active_cells) > 0:
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
                if _HAS_NUMBA and len(active_cells) >= grid.ground_estimator.min_points:
                    (
                        min_bx, min_by, num_bx, num_by,
                        centroids, normals, is_trav, valid_p
                    ) = _fast_planes_numba(
                        wx, wy, mean_z, 6.0, (6.0 * 0.75) ** 2,
                        grid.ground_estimator.min_points,
                        grid.ground_estimator.max_grade_pct,
                    )
                    _classify_solid_obstacles_numba(
                        wx, wy, mean_z, 6.0, min_bx, min_by, num_bx, num_by,
                        centroids, normals, is_trav, valid_p, is_solid_obstacle
                    )
                else:
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
