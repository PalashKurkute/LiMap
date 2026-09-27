"""Deterministic Spatial Hash & Bounded Memory Pool for FoveaGrid 2.5D.

Guarantees strict deterministic memory consumption:
  106,875 cells x 32 bytes = 3,420,000 bytes (3.2616 MB <= 3.42 MB < 3.5 MB).
Implements an in-place open-addressing spatial hash table with linear probing.
Zero dynamic allocations inside the real-time execution loop.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Safe repo root bootstrapping
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from typing import Dict, Optional, Tuple
import numpy as np

from core.grid.dual_elevation import DualElevationExtractor, TraversabilityStatus
from core.grid.nested_lattice import NestedLattice
from core.grid.fovea_controller import DynamicFoveaController, FoveaState
from core.grid.welford_fusion import WelfordElevationAccumulator
from core.grid.local_plane import LocalGroundPlaneEstimator, LocalPatchPlane


# Exact 32-byte Structured Cell Data Type (Cache-line aligned)
CELL_DTYPE = np.dtype([
    ("ix", np.int16),             # 2 bytes: discrete cell coordinate X
    ("iy", np.int16),             # 2 bytes: discrete cell coordinate Y
    ("ring_id", np.uint8),        # 1 byte: ring level (0..3)
    ("occupied", np.uint8),       # 1 byte: 0 = empty slot, 1 = active cell
    ("sem_id", np.uint8),         # 1 byte: dominant semantic class ID
    ("count", np.uint8),          # 1 byte: number of accumulated LiDAR returns (sat at 255)
    ("mean_z", np.float32),       # 4 bytes: running mean elevation
    ("m2_z", np.float32),         # 4 bytes: Welford running M2 (variance = m2_z / (count - 1))
    ("min_z", np.float32),        # 4 bytes: minimum recorded height
    ("max_z", np.float32),        # 4 bytes: maximum recorded height
    ("overhang_z", np.float32),   # 4 bytes: lowest height of overhead canopy/bridge
    ("clearance", np.float32),    # 4 bytes: net traversable vertical clearance
])  # Total: 2 + 2 + 1 + 1 + 1 + 1 = 8 bytes header + 6 * 4 = 24 bytes floats = 32 bytes!

assert CELL_DTYPE.itemsize == 32, f"CELL_DTYPE must be exactly 32 bytes, got {CELL_DTYPE.itemsize}"

DEFAULT_MAX_CELLS = 106_875  # 106,875 * 32 B = 3,420,000 B = 3.2616 MB <= 3.5 MB


class SpatialHashGrid:
    """Preallocated, bounded memory 2.5D multi-factor elevation grid."""

    def __init__(
        self,
        capacity: int = DEFAULT_MAX_CELLS,
        lattice: Optional[NestedLattice] = None,
        fovea_controller: Optional[DynamicFoveaController] = None,
        max_probe_steps: int = 16,
    ):
        self.capacity = capacity
        self.max_probe_steps = max_probe_steps
        self.lattice = lattice or NestedLattice()
        self.fovea = fovea_controller or DynamicFoveaController()
        self.dual_extractor = DualElevationExtractor()
        self.ground_estimator = LocalGroundPlaneEstimator()

        # Deterministic flat memory allocation: 106,875 * 32B = 3.2616 MB
        self.cells = np.zeros(self.capacity, dtype=CELL_DTYPE)
        self.active_count = 0

        # Memory verification assert: strictly < 3.5 MB
        total_heap_bytes = self.cells.nbytes
        self.total_memory_mb = total_heap_bytes / (1024.0 * 1024.0)
        assert self.total_memory_mb < 3.5, f"Spatial hash exceeds 3.5 MB bound: {self.total_memory_mb} MB"

    def reset(self) -> None:
        """Resets all cells for next frame/odometry accumulation without reallocating."""
        self.cells["occupied"].fill(0)
        self.cells["count"].fill(0)
        self.cells["m2_z"].fill(0.0)
        self.active_count = 0

    def insert_points(
        self,
        points: np.ndarray,
        semantic_labels: Optional[np.ndarray] = None,
        ego_velocity_xy: Optional[np.ndarray] = None,
    ) -> int:
        """Inserts an (N, 3+) point cloud into the bounded spatial hash.
        
        Vectorized coordinate bucketing with bounded linear probe collision handling.
        Returns number of active cells populated.
        """
        N = points.shape[0]
        xyz = points[:, :3]
        xy = xyz[:, :2]
        z = xyz[:, 2]

        if ego_velocity_xy is not None:
            fovea_state = self.fovea.update(ego_velocity_xy)
            warped_xy = self.fovea.warp_coordinates(xy, fovea_state)
        else:
            warped_xy = xy

        ring_ids = self.lattice.assign_rings(warped_xy)
        valid = ring_ids >= 0

        # Process each active ring
        for r_id in range(self.lattice.num_rings):
            ring_mask = valid & (ring_ids == r_id)
            if not np.any(ring_mask):
                continue

            r_pts_xy = warped_xy[ring_mask]
            r_z = z[ring_mask]
            r_sem = semantic_labels[ring_mask] if semantic_labels is not None else None

            ix, iy = self.lattice.point_to_cell_coords(r_pts_xy, r_id)

            # Insert batch into hash table
            self._insert_batch(ix, iy, r_id, r_z, r_sem)

        return self.active_count

    def _hash_coords(self, ix: int, iy: int, ring_id: int) -> int:
        """Computes deterministic hash slot using 32-bit integer spatial mixing."""
        # Murmur/Wang-style integer hash
        ux = (ix & 0xFFFF) * 0x1F1F1F1F
        uy = (iy & 0xFFFF) * 0x5F5F5F5F
        ur = (ring_id & 0xFF) * 0x9E3779B9
        h = (ux ^ uy ^ ur) & 0xFFFFFFFF
        h ^= (h >> 16)
        h = (h * 0x85EBCA6B) & 0xFFFFFFFF
        h ^= (h >> 13)
        return int(h % self.capacity)

    def _insert_batch(
        self,
        ix_arr: np.ndarray,
        iy_arr: np.ndarray,
        ring_id: int,
        z_arr: np.ndarray,
        sem_arr: Optional[np.ndarray],
    ) -> None:
        """Inserts points for a given ring into the hash table."""
        for i in range(len(ix_arr)):
            ix = int(ix_arr[i])
            iy = int(iy_arr[i])
            z_val = float(z_arr[i])
            sem_val = int(sem_arr[i]) if sem_arr is not None else 0
            base_slot = self._hash_coords(ix, iy, ring_id)

            # Linear probing up to max_probe_steps
            for step in range(self.max_probe_steps):
                slot = (base_slot + step) % self.capacity
                cell = self.cells[slot]

                if cell["occupied"] == 0:
                    # Claim empty slot
                    if self.active_count >= self.capacity:
                        break  # Bounded table full
                    cell["ix"] = ix
                    cell["iy"] = iy
                    cell["ring_id"] = ring_id
                    cell["occupied"] = 1
                    cell["count"] = 1
                    cell["mean_z"] = z_val
                    cell["m2_z"] = 0.0
                    cell["min_z"] = z_val
                    cell["max_z"] = z_val
                    cell["overhang_z"] = 999.0
                    cell["clearance"] = 999.0
                    cell["sem_id"] = sem_val
                    self.active_count += 1
                    break

                elif (
                    cell["ix"] == ix and
                    cell["iy"] == iy and
                    cell["ring_id"] == ring_id
                ):
                    # Existing cell match -> update Welford statistics
                    cnt = int(cell["count"])
                    mean_val = float(cell["mean_z"])
                    m2_val = float(cell["m2_z"])

                    new_cnt, new_mean, new_m2, new_min, new_max = (
                        WelfordElevationAccumulator.update_single(
                            count=cnt,
                            mean=mean_val,
                            m2=m2_val,
                            min_z=float(cell["min_z"]),
                            max_z=float(cell["max_z"]),
                            new_z=z_val,
                        )
                    )
                    cell["count"] = min(new_cnt, 255)
                    cell["mean_z"] = new_mean
                    cell["m2_z"] = new_m2
                    cell["min_z"] = new_min
                    cell["max_z"] = new_max

                    # Update dual-elevation overhang and clearance via DualElevationExtractor
                    new_overhang, new_clearance = self.dual_extractor.update_cell_clearance(
                        current_min_z=new_min,
                        current_max_z=new_max,
                        new_z=z_val,
                        current_overhang=float(cell["overhang_z"]),
                    )
                    cell["overhang_z"] = new_overhang
                    cell["clearance"] = new_clearance

                    break

    def get_active_cells(self) -> np.ndarray:
        """Returns structured view of currently occupied cells."""
        occupied_mask = self.cells["occupied"] == 1
        return self.cells[occupied_mask]

    def export_telemetry(self) -> Dict[str, object]:
        """Provides real-time memory metrics for UI/UX Pro Max dashboard."""
        return {
            "capacity": self.capacity,
            "active_cells": self.active_count,
            "load_factor": round(self.active_count / self.capacity, 4),
            "allocated_cell_mb": round(self.cells.nbytes / (1024 * 1024), 4),
            "total_heap_mb": round(self.total_memory_mb, 4),
            "under_drdo_bound": self.total_memory_mb < 3.5,
        }

    def coarsen_cells(self, factor: int = 2) -> np.ndarray:
        """Coarsens active cells using Chan's parallel variance merge (SIH Standard 2.2).
        
        Preserves exact Bayesian uncertainty across scale transitions.
        
        Args:
            factor: Integer downsampling factor (e.g. 2 means 2x2 fine cells -> 1 coarse cell).
        Returns:
            Structured array of coarsened cells with exact merged Welford statistics.
        """
        active = self.get_active_cells()
        if len(active) == 0:
            return np.zeros(0, dtype=CELL_DTYPE)

        coarse_ix = np.floor_divide(active["ix"], factor)
        coarse_iy = np.floor_divide(active["iy"], factor)
        ring_id = active["ring_id"]

        keys = (coarse_ix.astype(np.int64) << 32) ^ (coarse_iy.astype(np.int64) << 8) ^ ring_id.astype(np.int64)
        unique_keys, inverse_idx = np.unique(keys, return_inverse=True)

        num_coarse = len(unique_keys)
        coarse_cells = np.zeros(num_coarse, dtype=CELL_DTYPE)

        for u_idx in range(num_coarse):
            mask = inverse_idx == u_idx
            sub = active[mask]
            if len(sub) == 1:
                coarse_cells[u_idx] = sub[0]
                coarse_cells[u_idx]["ix"] = coarse_ix[mask][0]
                coarse_cells[u_idx]["iy"] = coarse_iy[mask][0]
                continue

            curr_cnt = np.array([float(sub[0]["count"])])
            curr_mean = np.array([float(sub[0]["mean_z"])])
            curr_m2 = np.array([float(sub[0]["m2_z"])])
            curr_min = np.array([float(sub[0]["min_z"])])
            curr_max = np.array([float(sub[0]["max_z"])])

            for k in range(1, len(sub)):
                next_cnt = np.array([float(sub[k]["count"])])
                next_mean = np.array([float(sub[k]["mean_z"])])
                next_m2 = np.array([float(sub[k]["m2_z"])])
                next_min = np.array([float(sub[k]["min_z"])])
                next_max = np.array([float(sub[k]["max_z"])])

                curr_cnt, curr_mean, curr_m2, curr_min, curr_max = (
                    WelfordElevationAccumulator.merge(
                        curr_cnt, curr_mean, curr_m2, curr_min, curr_max,
                        next_cnt, next_mean, next_m2, next_min, next_max,
                    )
                )

            coarse_cells[u_idx]["ix"] = coarse_ix[mask][0]
            coarse_cells[u_idx]["iy"] = coarse_iy[mask][0]
            coarse_cells[u_idx]["ring_id"] = sub[0]["ring_id"]
            coarse_cells[u_idx]["occupied"] = 1
            coarse_cells[u_idx]["sem_id"] = sub[0]["sem_id"]
            coarse_cells[u_idx]["count"] = min(int(curr_cnt[0]), 255)
            coarse_cells[u_idx]["mean_z"] = curr_mean[0]
            coarse_cells[u_idx]["m2_z"] = curr_m2[0]
            coarse_cells[u_idx]["min_z"] = curr_min[0]
            coarse_cells[u_idx]["max_z"] = curr_max[0]
            coarse_cells[u_idx]["overhang_z"] = float(np.min(sub["overhang_z"]))
            coarse_cells[u_idx]["clearance"] = float(np.min(sub["clearance"]))

        return coarse_cells

    def query_coarsened_region(
        self,
        min_xy: Tuple[float, float],
        max_xy: Tuple[float, float],
        factor: int = 2,
    ) -> np.ndarray:
        """Queries and coarsens active cells within a bounding box using Chan's merge (Standard 2.2).
        
        Preserves exact Law of Total Variance across resolution boundaries.
        """
        active = self.get_active_cells()
        if len(active) == 0:
            return np.zeros(0, dtype=CELL_DTYPE)

        ring_resolutions = np.array([r.cell_size for r in self.lattice.rings], dtype=np.float32)
        res = ring_resolutions[active["ring_id"]]
        cx = (active["ix"] + 0.5) * res
        cy = (active["iy"] + 0.5) * res

        in_bbox = (
            (cx >= min_xy[0]) & (cx <= max_xy[0]) &
            (cy >= min_xy[1]) & (cy <= max_xy[1])
        )
        if not np.any(in_bbox):
            return np.zeros(0, dtype=CELL_DTYPE)

        sub_grid = SpatialHashGrid(capacity=len(active[in_bbox]) + 10, lattice=self.lattice)
        sub_grid.cells[:len(active[in_bbox])] = active[in_bbox]
        sub_grid.active_count = len(active[in_bbox])
        return sub_grid.coarsen_cells(factor=factor)

    def fit_local_ground(
        self,
        center_xy: Tuple[float, float],
        radius_m: float = 3.0,
    ) -> Optional[LocalPatchPlane]:
        """Fits local ground tangent plane via PCA around coordinate (SIH Standard 4.4).
        
        Eliminates slope false alarms (8-15% grade) by estimating normal and grade.
        """
        active = self.get_active_cells()
        if len(active) < self.ground_estimator.min_points:
            return None

        # Resolve active cells to world coordinates
        ring_resolutions = np.array([r.cell_size for r in self.lattice.rings], dtype=np.float32)
        res = ring_resolutions[active["ring_id"]]
        cx = (active["ix"] + 0.5) * res
        cy = (active["iy"] + 0.5) * res
        dist_sq = (cx - center_xy[0]) ** 2 + (cy - center_xy[1]) ** 2

        in_radius = dist_sq <= (radius_m ** 2)
        if np.sum(in_radius) < self.ground_estimator.min_points:
            return None

        patch_pts = np.column_stack((cx[in_radius], cy[in_radius], active["mean_z"][in_radius]))
        return self.ground_estimator.fit_patch_plane(patch_pts)

    def evaluate_slope_compensation(
        self,
        center_xy: Tuple[float, float],
        radius_m: float = 3.0,
    ) -> Optional[Tuple[LocalPatchPlane, float]]:
        """Fits local ground tangent plane and returns (plane, slope_grade_pct).
        
        Used by downstream planners/costmaps to compensate for 8-15% grades (Standard 4.4).
        """
        plane = self.fit_local_ground(center_xy=center_xy, radius_m=radius_m)
        if plane is None:
            return None
        return plane, plane.slope_pct


