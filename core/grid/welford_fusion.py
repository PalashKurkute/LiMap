"""Welford Online Bayesian Elevation Estimator for 2.5D Mapping.

Computes numerically stable running mean, variance, min, and max elevation per cell
without storing point histories. Handles single-point streaming and batch updates
via Chan's parallel algorithm. Elevation variance serves as terrain roughness indicator.
"""

from __future__ import annotations

from typing import Tuple
import numpy as np


class WelfordElevationAccumulator:
    """Manages online elevation statistics across cells."""

    @staticmethod
    def update_single(
        count: int,
        mean: float,
        m2: float,
        min_z: float,
        max_z: float,
        new_z: float,
    ) -> Tuple[int, float, float, float, float]:
        """Updates a single cell with one new elevation observation."""
        n = count + 1
        delta = new_z - mean
        new_mean = mean + delta / n
        delta2 = new_z - new_mean
        new_m2 = m2 + delta * delta2
        new_min = min(min_z, new_z) if count > 0 else new_z
        new_max = max(max_z, new_z) if count > 0 else new_z
        return n, new_mean, new_m2, new_min, new_max

    @staticmethod
    def combine_aggregates(
        count_a: np.ndarray,
        mean_a: np.ndarray,
        m2_a: np.ndarray,
        min_a: np.ndarray,
        max_a: np.ndarray,
        count_b: np.ndarray,
        mean_b: np.ndarray,
        m2_b: np.ndarray,
        min_b: np.ndarray,
        max_b: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Merges two sets of Welford statistics via Chan's parallel algorithm.
        
        Vectorized across cells.
        """
        total_count = count_a + count_b
        valid_both = (count_a > 0) & (count_b > 0)
        only_b = (count_a == 0) & (count_b > 0)

        out_mean = mean_a.copy()
        out_m2 = m2_a.copy()
        out_min = min_a.copy()
        out_max = max_a.copy()

        # Where only B has observations
        out_mean[only_b] = mean_b[only_b]
        out_m2[only_b] = m2_b[only_b]
        out_min[only_b] = min_b[only_b]
        out_max[only_b] = max_b[only_b]

        # Where both have observations
        if np.any(valid_both):
            na = count_a[valid_both]
            nb = count_b[valid_both]
            n_tot = total_count[valid_both]
            delta = mean_b[valid_both] - mean_a[valid_both]

            out_mean[valid_both] = mean_a[valid_both] + delta * (nb / n_tot)
            out_m2[valid_both] = (
                m2_a[valid_both] + m2_b[valid_both] + (delta ** 2) * (na * nb / n_tot)
            )
            out_min[valid_both] = np.minimum(min_a[valid_both], min_b[valid_both])
            out_max[valid_both] = np.maximum(max_a[valid_both], max_b[valid_both])

        return total_count, out_mean, out_m2, out_min, out_max

    # Explicit alias for Chan's parallel variance merge (SIH Standard 2.2 / Law of Total Variance)
    merge = combine_aggregates

    @staticmethod
    def compute_variance(count: np.ndarray, m2: np.ndarray) -> np.ndarray:
        """Computes sample variance sigma^2 = M2 / (n - 1) for n >= 2."""
        var = np.zeros_like(m2, dtype=np.float32)
        valid = count >= 2
        var[valid] = m2[valid] / (count[valid] - 1)
        return var

    @staticmethod
    def sensor_variance(
        range_m: np.ndarray | float,
        sigma_0: float = 0.02,
        k_range: float = 1.5e-4,
    ) -> np.ndarray | float:
        """Computes range-dependent LiDAR measurement variance (SIH Standard 2.4).
        
        sigma_obs^2(r) = sigma_0^2 + k_range * r^2
        Accounts for optical beam divergence and incident range degradation.
        """
        return (sigma_0 ** 2) + k_range * (range_m ** 2)

    @classmethod
    def kalman_elevation_update(
        cls,
        prior_mean: np.ndarray | float,
        prior_var: np.ndarray | float,
        obs_z: np.ndarray | float,
        range_m: np.ndarray | float,
        sigma_0: float = 0.02,
        k_range: float = 1.5e-4,
    ) -> Tuple[np.ndarray | float, np.ndarray | float]:
        """Executes 1D Kalman elevation filter update incorporating range observation noise.
        
        Args:
            prior_mean: Current cell elevation estimate.
            prior_var: Current cell elevation variance (uncertainty).
            obs_z: New LiDAR point height observation.
            range_m: Radial distance from sensor to observation point.
        Returns:
            (posterior_mean, posterior_var)
        """
        R = cls.sensor_variance(range_m, sigma_0=sigma_0, k_range=k_range)
        # Innovation and Kalman Gain
        K = prior_var / np.maximum(prior_var + R, 1e-6)
        posterior_mean = prior_mean + K * (obs_z - prior_mean)
        posterior_var = (1.0 - K) * prior_var
        return posterior_mean, posterior_var
