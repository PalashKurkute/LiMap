"""Free-Space Ray-Casting & Anti-Ghosting Eraser for 2.5D Grids.

When dynamic obstacles (e.g. vehicles, pedestrians) vacate a cell, subsequent LiDAR
beams pass through the previously occupied space to strike distant ground or obstacles.
This module performs 2D/2.5D line-of-sight ray traversal: cells traversed by passing
beams have ghost obstacle remnants erased within 2-3 scans (200-300 ms).
"""

from __future__ import annotations

import sys
from pathlib import Path

# Safe repo root bootstrapping
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from typing import List, Tuple
import numpy as np

from core.grid.spatial_hash import SpatialHashGrid


class FreeSpaceGhostEraser:
    """Carves free space along LiDAR beams to eliminate dynamic vehicle ghost trails."""

    def __init__(
        self,
        stride: int = 4,  # Subsample beams for deterministic < 5ms CPU budget
        sensor_height_m: float = 0.0,  # Sensor origin relative to ego vehicle frame
        clearance_tolerance_m: float = 0.3,
    ):
        self.stride = stride
        self.sensor_z = sensor_height_m
        self.clearance_tolerance = clearance_tolerance_m

    def erase_ghost_trails(
        self,
        grid: SpatialHashGrid,
        hit_points: np.ndarray,
        max_ray_range_m: float = 50.0,
    ) -> int:
        """Traces rays from sensor origin to hit points and clears traversed ghost obstacles.
        
        Args:
            grid: Active SpatialHashGrid containing cell records.
            hit_points: (N, 3+) float32 array of current scan LiDAR returns.
            max_ray_range_m: Maximum range to cast rays.
        Returns:
            Number of ghost obstacle cells successfully cleared.
        """
        if len(hit_points) == 0:
            return 0

        # Subsample rays to maintain real-time performance
        sub_pts = hit_points[::self.stride]
        xy = sub_pts[:, :2]
        z = sub_pts[:, 2]

        ranges = np.hypot(xy[:, 0], xy[:, 1])
        valid = (ranges >= 2.0) & (ranges <= max_ray_range_m)
        
        xy_valid = xy[valid]
        z_valid = z[valid]
        r_valid = ranges[valid]

        erased_count = 0
        lattice = grid.lattice

        # Step size fine enough to avoid skipping cells (10cm)
        step_size = 0.10
        
        for i in range(len(xy_valid)):
            target_x = xy_valid[i, 0]
            target_y = xy_valid[i, 1]
            target_z = z_valid[i]
            r = r_valid[i]

            if r < 1.2:
                continue

            # March along ray from 1.0m to 0.25m before hit point
            s = np.arange(1.0, max(r - 0.25, 1.0), step_size)
            if len(s) == 0:
                continue

            frac = s / r
            ray_xs = target_x * frac
            ray_ys = target_y * frac
            ray_zs = self.sensor_z + (target_z - self.sensor_z) * frac

            # Process discrete cell coordinates along ray
            for sx, sy, sz in zip(ray_xs, ray_ys, ray_zs):
                rad = np.hypot(sx, sy)
                if rad >= lattice.r_max:
                    continue

                ring_id = -1
                for cfg in lattice.rings:
                    if cfg.r_inner <= rad < cfg.r_outer:
                        ring_id = cfg.ring_id
                        break

                if ring_id < 0:
                    continue

                res = lattice.rings[ring_id].cell_size
                ix = int(np.floor(sx / res))
                iy = int(np.floor(sy / res))

                base_slot = grid._hash_coords(ix, iy, ring_id)
                for step in range(grid.max_probe_steps):
                    slot = (base_slot + step) % grid.capacity
                    cell = grid.cells[slot]
                    if cell["occupied"] == 0:
                        break

                    if (
                        cell["ix"] == ix and
                        cell["iy"] == iy and
                        cell["ring_id"] == ring_id
                    ):
                        obs_min = float(cell["min_z"])
                        obs_max = float(cell["max_z"])
                        
                        # If ray passes through an elevation previously deemed an obstacle
                        # (above ground and within recorded obstacle height envelope)
                        if (obs_max > -1.2) and (sz >= obs_min - 0.1) and (sz <= obs_max + 0.1):
                            # Demote vacated ghost obstacle cell back to nominal ground level
                            # Preserves hash table linear probing chain integrity
                            cell["max_z"] = min(obs_min, -1.70)
                            cell["mean_z"] = min(obs_min, -1.70)
                            cell["sem_id"] = 40  # Road
                            cell["overhang_z"] = 999.0
                            cell["clearance"] = 999.0
                            cell["m2_z"] = 0.0
                            erased_count += 1
                        break

        return erased_count
