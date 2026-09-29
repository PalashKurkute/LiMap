"""Dual-Rate Asynchronous Perception Pipeline for Real-Time Autonomous Navigation.

Decouples high-frequency spatial mapping (10-50 Hz) from deep semantic
segmentation inference (2-5 Hz):
- Fast Path (Sync, 10-50 Hz): Point cloud ingestion, deskewing, spatial hash
  insertion, Welford variance tracking, and Nav2 costmap rasterization.
- Slow Path (Async Worker, 2-5 Hz): SalsaNext ONNX neural network inference
  running non-blocking in a dedicated background worker thread.
"""

from __future__ import annotations

import queue
import threading
import time
from typing import Optional, Tuple
import numpy as np

from core.grid.spatial_hash import SpatialHashGrid
from core.planning.costmap_generator import CostmapGenerator
from core.perception.segmentation_infer import SemanticSegmentationEngine


class DualRatePipeline:
    """Decoupled Dual-Rate perception pipeline for 10+ Hz real-time operation."""

    def __init__(
        self,
        grid: Optional[SpatialHashGrid] = None,
        costmap_generator: Optional[CostmapGenerator] = None,
        segmentation_engine: Optional[SemanticSegmentationEngine] = None,
        onnx_model_path: Optional[str] = None,
        use_gpu: bool = False,
    ):
        self.grid = grid or SpatialHashGrid()
        self.costmap_generator = costmap_generator or CostmapGenerator()
        self.seg_engine = segmentation_engine or SemanticSegmentationEngine(
            onnx_model_path=onnx_model_path, use_gpu=use_gpu
        )

        self._input_queue: queue.Queue[Optional[Tuple[int, np.ndarray]]] = queue.Queue(maxsize=1)
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: Optional[threading.Thread] = None

        self._frame_count: int = 0
        self._latest_semantics: Optional[np.ndarray] = None
        self._latest_semantics_frame: int = -1
        self._worker_busy: bool = False

    def start(self) -> None:
        """Starts the background semantic inference worker thread."""
        if self._worker_thread is not None and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(
            target=self._inference_worker_loop,
            name="SalsaNextAsyncWorker",
            daemon=True,
        )
        self._worker_thread.start()

    def stop(self, timeout: float = 2.0) -> None:
        """Stops the background worker thread gracefully."""
        self._stop_event.set()
        try:
            self._input_queue.put_nowait(None)
        except queue.Full:
            pass
        if self._worker_thread is not None and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=timeout)
        self._worker_thread = None

    def __enter__(self) -> DualRatePipeline:
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.stop()

    def _inference_worker_loop(self) -> None:
        """Background loop executing SalsaNext forward passes."""
        while not self._stop_event.is_set():
            try:
                item = self._input_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if item is None or self._stop_event.is_set():
                break

            frame_idx, pts = item
            try:
                sem_labels = self.seg_engine.infer(pts)
                with self._lock:
                    self._latest_semantics = sem_labels
                    self._latest_semantics_frame = frame_idx
            except Exception as e:
                # Log or handle gracefully without crashing worker
                pass
            finally:
                self._worker_busy = False
                self._input_queue.task_done()

    def step(
        self,
        pts: np.ndarray,
        reset_grid: bool = True,
        enable_slope_compensation: bool = True,
    ) -> Tuple[SpatialHashGrid, np.ndarray, Optional[np.ndarray]]:
        """Executes a single synchronous Fast Path frame (10-50 Hz).
        
        Args:
            pts: (N, 3+) LiDAR point cloud.
            reset_grid: If True, resets spatial hash before insertion.
            enable_slope_compensation: Distinguishes traversable grade from obstacles.
        Returns:
            Tuple of (grid, costmap, latest_semantics).
        """
        curr_frame = self._frame_count
        self._frame_count += 1

        # Submit to background worker if idle
        if not self._worker_busy and self._worker_thread is not None and self._worker_thread.is_alive():
            try:
                self._input_queue.put_nowait((curr_frame, pts))
                self._worker_busy = True
            except queue.Full:
                pass

        with self._lock:
            active_sem = self._latest_semantics

        # Fast Path spatial mapping
        if reset_grid:
            self.grid.reset()

        # Insert points with available semantics (if lengths match or None)
        sem_to_insert = None
        if active_sem is not None and len(active_sem) == len(pts):
            sem_to_insert = active_sem

        self.grid.insert_points(pts, semantic_labels=sem_to_insert)
        costmap = self.costmap_generator.generate_costmap(
            self.grid,
            enable_slope_compensation=enable_slope_compensation,
        )

        return self.grid, costmap, active_sem

    @property
    def latest_semantics(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._latest_semantics
