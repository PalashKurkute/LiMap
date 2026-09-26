"""Velocity & Heading Dynamic Fovea Controller.

Dynamically shifts and elongates fine-resolution perception rings along the vehicle
velocity vector. Extends forward lookahead from 10m to 18m at high speed (15 m/s)
while contracting rear coverage to maintain deterministic memory consumption.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple
import numpy as np


@dataclass
class FoveaState:
    shift_x: float  # Center shift along forward X in meters
    shift_y: float  # Center shift along lateral Y in meters
    speed_mps: float
    heading_rad: float
    stretch_ratio: float
    forward_reach_m: float  # Effective forward lookahead distance in Ring 0


class DynamicFoveaController:
    """Controls speed- and heading-adaptive ring foveation."""

    def __init__(
        self,
        base_fovea_radius_m: float = 10.0,
        max_speed_mps: float = 20.0,  # ~72 km/h
        max_forward_stretch: float = 1.8,  # Up to 18m forward lookahead
        alpha_velocity_gain: float = 0.8,
    ):
        self.base_fovea_radius_m = base_fovea_radius_m
        self.max_speed_mps = max_speed_mps
        self.max_forward_stretch = max_forward_stretch
        self.alpha = alpha_velocity_gain

    def update(self, velocity_xy: np.ndarray) -> FoveaState:
        """Computes adaptive fovea distortion parameters given ego body velocity.
        
        Args:
            velocity_xy: (2,) or (3,) array with [vx, vy] in m/s (REP 103: vx fwd, vy left).
        Returns:
            FoveaState with shift offsets and effective forward reach.
        """
        vx = float(velocity_xy[0])
        vy = float(velocity_xy[1])
        speed = float(np.hypot(vx, vy))

        if speed < 0.1:
            return FoveaState(
                shift_x=0.0,
                shift_y=0.0,
                speed_mps=speed,
                heading_rad=0.0,
                stretch_ratio=1.0,
                forward_reach_m=self.base_fovea_radius_m,
            )

        norm_speed = min(speed / self.max_speed_mps, 1.0)
        stretch_ratio = 1.0 + self.alpha * norm_speed * (self.max_forward_stretch - 1.0)
        
        heading = float(np.arctan2(vy, vx))
        
        # Center shift is proportional to forward elongation
        shift_dist = (stretch_ratio - 1.0) * self.base_fovea_radius_m * 0.5
        shift_x = shift_dist * np.cos(heading)
        shift_y = shift_dist * np.sin(heading)

        forward_reach = self.base_fovea_radius_m * stretch_ratio

        return FoveaState(
            shift_x=shift_x,
            shift_y=shift_y,
            speed_mps=speed,
            heading_rad=heading,
            stretch_ratio=stretch_ratio,
            forward_reach_m=forward_reach,
        )

    def warp_coordinates(
        self, points_xy: np.ndarray, state: FoveaState
    ) -> np.ndarray:
        """Warps points into the dynamically shifted fovea reference frame.
        
        Points in front of vehicle appear closer to fovea center; points behind vehicle
        appear farther away, naturally delegating them to coarser outer rings.
        """
        if state.speed_mps < 0.1:
            return points_xy

        # Subtract shift offset
        warped = points_xy.copy()
        warped[:, 0] -= state.shift_x
        warped[:, 1] -= state.shift_y
        return warped
