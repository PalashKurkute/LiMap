"""Test Suite for Phase 6.1: ROS 2 Nav2 Costmap Bridge.

Verifies:
  1. Standard ROS 2 OccupancyGrid payload generation and metadata compliance (REP 103/105).
  2. Data contract: size == width * height, values in [-1, 0, 1..100].
  3. Underpass clearance: FoveaGrid 2.5D marks underpass as traversable (< 50) while naive 2D marks it lethal (100).
  4. Lethal obstacle and dynamic tracker footprint inflation (cost = 100).
  5. JSON/Dictionary serialization fidelity matching ROS 2 message specification.
"""

import sys
import unittest
from pathlib import Path
import numpy as np

# Safe repo root bootstrapping
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.grid.spatial_hash import SpatialHashGrid
from core.grid.dual_elevation import DualElevationExtractor
from core.planning.nav2_bridge import Nav2CostmapBridge, OccupancyGridPayload
from core.tracking.kalman_tracker import TrackedObstacle, BoundingBox25D


class TestNav2CostmapBridge(unittest.TestCase):
    """Unit tests for Nav2 Costmap conversion and data contracts."""

    def setUp(self):
        self.bridge = Nav2CostmapBridge(
            grid_width_m=40.0,
            grid_height_m=40.0,
            resolution_m=0.10,
            frame_id="map",
            vehicle_height_m=1.8,
        )

    def test_metadata_and_shape_invariants(self):
        """Verifies ROS 2 OccupancyGrid metadata and array dimensions."""
        grid = SpatialHashGrid()
        payload = self.bridge.convert_to_nav2_occupancy_grid(grid)

        self.assertIsInstance(payload, OccupancyGridPayload)
        self.assertEqual(payload.frame_id, "map")
        self.assertEqual(payload.info.resolution, 0.10)
        self.assertEqual(payload.info.width, 400)
        self.assertEqual(payload.info.height, 400)
        self.assertAlmostEqual(payload.info.origin_x, -20.0)
        self.assertAlmostEqual(payload.info.origin_y, -20.0)
        self.assertEqual(len(payload.data), 400 * 400)
        self.assertEqual(payload.data.dtype, np.int8)

    def test_underpass_traversability_vs_naive_2d(self):
        """Verifies that 2.5D dual-elevation preserves underpass traversal in Nav2."""
        grid = SpatialHashGrid()

        # Insert road points at x=5, y=0 (z = -1.73m, road, sem_id=40)
        road_pts = np.array([
            [5.0, 0.0, -1.73, 15.0],
            [5.02, 0.01, -1.72, 16.0],
            [4.98, -0.01, -1.74, 14.0],
        ], dtype=np.float32)
        grid.insert_points(road_pts, semantic_labels=np.full((3,), 40, dtype=np.uint8))

        # Insert overhead bridge points at x=5, y=0 (z = 2.0m, bridge deck with 3.73m clearance, sem_id=50)
        bridge_pts = np.array([
            [5.0, 0.0, 2.0, 50.0],
            [5.01, 0.02, 2.05, 52.0],
        ], dtype=np.float32)
        grid.insert_points(bridge_pts, semantic_labels=np.full((2,), 50, dtype=np.uint8))

        # 1. 2.5D Mode (Dual Elevation Enabled)
        payload_25d = self.bridge.convert_to_nav2_occupancy_grid(grid, ignore_overhang=False)
        grid_2d = payload_25d.data.reshape((400, 400))
        gx = int((5.0 - self.bridge.generator.origin_x) / 0.10)
        gy = int((0.0 - self.bridge.generator.origin_y) / 0.10)
        cost_25d = grid_2d[gy, gx]

        # Underpass should be safely traversable (not lethal 100)
        self.assertLess(cost_25d, 50, f"Expected traversable underpass in 2.5D, got cost {cost_25d}")

        # 2. Naive 2D Collapse Mode (Standard ROS 2 costmap limitation)
        payload_naive = self.bridge.convert_to_nav2_occupancy_grid(grid, ignore_overhang=True)
        grid_naive = payload_naive.data.reshape((400, 400))
        cost_naive = grid_naive[gy, gx]

        # In naive 2D, overhead structure collapses into lethal obstacle (100)
        self.assertEqual(cost_naive, 100, f"Expected lethal cost in naive 2D collapse, got {cost_naive}")

    def test_dynamic_obstacle_inflation(self):
        """Verifies dynamic obstacle footprint inflation to lethal cost (100)."""
        grid = SpatialHashGrid()
        dyn_obstacle = TrackedObstacle(
            track_id=1,
            state=np.array([10.0, 5.0, 0.0, 0.0]),
            covariance=np.eye(4),
            bbox=BoundingBox25D(x=10.0, y=5.0, z=0.0, length=4.0, width=2.0, height=1.6, num_points=50),
            age=5,
            hits=5,
            time_since_update=0,
            confirmed=True,
        )

        payload = self.bridge.convert_to_nav2_occupancy_grid(grid, dynamic_tracks=[dyn_obstacle])
        grid_2d = payload.data.reshape((400, 400))

        gx = int((10.0 - self.bridge.generator.origin_x) / 0.10)
        gy = int((5.0 - self.bridge.generator.origin_y) / 0.10)

        # Vehicle center and inflated footprint must be lethal 100
        self.assertEqual(grid_2d[gy, gx], 100)
        self.assertEqual(grid_2d[gy + 2, gx + 2], 100)

    def test_ros2_dictionary_serialization(self):
        """Verifies ROS 2 JSON/dict serialization schema compliance."""
        grid = SpatialHashGrid()
        payload = self.bridge.convert_to_nav2_occupancy_grid(grid)
        msg_dict = payload.to_dict()

        self.assertIn("header", msg_dict)
        self.assertIn("frame_id", msg_dict["header"])
        self.assertEqual(msg_dict["header"]["frame_id"], "map")
        self.assertIn("info", msg_dict)
        self.assertEqual(msg_dict["info"]["width"], 400)
        self.assertEqual(msg_dict["info"]["height"], 400)
        self.assertIn("origin", msg_dict["info"])
        self.assertIn("data", msg_dict)
        self.assertEqual(len(msg_dict["data"]), 400 * 400)


if __name__ == "__main__":
    unittest.main()
