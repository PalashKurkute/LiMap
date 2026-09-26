"""High-Performance LiDAR Point Cloud Loader and Sanitizer.

Supports SemanticKITTI / Velodyne binary formats (.bin, .label), PCD files,
and synthetic test datasets. Employs memory-mapping (np.memmap) for zero-copy streaming.
Adheres strictly to ROS REP 103 coordinates.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Tuple, Union
import numpy as np


def load_kitti_bin(
    bin_path: Union[str, Path],
    use_mmap: bool = False,
) -> np.ndarray:
    """Loads SemanticKITTI/Velodyne format binary point cloud.
    
    Each point consists of 4 single-precision float32 values: [x, y, z, remission].
    Returns:
        np.ndarray of shape (N, 4) with dtype float32.
    """
    path = Path(bin_path)
    if not path.is_file():
        raise FileNotFoundError(f"LiDAR binary file not found: {bin_path}")

    if use_mmap:
        raw = np.memmap(path, dtype=np.float32, mode="r")
    else:
        raw = np.fromfile(path, dtype=np.float32)

    if raw.size % 4 != 0:
        raise ValueError(
            f"Corrupt binary file {bin_path}: size {raw.size} floats is not divisible by 4."
        )

    return raw.reshape(-1, 4)


def load_kitti_label(
    label_path: Union[str, Path],
    use_mmap: bool = False,
) -> Tuple[np.ndarray, np.ndarray]:
    """Loads SemanticKITTI format label binary.
    
    Format: 32-bit unsigned integer per point.
      Lower 16 bits = semantic class ID.
      Upper 16 bits = instance ID.
    Returns:
        Tuple of (semantic_ids: uint16, instance_ids: uint16), each of shape (N,).
    """
    path = Path(label_path)
    if not path.is_file():
        raise FileNotFoundError(f"LiDAR label file not found: {label_path}")

    if use_mmap:
        raw = np.memmap(path, dtype=np.uint32, mode="r")
    else:
        raw = np.fromfile(path, dtype=np.uint32)

    semantic_id = (raw & 0xFFFF).astype(np.uint16)
    instance_id = (raw >> 16).astype(np.uint16)
    return semantic_id, instance_id


def sanitize_point_cloud(
    points: np.ndarray,
    min_range: float = 0.5,
    max_range: float = 120.0,
    labels: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, Optional[np.ndarray]]:
    """Filters out invalid NaN/Inf values, ego-vehicle reflections, and out-of-range returns.
    
    Args:
        points: (N, 3) or (N, 4) float32 array.
        min_range: Minimum Euclidean distance in meters (drops sensor body self-hits).
        max_range: Maximum Euclidean distance in meters.
        labels: Optional (N,) label array to keep synchronous.
    Returns:
        Filtered (M, D) points array and corresponding (M,) labels if provided.
    """
    if points.ndim != 2 or points.shape[1] < 3:
        raise ValueError(f"Points must have shape (N, 3+) but got {points.shape}")

    coords = points[:, :3]
    finite_mask = np.isfinite(coords).all(axis=1)

    r_sq = np.sum(coords[finite_mask] ** 2, axis=1)
    range_valid = (r_sq >= (min_range ** 2)) & (r_sq <= (max_range ** 2))

    valid_mask = np.zeros(points.shape[0], dtype=bool)
    valid_indices = np.where(finite_mask)[0][range_valid]
    valid_mask[valid_indices] = True

    sanitized_pts = points[valid_mask].copy()
    sanitized_lbl = labels[valid_mask].copy() if labels is not None else None

    return sanitized_pts, sanitized_lbl


def compute_azimuth_timestamps(
    points: np.ndarray,
    scan_frequency_hz: float = 10.0,
    clockwise: bool = True,
) -> np.ndarray:
    """Computes fractional scan timestamps delta_t in [0, 1/freq] from LiDAR azimuth angle.
    
    Velodyne and Ouster mechanical LiDARs rotate at a constant frequency (e.g. 10 Hz = 100ms).
    Beam firing timestamps correlate directly with azimuth angle around sensor Z-axis.
    Args:
        points: (N, 3+) array with X forward, Y left.
        scan_frequency_hz: Sensor rotation rate in Hertz.
        clockwise: True if LiDAR rotates clockwise viewed from top (+Z looking down).
    Returns:
        np.ndarray of shape (N,) float32 with relative timestamps in seconds [0.0, 1.0 / freq].
    """
    period = 1.0 / scan_frequency_hz
    # Azimuth angle in [-pi, pi] where 0 is along +X (forward)
    azimuth = np.arctan2(points[:, 1], points[:, 0])

    if clockwise:
        # Clockwise rotation: angle decreases as time increases: angle(t) = -omega * t + phi0
        # Map [-pi, pi] to [0, 2*pi) normalized scan fraction
        phase = (-azimuth) % (2.0 * np.pi)
    else:
        phase = azimuth % (2.0 * np.pi)

    fraction = phase / (2.0 * np.pi)
    return (fraction * period).astype(np.float32)
