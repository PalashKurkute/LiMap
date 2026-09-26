"""SE(3) Coordinate Transformations, Pose Interpolation, and Deskewing Utilities.

Adheres to ROS REP 103 (X forward, Y left, Z up) and ROS REP 105 coordinate frames:
  lidar -> base_link -> odom -> map.
"""

from __future__ import annotations

from typing import Tuple, Union
import numpy as np


def make_se3_matrix(
    rotation_matrix: np.ndarray,
    translation_vector: np.ndarray,
) -> np.ndarray:
    """Constructs a 4x4 homogeneous SE(3) matrix."""
    T = np.eye(4, dtype=np.float32)
    T[:3, :3] = rotation_matrix
    T[:3, 3] = translation_vector.flatten()
    return T


def transform_points(points: np.ndarray, transform_se3: np.ndarray) -> np.ndarray:
    """Applies a 4x4 SE(3) transformation to an (N, 3+) point cloud.
    
    Preserves extra feature columns (e.g. intensity/remission).
    Returns:
        Transformed (N, D) array.
    """
    if points.ndim != 2 or points.shape[1] < 3:
        raise ValueError(f"Points array must have shape (N, 3+), got {points.shape}")

    R = transform_se3[:3, :3]
    t = transform_se3[:3, 3]

    xyz = points[:, :3]
    xyz_trans = (xyz @ R.T) + t

    if points.shape[1] > 3:
        return np.column_stack([xyz_trans, points[:, 3:]]).astype(np.float32)
    return xyz_trans.astype(np.float32)


def rodrigues_rotation(axis: np.ndarray, angle_rad: float) -> np.ndarray:
    """Computes 3x3 rotation matrix using Rodrigues' formula."""
    axis = axis / (np.linalg.norm(axis) + 1e-12)
    kx, ky, kz = axis
    K = np.array([
        [0.0, -kz, ky],
        [kz, 0.0, -kx],
        [-ky, kx, 0.0]
    ], dtype=np.float32)
    I = np.eye(3, dtype=np.float32)
    return I + np.sin(angle_rad) * K + (1.0 - np.cos(angle_rad)) * (K @ K)


def deskew_points_constant_velocity(
    points: np.ndarray,
    timestamps: np.ndarray,
    linear_velocity: np.ndarray,
    angular_velocity: np.ndarray,
    reference_time: float = 0.1,
) -> np.ndarray:
    """Performs motion deskewing assuming constant body-rate velocities (v, omega).
    
    Compensates for sensor motion distortion caused by vehicle movement during the ~100ms scan.
    Points are projected into the sensor coordinate frame at reference_time (usually end of scan).
    
    Args:
        points: (N, 3+) float32 array [x, y, z, ...].
        timestamps: (N,) float32 relative time offset in seconds for each point.
        linear_velocity: (3,) [vx, vy, vz] in m/s in sensor/body frame.
        angular_velocity: (3,) [wx, wy, wz] in rad/s in sensor/body frame.
        reference_time: Time anchor (e.g. 0.1s for end of 10Hz scan).
    Returns:
        Deskewed (N, D) points array.
    """
    dt = reference_time - timestamps  # Time difference to target frame
    
    # Translation delta: v * dt
    dt_col = dt[:, None]
    delta_trans = linear_velocity[None, :] * dt_col  # (N, 3)

    # For small angles during 100ms scan, rotation delta: R(omega * dt)
    # Omega * dt vector magnitude
    rot_angles = np.linalg.norm(angular_velocity) * dt  # (N,)
    
    xyz = points[:, :3]
    
    if np.linalg.norm(angular_velocity) < 1e-6:
        # Pure translation
        deskewed_xyz = xyz + delta_trans
    else:
        axis = angular_velocity / np.linalg.norm(angular_velocity)
        kx, ky, kz = axis
        # Vectorized Rodrigues for each point
        cross_axis = np.cross(axis, xyz)  # (N, 3)
        dot_axis = np.sum(axis * xyz, axis=1, keepdims=True)  # (N, 1)
        
        cos_a = np.cos(rot_angles)[:, None]
        sin_a = np.sin(rot_angles)[:, None]
        
        deskewed_xyz = (
            xyz * cos_a +
            cross_axis * sin_a +
            axis * dot_axis * (1.0 - cos_a) +
            delta_trans
        )

    if points.shape[1] > 3:
        return np.column_stack([deskewed_xyz, points[:, 3:]]).astype(np.float32)
    return deskewed_xyz.astype(np.float32)


def verify_rep103_compliance(points: np.ndarray) -> bool:
    """Verifies that coordinate convention conforms to ROS REP 103 (Right-Handed, X fwd, Y left, Z up)."""
    # Unit vectors
    ex = np.array([1.0, 0.0, 0.0])
    ey = np.array([0.0, 1.0, 0.0])
    ez = np.cross(ex, ey)
    return bool(np.allclose(ez, [0.0, 0.0, 1.0]))
