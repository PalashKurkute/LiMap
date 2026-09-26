"""Kinematically Feasible Hybrid-A* Path Planner.

Plans smooth Ackermann-steered trajectories in (x, y, theta) continuous space
navigating through multi-layer costmaps. Respects minimum turning radius (R_min = 4.5m)
and evaluates path costs through underpasses, potholes, and dynamic obstacles.
"""

from __future__ import annotations

import heapq
from typing import List, Optional, Tuple
import numpy as np

from core.planning.costmap_generator import CostmapGenerator, COST_HIGH_RISK, COST_LETHAL


class Node:
    __slots__ = ("x", "y", "theta", "cost_g", "cost_f", "parent", "steer")

    def __init__(
        self,
        x: float,
        y: float,
        theta: float,
        cost_g: float,
        cost_f: float,
        parent: Optional[Node] = None,
        steer: float = 0.0,
    ):
        self.x = x
        self.y = y
        self.theta = theta
        self.cost_g = cost_g
        self.cost_f = cost_f
        self.parent = parent
        self.steer = steer

    def __lt__(self, other: Node) -> bool:
        return self.cost_f < other.cost_f


class HybridAStarPlanner:
    """Plans kinematically feasible UGV paths with Ackermann steering constraints."""

    def __init__(
        self,
        costmap_gen: CostmapGenerator,
        wheelbase_m: float = 2.0,
        min_turning_radius_m: float = 4.5,
        step_size_m: float = 0.5,
        xy_resolution_m: float = 0.25,
        theta_bins: int = 24,
        lethal_cost_thresh: int = 220,
    ):
        self.costmap_gen = costmap_gen
        self.L = wheelbase_m
        self.R_min = min_turning_radius_m
        self.step_size = step_size_m
        self.xy_res = xy_resolution_m
        self.theta_bins = theta_bins
        self.lethal_thresh = lethal_cost_thresh

        # Maximum steering angle
        self.max_steer = np.arctan(self.L / self.R_min)
        # Steering primitives: straight, full left, full right, half left, half right
        self.steer_angles = [
            0.0,
            self.max_steer,
            -self.max_steer,
            self.max_steer * 0.5,
            -self.max_steer * 0.5,
        ]

    def plan(
        self,
        costmap: np.ndarray,
        start_pose: Tuple[float, float, float],  # (x, y, theta) in meters/rad
        goal_pose: Tuple[float, float, float],
        max_iterations: int = 8000,
        goal_tolerance_m: float = 1.0,
    ) -> Tuple[Optional[np.ndarray], float]:
        """Finds minimum-cost kinematically feasible trajectory from start to goal.
        
        Returns:
            Tuple of (trajectory: np.ndarray of shape (K, 3) [x, y, theta], total_cost: float).
        """
        sx, sy, stheta = start_pose
        gx, gy, gtheta = goal_pose

        start_h = float(np.hypot(gx - sx, gy - sy))
        start_node = Node(sx, sy, stheta, cost_g=0.0, cost_f=start_h)

        open_set: List[Node] = []
        heapq.heappush(open_set, start_node)

        # Visited 3D grid: (discrete_x, discrete_y, discrete_theta) -> min_g_cost
        visited = {}

        iterations = 0

        while open_set and iterations < max_iterations:
            iterations += 1
            curr = heapq.heappop(open_set)

            # Check goal condition
            dist_to_goal = np.hypot(gx - curr.x, gy - curr.y)
            if dist_to_goal <= goal_tolerance_m:
                path = self._reconstruct_path(curr)
                return path, curr.cost_g

            # Quantize state
            k_x = int(round(curr.x / self.xy_res))
            k_y = int(round(curr.y / self.xy_res))
            k_th = int(round((curr.theta % (2.0 * np.pi)) / (2.0 * np.pi) * self.theta_bins)) % self.theta_bins
            state_key = (k_x, k_y, k_th)

            if state_key in visited and visited[state_key] <= curr.cost_g:
                continue
            visited[state_key] = curr.cost_g

            # Expand motion primitives
            for steer in self.steer_angles:
                # Bicycle kinematic forward integration
                d_th = (self.step_size / self.L) * np.tan(steer)
                next_th = (curr.theta + d_th) % (2.0 * np.pi)
                next_x = curr.x + self.step_size * np.cos(curr.theta + 0.5 * d_th)
                next_y = curr.y + self.step_size * np.sin(curr.theta + 0.5 * d_th)

                # Check map bounds and collision
                cgx, cgy = self.costmap_gen.world_to_grid(next_x, next_y)
                if (
                    cgx < 0 or cgx >= self.costmap_gen.nx or
                    cgy < 0 or cgy >= self.costmap_gen.ny
                ):
                    continue

                cell_cost = int(costmap[cgy, cgx])
                if cell_cost >= self.lethal_thresh:
                    continue  # Lethal collision!

                # Cost accrual: distance + terrain roughness + steering change penalty
                step_cost = self.step_size * (1.0 + float(cell_cost) / 30.0)
                steer_penalty = abs(steer) * 0.15
                next_g = curr.cost_g + step_cost + steer_penalty

                h_val = float(np.hypot(gx - next_x, gy - next_y))
                next_f = next_g + h_val

                neighbor = Node(
                    x=next_x,
                    y=next_y,
                    theta=next_th,
                    cost_g=next_g,
                    cost_f=next_f,
                    parent=curr,
                    steer=steer,
                )
                heapq.heappush(open_set, neighbor)

        # No path found or iteration limit reached
        return None, float("inf")

    def _reconstruct_path(self, goal_node: Node) -> np.ndarray:
        traj = []
        curr = goal_node
        while curr is not None:
            traj.append([curr.x, curr.y, curr.theta])
            curr = curr.parent
        traj.reverse()
        return np.array(traj, dtype=np.float32)
