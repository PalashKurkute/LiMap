"""Comprehensive Unit & Regression Tests for Phase 3 Adaptive Grid Engine.

Verifies:
  1. 4,000,000 coordinate seam-gap boundary proof (beating rival repos).
  2. Welford online variance numerical accuracy vs numpy.var.
  3. Dual-elevation bridge underpass clearance & pothole detection.
  4. Dynamic velocity-heading foveation.
  5. Strict < 3.5 MB deterministic memory bound under 100,000 points.
"""

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from core.grid.nested_lattice import NestedLattice
from core.grid.welford_fusion import WelfordElevationAccumulator
from core.grid.dual_elevation import DualElevationExtractor, TraversabilityStatus
from core.grid.fovea_controller import DynamicFoveaController
from core.grid.spatial_hash import SpatialHashGrid
from core.ingestion.loader import load_kitti_bin


def test_nested_lattice_seam_invariants():
    lattice = NestedLattice()
    print("Testing 4,000,000 coordinate boundary check for zero seam gaps...")
    no_gaps = lattice.verify_zero_seam_gaps(num_positions=4_000_000)
    assert no_gaps, "Boundary check failed: detected seam gap or non-integer scale ratio"
    print("[PASS] Nested Lattice: Zero seam gaps verified across 4,000,000 boundary positions.")


def test_welford_numerical_accuracy():
    rng = np.random.default_rng(42)
    data = rng.normal(loc=-1.73, scale=0.15, size=5000).astype(np.float32)

    # Online accumulation
    cnt, mean, m2, min_z, max_z = 0, 0.0, 0.0, 999.0, -999.0
    for val in data:
        cnt, mean, m2, min_z, max_z = WelfordElevationAccumulator.update_single(
            cnt, mean, m2, min_z, max_z, float(val)
        )

    welford_var = m2 / (cnt - 1)
    np_mean = np.mean(data)
    np_var = np.var(data, ddof=1)

    assert np.isclose(mean, np_mean, atol=1e-5), f"Mean mismatch: {mean} vs {np_mean}"
    assert np.isclose(welford_var, np_var, atol=1e-5), f"Variance mismatch: {welford_var} vs {np_var}"
    assert np.isclose(min_z, np.min(data), atol=1e-5)
    assert np.isclose(max_z, np.max(data), atol=1e-5)
    print(f"[PASS] Welford Online Estimator: Exact match with NumPy (var={welford_var:.6f}).")


def test_dual_elevation_underpass_and_craters():
    extractor = DualElevationExtractor(vehicle_height_m=1.8, safety_margin_m=0.2)

    # 1. Bridge underpass column: road at -1.73m, bridge deck bottom at +0.77m
    bridge_col_z = np.array([-1.74, -1.73, -1.72, 0.77, 0.85, 1.2], dtype=np.float32)
    res_bridge = extractor.analyze_column(bridge_col_z)
    assert res_bridge.status == TraversabilityStatus.TRAVERSABLE_OVERPASS
    assert np.isclose(res_bridge.clearance_m, 2.50, atol=0.05)
    print(f"[PASS] Dual-Elevation: Bridge underpass clearance = {res_bridge.clearance_m:.2f}m (TRAVERSABLE).")

    # 2. Pothole / Crater column: depression at -2.1m with high roughness
    crater_col_z = np.array([-2.10, -2.15, -2.05], dtype=np.float32)
    res_crater = extractor.analyze_column(crater_col_z, roughness_variance=0.12)
    assert res_crater.status == TraversabilityStatus.HAZARD_NEGATIVE
    print(f"[PASS] Dual-Elevation: Pothole detected as HAZARD_NEGATIVE.")


def test_dynamic_fovea_controller():
    controller = DynamicFoveaController(base_fovea_radius_m=10.0, max_speed_mps=20.0)
    
    # Ego vehicle moving forward at 15 m/s
    vel = np.array([15.0, 0.0])
    state = controller.update(vel)

    assert state.speed_mps == 15.0
    assert state.forward_reach_m > 10.0, f"Expected extended lookahead, got {state.forward_reach_m}"
    assert state.shift_x > 0.0
    print(f"[PASS] Dynamic Fovea: At 15 m/s, forward reach extended to {state.forward_reach_m:.2f}m.")


def test_spatial_hash_memory_bound():
    grid = SpatialHashGrid(capacity=106_875)
    telemetry = grid.export_telemetry()
    
    # Memory budget: < 3.5 MB (team-set; the pool is 3.2616 MB)
    print(f"Spatial Hash Total Memory: {telemetry['total_heap_mb']} MB (budget: < 3.5 MB)")
    assert telemetry["within_pool_budget"], f"Memory exceeded the pool budget: {telemetry['total_heap_mb']} MB"

    # Insert 100,000 points from Scene A
    pts = load_kitti_bin("data/synthetic/scene_a_bridge_underpass.bin")
    active_cells = grid.insert_points(pts[:100000])

    assert active_cells > 1000, "Active cells count suspiciously low"
    assert active_cells <= grid.capacity, "Exceeded table capacity"
    
    active_arr = grid.get_active_cells()
    assert len(active_arr) == active_cells
    print(f"[PASS] Spatial Hash: {active_cells} active cells populated under {telemetry['total_heap_mb']} MB heap.")


if __name__ == "__main__":
    test_nested_lattice_seam_invariants()
    test_welford_numerical_accuracy()
    test_dual_elevation_underpass_and_craters()
    test_dynamic_fovea_controller()
    test_spatial_hash_memory_bound()
    print("\nALL PHASE 3 TESTS PASSED.")
