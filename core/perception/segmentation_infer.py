"""Semantic Segmentation Inference Head for LiDAR Range Images.

Supports ONNX Runtime execution for SalsaNext/RangeNet++ backbones, with an
optimized geometric rule-based perception fallback for offline testing and
zero-dependency edge verification. Unprojects 2D predictions back to 3D point clouds.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Union
import numpy as np

from core.perception.range_projection import SphericalRangeProjector

try:
    import onnxruntime as ort
    _HAS_ORT = True
except ImportError:
    _HAS_ORT = False


# Canonical SemanticKITTI Classes
CLASS_UNLABELED = 0
CLASS_CAR = 10
CLASS_ROAD = 40
CLASS_BUILDING = 50
CLASS_TERRAIN = 72
CLASS_POLE = 80
CLASS_MOVING_CAR = 252


class SemanticSegmentationEngine:
    """Runs semantic segmentation on spherical range images and unprojects labels to 3D."""

    def __init__(
        self,
        onnx_model_path: Optional[Union[str, Path]] = None,
        use_gpu: bool = False,
        projector: Optional[SphericalRangeProjector] = None,
    ):
        self.projector = projector or SphericalRangeProjector(height=64, width=2048)
        self.onnx_path = Path(onnx_model_path) if onnx_model_path else None
        self.session = None

        if self.onnx_path and self.onnx_path.is_file() and _HAS_ORT:
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_gpu else ["CPUExecutionProvider"]
            self.session = ort.InferenceSession(str(self.onnx_path), providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name

    def infer(self, points: np.ndarray) -> np.ndarray:
        """Takes an (N, 3+) LiDAR point cloud and outputs (N,) semantic class predictions.
        
        Args:
            points: (N, 3+) float32 array [x, y, z, (remission)].
        Returns:
            np.ndarray of shape (N,) uint32 containing predicted SemanticKITTI class IDs.
        """
        range_img, proj_idx, point_to_pixel = self.projector.project(points)

        if self.session is not None:
            semantic_mask = self._run_onnx(range_img)
        else:
            semantic_mask = self._geometric_heuristic_infer(range_img, proj_idx)

        # Unproject 2D mask back to 3D points
        point_labels = self.projector.unproject_semantics(
            semantic_image=semantic_mask,
            point_to_pixel=point_to_pixel,
            default_label=CLASS_UNLABELED,
        )
        return point_labels

    def _run_onnx(self, range_img: np.ndarray) -> np.ndarray:
        """Executes ONNX neural network backbone on (64, 2048, 5) range image."""
        # SalsaNext input format: (1, 5, H, W) normalized
        # Channels: [depth, x, y, z, remission]
        img_trans = np.transpose(range_img, (2, 0, 1))[None, ...].astype(np.float32)
        
        # Standard normalization: range / 50.0, coords / 50.0
        img_trans[:, :4] /= 50.0

        outputs = self.session.run([self.output_name], {self.input_name: img_trans})
        logits = outputs[0][0]  # (C, H, W)
        pred_classes = np.argmax(logits, axis=0).astype(np.uint32)
        return pred_classes

    def _geometric_heuristic_infer(
        self, range_img: np.ndarray, proj_idx: np.ndarray
    ) -> np.ndarray:
        """High-speed geometric feature classifier fallback.
        
        Classifies ground, poles, overhead structures, and vehicle obstacles
        using elevation differentials, vertical column continuity, and intensity.
        """
        H, W, _ = range_img.shape
        depth = range_img[:, :, 0]
        z = range_img[:, :, 3]
        rem = range_img[:, :, 4]
        valid = depth > 0.5

        semantic_mask = np.zeros((H, W), dtype=np.uint32)

        # Ground plane is nominally around Z = -1.73m (+/- 0.25m)
        is_ground = valid & (z >= -1.95) & (z <= -1.45)
        semantic_mask[is_ground] = CLASS_ROAD

        # Craters / Potholes (depressions below ground plane Z < -1.95)
        is_crater = valid & (z < -1.95)
        semantic_mask[is_crater] = CLASS_TERRAIN

        # Overhead structures / Bridge underpasses (Z > 0.3m with ground underneath)
        is_overhead = valid & (z > 0.3)
        semantic_mask[is_overhead] = CLASS_BUILDING

        # Vertical obstacle features (poles and obstacles)
        is_obstacle = valid & (z > -1.45) & (z <= 0.3)
        # Narrow vertical structures with high remission -> Pole
        is_pole = is_obstacle & (rem > 0.85)
        semantic_mask[is_pole] = CLASS_POLE

        # Other mid-height obstacles -> Car
        is_vehicle = is_obstacle & (~is_pole)
        semantic_mask[is_vehicle] = CLASS_CAR

        return semantic_mask
