"""Unit tests for DualRatePipeline asynchronous decoupling."""

import unittest
import numpy as np
from core.perception.async_pipeline import DualRatePipeline


class TestDualRatePipeline(unittest.TestCase):

    def test_lifecycle_and_step(self):
        pipeline = DualRatePipeline()
        pipeline.start()
        try:
            # Synthetic point cloud
            pts = np.random.uniform(-20, 20, (1000, 4)).astype(np.float32)
            pts[:, 2] = -1.73  # nominal ground level

            grid, costmap, sem = pipeline.step(pts)
            cg = pipeline.costmap_generator
            self.assertEqual(costmap.shape, (cg.ny, cg.nx))
            self.assertGreater(grid.active_count, 0)
        finally:
            pipeline.stop()

    def test_context_manager(self):
        with DualRatePipeline() as pipeline:
            pts = np.random.uniform(-10, 10, (500, 4)).astype(np.float32)
            grid, costmap, sem = pipeline.step(pts)
            self.assertIsNotNone(costmap)


if __name__ == "__main__":
    unittest.main()
