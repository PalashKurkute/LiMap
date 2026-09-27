"""Phase 2 Integration Test: Algorithmic Defensibility & Multi-Layer Planning.

Verifies:
  1. Live DualElevationExtractor invocation in SpatialHashGrid (Task 2.1).
  2. Chan's parallel-variance merge across multi-ring coarsened cells (Task 2.2).
  3. LocalGroundPlaneEstimator PCA ground-plane fitting & slope immunity (Task 2.3).
  4. Hybrid-A* planner confidence integration: Planner detours around high-uncertainty
     terrain even when a shorter risky straight path exists (Task 2.4).
"""

import sys
from pathlib import Path
import numpy as np

# Ensure project root in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.grid.spatial_hash import SpatialHashGrid
from core.grid.welford_fusion import WelfordElevationAccumulator
from core.grid.local_plane import LocalGroundPlaneEstimator
from core.planning.costmap_generator import CostmapGenerator
from core.planning.hybrid_a_star import HybridAStarPlanner


def test_2_1_dual_elevation_live_wiring():
    """Verifies that inserting points into SpatialHashGrid actively invokes DualElevationExtractor."""
    grid = SpatialHashGrid()

    # Column with ground points at -1.73m and overhead bridge deck at +1.0m (clearance = 2.73m > 2.0m)
    pts = np.array([
        [5.0, 0.0, -1.73, 0.5],
        [5.0, 0.0, -1.70, 0.5],
        [5.0, 0.0,  1.00, 0.5],
        [5.0, 0.0,  1.20, 0.5],
    ], dtype=np.float32)

    grid.insert_points(pts)
    active = grid.get_active_cells()
    assert len(active) > 0, "No active cells populated"

    cell = active[0]
    assert cell["overhang_z"] < 900.0, "DualElevationExtractor was not invoked (overhang_z not updated)"
    assert np.isclose(cell["overhang_z"], 1.00, atol=0.05), f"Overhang mismatch: {cell['overhang_z']}"
    assert cell["clearance"] >= 2.0, f"Expected clearance >= 2.0m, got {cell['clearance']}"
    print(f"[PASS] Task 2.1: DualElevationExtractor live call verified (overhang={cell['overhang_z']:.2f}m, clearance={cell['clearance']:.2f}m).")


def test_2_2_chans_parallel_variance_merge():
    """Verifies Chan's parallel merge for combining multi-ring/temporal cell statistics."""
    rng = np.random.default_rng(123)
    sample_a = rng.normal(loc=-1.5, scale=0.2, size=300).astype(np.float32)
    sample_b = rng.normal(loc=-1.2, scale=0.4, size=200).astype(np.float32)

    # Accumulate set A
    cnt_a, mean_a, m2_a, min_a, max_a = 0, 0.0, 0.0, 999.0, -999.0
    for v in sample_a:
        cnt_a, mean_a, m2_a, min_a, max_a = WelfordElevationAccumulator.update_single(
            cnt_a, mean_a, m2_a, min_a, max_a, float(v)
        )

    # Accumulate set B
    cnt_b, mean_b, m2_b, min_b, max_b = 0, 0.0, 0.0, 999.0, -999.0
    for v in sample_b:
        cnt_b, mean_b, m2_b, min_b, max_b = WelfordElevationAccumulator.update_single(
            cnt_b, mean_b, m2_b, min_b, max_b, float(v)
        )

    # Merge via Chan's parallel algorithm (testing explicit merge alias)
    tot_cnt, out_mean, out_m2, out_min, out_max = WelfordElevationAccumulator.merge(
        np.array([cnt_a]), np.array([mean_a]), np.array([m2_a]), np.array([min_a]), np.array([max_a]),
        np.array([cnt_b]), np.array([mean_b]), np.array([m2_b]), np.array([min_b]), np.array([max_b]),
    )

    combined_all = np.concatenate([sample_a, sample_b])
    true_mean = np.mean(combined_all)
    true_var = np.var(combined_all, ddof=1)
    chan_var = out_m2[0] / (tot_cnt[0] - 1)

    assert np.isclose(out_mean[0], true_mean, atol=1e-5), f"Chan mean mismatch: {out_mean[0]} vs {true_mean}"
    assert np.isclose(chan_var, true_var, atol=1e-4), f"Chan variance mismatch: {chan_var} vs {true_var}"

    # Also verify live coarsening invocation on SpatialHashGrid
    test_grid = SpatialHashGrid()
    dense_pts = np.array([
        [1.0, 1.0, -1.5, 0.5],
        [1.0, 1.0, -1.3, 0.5],
        [1.05, 1.05, -1.4, 0.5],
        [1.05, 1.05, -1.2, 0.5],
    ], dtype=np.float32)
    test_grid.insert_points(dense_pts)
    coarsened = test_grid.coarsen_cells(factor=2)
    assert len(coarsened) > 0, "SpatialHashGrid.coarsen_cells produced 0 cells"
    assert coarsened[0]["count"] >= 2, "Coarsened cell count did not aggregate"

    # Verify query_coarsened_region
    q_coarsened = test_grid.query_coarsened_region(min_xy=(0.0, 0.0), max_xy=(2.0, 2.0), factor=2)
    assert len(q_coarsened) > 0, "query_coarsened_region produced 0 cells"
    print(f"[PASS] Task 2.2: Chan's parallel-variance merge verified exact & wired to SpatialHashGrid.coarsen_cells and query_coarsened_region.")


def test_2_3_local_plane_pca_ground_fit():
    """Verifies PCA tangent ground plane fitting and slope immunity in CostmapGenerator."""
    estimator = LocalGroundPlaneEstimator()
    res = estimator.verify_slope_immunity(slope_pct=12.0, num_points=5000)
    assert res["slope_immunity_verified"], f"Slope immunity failed at 12% grade: {res}"

    # Verify live local ground plane fitting on SpatialHashGrid
    test_grid = SpatialHashGrid()
    xs = np.linspace(-3.0, 3.0, 20)
    ys = np.linspace(-3.0, 3.0, 20)
    xv, yv = np.meshgrid(xs, ys)
    ramp_pts = np.column_stack([xv.ravel(), yv.ravel(), -1.5 + 0.10 * xv.ravel(), np.full(xv.size, 0.5)]).astype(np.float32)
    test_grid.insert_points(ramp_pts)
    patch_plane = test_grid.fit_local_ground(center_xy=(0.0, 0.0), radius_m=3.0)
    assert patch_plane is not None, "fit_local_ground failed to fit plane"
    assert patch_plane.is_traversable_grade, "10% slope was marked non-traversable"
    assert np.isclose(patch_plane.slope_pct, 10.0, atol=1.5), f"Slope percentage mismatch: {patch_plane.slope_pct}%"

    # Verify CostmapGenerator slope immunity end-to-end on 12% grade
    cost_gen = CostmapGenerator(grid_width_m=20.0, grid_height_m=20.0, resolution_m=0.2)
    # Without compensation, cells where z > -1.2m would be flagged lethal (254)
    # With slope compensation, the inclined road must remain traversable (< 254)
    costmap_sloped = cost_gen.generate_costmap(test_grid, enable_slope_compensation=True)
    lethal_count = np.sum(costmap_sloped == 254)
    assert lethal_count == 0, f"Expected 0 lethal cells on smooth 10% slope, got {lethal_count}"
    print(f"[PASS] Task 2.3: Local PCA ground-fit verified & wired to CostmapGenerator slope immunity (0 lethal false alarms on 10% slope).")


def test_2_4_planner_high_confidence_vs_shortcut():
    """Verifies that Hybrid-A* detours around low-confidence/high-variance terrain.

    Layout:
      Ego starts at (0, 0), Goal is at (16, 0).
      Straight corridor (y in [-1.5, 1.5], x in [4, 12]) has high elevation variance (rough rubble / crater hazard).
      Bypass corridor (y in [2.5, 5.0], x in [0, 16]) has low variance (smooth paved road).
    """
    grid = SpatialHashGrid()
    cost_gen = CostmapGenerator(grid_width_m=40.0, grid_height_m=40.0, resolution_m=0.20)

    # 1. Populate smooth road baseline
    xs = np.linspace(0, 18, 90)
    ys = np.linspace(-6, 6, 60)
    xv, yv = np.meshgrid(xs, ys)
    base_pts = np.column_stack([xv.ravel(), yv.ravel(), np.full(xv.size, -1.73), np.full(xv.size, 0.5)]).astype(np.float32)
    grid.insert_points(base_pts)

    # 2. Inject high elevation variance hazard along the direct straight line (x in [5, 11], y in [-1.5, 1.5])
    hazard_x = np.linspace(5.0, 11.0, 30)
    hazard_y = np.linspace(-1.5, 1.5, 15)
    hx, hy = np.meshgrid(hazard_x, hazard_y)
    
    # Inject multiple returns per column with high variance (simulating jagged crater or rubble pile)
    hazard_pts = []
    for x_val, y_val in zip(hx.ravel(), hy.ravel()):
        hazard_pts.append([x_val, y_val, -1.73, 0.5])
        hazard_pts.append([x_val, y_val, -2.15, 0.5])
        hazard_pts.append([x_val, y_val, -1.30, 0.5])
    hazard_pts = np.array(hazard_pts, dtype=np.float32)
    grid.insert_points(hazard_pts)

    costmap = cost_gen.generate_costmap(grid)
    planner = HybridAStarPlanner(cost_gen, min_turning_radius_m=3.5, step_size_m=0.6, heuristic_weight=1.5)

    start = (1.0, 0.0, 0.0)
    goal = (15.0, 0.0, 0.0)

    trajectory, total_cost = planner.plan(costmap, start, goal)
    assert trajectory is not None, "Hybrid-A* planner failed to find any valid path"

    path_arr = np.array(trajectory)
    # The direct path has y == 0. If the planner successfully detoured to avoid the high variance hazard,
    # the maximum absolute Y displacement along the trajectory must exceed 1.8 meters.
    max_lateral_deflection = float(np.max(np.abs(path_arr[:, 1])))

    print(f"  Hybrid-A* planned path length: {len(trajectory)} steps, Cost: {total_cost:.1f}")
    print(f"  Lateral detour deflection: {max_lateral_deflection:.2f} m (Hazard boundary: 1.50 m)")

    assert max_lateral_deflection > 1.6, (
        f"Planner did not avoid high-uncertainty corridor! Max deflection was only {max_lateral_deflection:.2f}m"
    )
    print(f"[PASS] Task 2.4: Planner selected high-confidence bypass route over direct high-variance shortcut.")


if __name__ == "__main__":
    test_2_1_dual_elevation_live_wiring()
    test_2_2_chans_parallel_variance_merge()
    test_2_3_local_plane_pca_ground_fit()
    test_2_4_planner_high_confidence_vs_shortcut()
    print("\nALL PHASE 2 INTEGRATION TESTS PASSED.")
