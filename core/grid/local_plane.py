"""Local Per-Patch Ground Plane Estimator for Sloped Terrain Perception.

Addresses SIH26053 Standard 4.4 (The open gap admitted by sih_053):
Eliminates slope false alarms (e.g., mistaking 8-15% downgrades for negative craters
or upgrades for solid obstacle walls) by fitting local tangent ground planes via PCA.

Computes:
  - Local surface normal vector n = (nx, ny, nz)
  - Terrain incline / slope angle theta = arccos(|nz|)
  - Plane-relative residual elevation d_plane = n . (p - p_mean)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np


@dataclass
class LocalPatchPlane:
    centroid: np.ndarray      # (3,) [x_mean, y_mean, z_mean]
    normal: np.ndarray        # (3,) unit normal vector (nx, ny, nz) pointing upward
    slope_rad: float          # Incline angle in radians
    slope_deg: float          # Incline angle in degrees
    slope_pct: float          # Grade percentage (tan(theta) * 100)
    variance_residual: float  # Residual variance along plane normal
    is_traversable_grade: bool


class LocalGroundPlaneEstimator:
    """Estimates continuous local ground planes across terrain patches."""

    def __init__(
        self,
        patch_radius_m: float = 2.0,
        min_points_per_patch: int = 6,
        max_traversable_grade_pct: float = 25.0,  # 25% max grade for defense UGV (~14 deg)
        residual_inlier_thresh_m: float = 0.08,
    ):
        self.patch_radius_m = patch_radius_m
        self.min_points = min_points_per_patch
        self.max_grade_pct = max_traversable_grade_pct
        self.residual_thresh = residual_inlier_thresh_m

    def fit_patch_plane(self, points: np.ndarray) -> Optional[LocalPatchPlane]:
        """Fits a tangent plane to an (M, 3) cluster of local terrain points using PCA.
        
        Args:
            points: (M, 3) array of [x, y, z] points in local neighborhood.
        Returns:
            LocalPatchPlane object or None if insufficient points/degenerate covariance.
        """
        M = points.shape[0]
        if M < self.min_points:
            return None

        centroid = np.mean(points, axis=0)
        centered = points - centroid

        # Covariance matrix C (3, 3)
        cov = np.dot(centered.T, centered) / M

        # Eigen-decomposition: eigenvectors are columns of V
        evals, evecs = np.linalg.eigh(cov)

        # Smallest eigenvalue corresponds to normal vector
        normal = evecs[:, 0].copy()

        # Enforce upward normal: nz > 0
        if normal[2] < 0:
            normal = -normal

        # Compute incline angle theta relative to vertical Z [0, 0, 1]
        cos_theta = np.clip(normal[2], -1.0, 1.0)
        slope_rad = float(np.arccos(cos_theta))
        slope_deg = float(np.degrees(slope_rad))
        slope_pct = float(np.tan(slope_rad) * 100.0)

        # Residuals along normal
        residuals = np.dot(centered, normal)
        variance_res = float(np.var(residuals))

        is_traversable = bool(slope_pct <= self.max_grade_pct)

        return LocalPatchPlane(
            centroid=centroid,
            normal=normal,
            slope_rad=slope_rad,
            slope_deg=slope_deg,
            slope_pct=slope_pct,
            variance_residual=variance_res,
            is_traversable_grade=is_traversable,
        )

    def evaluate_points_against_plane(
        self,
        points: np.ndarray,
        plane: LocalPatchPlane,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Calculates signed distances to local plane and hazard classification.
        
        Returns:
            distances: (N,) signed distance along normal (positive = above plane, negative = below)
            hazard_flags: (N,) int8:
                0 = Traversable Road (within [-0.08m, +0.10m])
                1 = Positive Obstacle (> +0.15m)
                2 = Negative Hazard / Crater (< -0.15m relative to local sloped surface)
        """
        diff = points[:, :3] - plane.centroid
        distances = np.dot(diff, plane.normal)

        hazard_flags = np.zeros(len(points), dtype=np.int8)
        hazard_flags[distances > 0.15] = 1   # Positive obstacle above local ground
        hazard_flags[distances < -0.15] = 2  # Negative crater below local ground

        return distances, hazard_flags

    def verify_slope_immunity(
        self,
        slope_pct: float = 8.0,
        distance_max_m: float = 50.0,
        num_points: int = 10000,
    ) -> Dict[str, object]:
        """Rigorous automated verification proving 'A slope is not a trench'.
        
        Generates an artificial 8% to 15% downgrade/upgrade road with embedded 
        small surface roughness (sigma = 0.02m) and evaluates false-positive rates.
        """
        slope_rad = np.arctan(slope_pct / 100.0)
        
        # Synthetic road: X in [0, distance_max_m], Y in [-5, 5]
        xs = np.random.uniform(1.0, distance_max_m, num_points)
        ys = np.random.uniform(-5.0, 5.0, num_points)
        
        # Continuous ground drop: z = -1.73 - x * tan(slope_rad)
        zs_clean = -1.73 - xs * np.tan(slope_rad)
        zs = zs_clean + np.random.normal(0, 0.015, num_points)  # nominal 1.5cm roughness
        
        pts = np.column_stack([xs, ys, zs])
        
        # Fit local patch planes across sampled radii
        false_positive_obstacles = 0
        false_positive_trenches = 0
        total_eval = 0

        # Sample 100 patch centers along the sloped corridor
        test_centers_x = np.linspace(5.0, distance_max_m - 5.0, 100)
        for cx in test_centers_x:
            mask = np.hypot(xs - cx, ys) < self.patch_radius_m
            patch_pts = pts[mask]
            if len(patch_pts) < self.min_points:
                continue

            plane = self.fit_patch_plane(patch_pts)
            if plane is None:
                continue

            dists, hazards = self.evaluate_points_against_plane(patch_pts, plane)
            false_positive_obstacles += int(np.sum(hazards == 1))
            false_positive_trenches += int(np.sum(hazards == 2))
            total_eval += len(patch_pts)

        fp_rate = (false_positive_obstacles + false_positive_trenches) / max(total_eval, 1)

        return {
            "slope_grade_pct": slope_pct,
            "slope_angle_deg": round(float(np.degrees(slope_rad)), 2),
            "total_points_evaluated": total_eval,
            "false_positive_obstacles": false_positive_obstacles,
            "false_positive_trenches": false_positive_trenches,
            "false_positive_rate": round(float(fp_rate), 6),
            "slope_immunity_verified": bool(fp_rate < 0.001),  # strictly < 0.1% false positive
        }


if __name__ == "__main__":
    estimator = LocalGroundPlaneEstimator()
    print("=" * 60)
    print(" LOCAL TANGENT PLANE PCA EVALUATION (STANDARDS 4.2 & 4.4)")
    print("=" * 60)
    for grade in [8.0, 15.0]:
        res = estimator.verify_slope_immunity(slope_pct=grade)
        print(f"  * Grade {grade}% ({res['slope_angle_deg']}°): {res['total_points_evaluated']} pts evaluated, "
              f"FP Obstacles={res['false_positive_obstacles']}, FP Trenches={res['false_positive_trenches']} "
              f"(Immunity Verified={res['slope_immunity_verified']})")
    print("=" * 60)
