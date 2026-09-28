"""Costmap Parity & Numerical Equivalence Test.

Verifies 100.00% bitwise/numerical parity between the optimized vectorized/Numba costmap
generator and the scalar reference implementation.
"""

from __future__ import annotations

from pathlib import Path
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from core.ingestion.loader import load_kitti_bin, load_kitti_label
from core.grid.spatial_hash import SpatialHashGrid
from core.grid.local_plane import LocalPatchPlane
from core.planning.costmap_generator import CostmapGenerator, COST_LETHAL, SEMANTIC_COST_LOOKUP
from core.tracking.kalman_tracker import TrackedObstacle


def fit_terrain_planes_scalar(
    gen: CostmapGenerator,
    grid: SpatialHashGrid,
    patch_size_m: float = 6.0,
) -> Dict[Tuple[int, int], LocalPatchPlane]:
    planes: Dict[Tuple[int, int], LocalPatchPlane] = {}
    active = grid.get_active_cells()
    if len(active) < 6:
        return planes

    ring_resolutions = np.array([r.cell_size for r in grid.lattice.rings], dtype=np.float32)
    res = ring_resolutions[active["ring_id"]]
    cx = (active["ix"] + 0.5) * res
    cy = (active["iy"] + 0.5) * res

    bx = np.floor(cx / patch_size_m).astype(int)
    by = np.floor(cy / patch_size_m).astype(int)
    unique_bins = set(zip(bx, by))

    for bin_idx in unique_bins:
        center_x = (bin_idx[0] + 0.5) * patch_size_m
        center_y = (bin_idx[1] + 0.5) * patch_size_m
        plane = grid.fit_local_ground(
            center_xy=(center_x, center_y),
            radius_m=patch_size_m * 0.75,
        )
        if plane is not None:
            planes[bin_idx] = plane

    return planes


def generate_costmap_scalar(
    gen: CostmapGenerator,
    grid: SpatialHashGrid,
    dynamic_tracks: Optional[List[TrackedObstacle]] = None,
    ignore_overhang_clearance: bool = False,
    enable_slope_compensation: bool = True,
) -> np.ndarray:
    costmap = np.zeros((gen.ny, gen.nx), dtype=np.uint8)
    active_cells = grid.get_active_cells()
    if len(active_cells) == 0:
        return costmap

    lattice = grid.lattice
    patch_planes = fit_terrain_planes_scalar(gen, grid) if enable_slope_compensation else {}

    for c in active_cells:
        r_id = int(c["ring_id"])
        c_res = lattice.rings[r_id].cell_size
        wx = (int(c["ix"]) + 0.5) * c_res
        wy = (int(c["iy"]) + 0.5) * c_res

        gx = int((wx - gen.origin_x) / gen.res)
        gy = int((wy - gen.origin_y) / gen.res)

        if gx < 0 or gx >= gen.nx or gy < 0 or gy >= gen.ny:
            continue

        sem = int(c["sem_id"])
        cnt = int(c["count"])
        mean_z = float(c["mean_z"])
        m2 = float(c["m2_z"])
        var_z = m2 / max(cnt - 1, 1)
        overhang_z = float(c["overhang_z"])
        clearance = float(c["clearance"])
        base_cost = SEMANTIC_COST_LOOKUP.get(sem, 0)
        if overhang_z < 900.0:
            terrain_risk = 0
        else:
            rough_cost = int(min(var_z * gen.roughness_weight, 80.0))
            uncertainty_cost = int(min(var_z * gen.uncertainty_weight, 240.0))
            terrain_risk = max(rough_cost, uncertainty_cost)

        bin_k = (int(np.floor(wx / 6.0)), int(np.floor(wy / 6.0)))
        patch_plane = patch_planes.get(bin_k) if enable_slope_compensation else None

        if patch_plane is not None and patch_plane.is_traversable_grade:
            diff = np.array([wx - patch_plane.centroid[0], wy - patch_plane.centroid[1], mean_z - patch_plane.centroid[2]])
            d_norm = float(np.dot(diff, patch_plane.normal))
            is_solid_obstacle = (d_norm > 0.3)
        else:
            is_solid_obstacle = (mean_z > -1.2)

        if ignore_overhang_clearance:
            if sem == 50 or overhang_z < 900.0 or is_solid_obstacle:
                total_cost = COST_LETHAL
            else:
                total_cost = min(COST_LETHAL, base_cost + terrain_risk)
        else:
            eff_clearance = clearance
            if eff_clearance > 900.0 and mean_z > 0.3:
                eff_clearance = mean_z - (-1.73)

            if (overhang_z < 900.0 or mean_z > 0.3) and eff_clearance >= gen.vehicle_height_m + 0.2:
                total_cost = terrain_risk
            elif sem == 50 or is_solid_obstacle:
                total_cost = COST_LETHAL
            else:
                total_cost = min(COST_LETHAL, base_cost + terrain_risk)

        half_w = max(1, round(c_res / (2.0 * gen.res)))
        y0 = max(0, gy - half_w)
        y1 = min(gen.ny, gy + half_w + 1)
        x0 = max(0, gx - half_w)
        x1 = min(gen.nx, gx + half_w + 1)
        costmap[y0:y1, x0:x1] = np.maximum(costmap[y0:y1, x0:x1], total_cost)

    return costmap


def test_costmap_parity(scan_path: str, label_path: Optional[str] = None):
    pts = load_kitti_bin(scan_path)
    sem = None
    if label_path and Path(label_path).exists():
        sem, _ = load_kitti_label(label_path)

    grid = SpatialHashGrid()
    grid.insert_points(pts, semantic_labels=sem)

    gen = CostmapGenerator()

    # Compare without slope compensation
    cm_ref_noslope = generate_costmap_scalar(gen, grid, enable_slope_compensation=False)
    cm_opt_noslope = gen.generate_costmap(grid, enable_slope_compensation=False)

    diff_noslope = np.abs(cm_opt_noslope.astype(int) - cm_ref_noslope.astype(int))
    mismatch_noslope = np.sum(diff_noslope > 0)
    total_cells = gen.nx * gen.ny
    print(f"--- Slope Disabled ---")
    print(f"Mismatched cells: {mismatch_noslope} / {total_cells} ({mismatch_noslope / total_cells * 100:.4f}%)")
    print(f"Max delta: {np.max(diff_noslope)}")

    # Compare with slope compensation
    cm_ref_slope = generate_costmap_scalar(gen, grid, enable_slope_compensation=True)
    cm_opt_slope = gen.generate_costmap(grid, enable_slope_compensation=True)

    diff_slope = np.abs(cm_opt_slope.astype(int) - cm_ref_slope.astype(int))
    mismatch_slope = np.sum(diff_slope > 0)
    print(f"--- Slope Enabled ---")
    print(f"Mismatched cells: {mismatch_slope} / {total_cells} ({mismatch_slope / total_cells * 100:.4f}%)")
    print(f"Max delta: {np.max(diff_slope)}")

    return mismatch_noslope, mismatch_slope


if __name__ == "__main__":
    scenes = [
        ("Seq 08 Frame 0", "data/real/sequences/08/velodyne/000000.bin", "data/real/sequences/08/labels/000000.label"),
        ("Synthetic Underpass", "data/synthetic/scene_a_bridge_underpass.bin", "data/synthetic/scene_a_bridge_underpass.label"),
        ("Synthetic Potholes", "data/synthetic/scene_b_pothole_cluster.bin", "data/synthetic/scene_b_pothole_cluster.label"),
        ("Synthetic Thin Poles", "data/synthetic/scene_d_thin_pole_array.bin", "data/synthetic/scene_d_thin_pole_array.label"),
    ]
    all_pass = True
    for name, bin_p, lbl_p in scenes:
        print(f"\n==================== Testing {name} ====================")
        m_no, m_yes = test_costmap_parity(bin_p, lbl_p)
        if m_no > 0 or m_yes > 0:
            all_pass = False

    if all_pass:
        print("\n[ALL PASS] 100.00% Numerical Parity verified across all real and synthetic scenes!")
        sys.exit(0)
    else:
        print("\n[FAIL] Divergence detected in one or more scenes!")
        sys.exit(1)
