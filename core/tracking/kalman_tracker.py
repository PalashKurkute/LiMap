"""2.5D Multi-Object Dynamic Tracker using Euclidean Clustering & Kalman Filtering.

Tracks dynamic objects (vehicles, pedestrians) in 2.5D space.
Estimates velocities (vx, vy), bounding box extents, and predicted trajectories
to feed downstream dynamic collision avoidance in path planners.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy.spatial import cKDTree


@dataclass
class BoundingBox25D:
    x: float
    y: float
    z: float
    length: float  # Along X extent
    width: float   # Along Y extent
    height: float  # Along Z extent
    num_points: int


@dataclass
class TrackedObstacle:
    track_id: int
    state: np.ndarray        # [x, y, vx, vy]
    covariance: np.ndarray   # 4x4 covariance matrix
    bbox: BoundingBox25D
    age: int
    hits: int
    time_since_update: int
    confirmed: bool


class DynamicObstacleTracker:
    """Tracks dynamic obstacles across time steps using Euclidean clustering & Kalman filters."""

    def __init__(
        self,
        cluster_dist_thresh: float = 1.0,
        min_cluster_points: int = 15,
        dt: float = 0.1,  # 10 Hz
        association_dist_thresh: float = 2.5,
        max_missed_scans: int = 3,
        min_hits_to_confirm: int = 2,
    ):
        self.cluster_dist_thresh = cluster_dist_thresh
        self.min_cluster_points = min_cluster_points
        self.dt = dt
        self.association_thresh = association_dist_thresh
        self.max_missed_scans = max_missed_scans
        self.min_hits = min_hits_to_confirm

        self.next_track_id = 1
        self.tracks: List[TrackedObstacle] = []

        # Standard discrete-time constant-velocity Kalman model
        self.F = np.array([
            [1.0, 0.0, dt,  0.0],
            [0.0, 1.0, 0.0, dt ],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ], dtype=np.float32)

        self.H = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
        ], dtype=np.float32)

        # Process and measurement noises
        self.Q = np.eye(4, dtype=np.float32) * 0.1
        self.Q[2:, 2:] *= 0.5
        self.R = np.eye(2, dtype=np.float32) * 0.2

    def update(self, dynamic_points: np.ndarray) -> List[TrackedObstacle]:
        """Runs one tracker iteration on dynamic LiDAR returns.
        
        Args:
            dynamic_points: (N, 3+) float32 array of points flagged as dynamic by MOS.
        Returns:
            List of currently confirmed, active tracked obstacles.
        """
        # Step 1: Predict existing tracks forward
        for track in self.tracks:
            track.state = self.F @ track.state
            track.covariance = self.F @ track.covariance @ self.F.T + self.Q
            track.age += 1
            track.time_since_update += 1

        # Step 2: Cluster dynamic points into bounding box detections
        detections = self._cluster_points(dynamic_points)

        # Step 3: Associate detections with existing tracks
        matched_pairs, unmatched_dets, unmatched_tracks = self._associate(detections)

        # Step 4: Kalman measurement update for matched pairs
        for track_idx, det_idx in matched_pairs:
            track = self.tracks[track_idx]
            det = detections[det_idx]

            # 2-point velocity initialization on 2nd hit for instantaneous convergence
            if track.hits == 1:
                dt_step = max(self.dt * track.time_since_update, 1e-3)
                track.state[2] = (det.x - track.bbox.x) / dt_step
                track.state[3] = (det.y - track.bbox.y) / dt_step

            z = np.array([det.x, det.y], dtype=np.float32)
            y_res = z - (self.H @ track.state)
            S = self.H @ track.covariance @ self.H.T + self.R
            K = track.covariance @ self.H.T @ np.linalg.inv(S)

            track.state = track.state + (K @ y_res)
            I_KH = np.eye(4, dtype=np.float32) - (K @ self.H)
            track.covariance = I_KH @ track.covariance

            track.bbox = det
            track.hits += 1
            track.time_since_update = 0
            if track.hits >= self.min_hits:
                track.confirmed = True

        # Step 5: Initialize new tracks for unmatched detections
        for det_idx in unmatched_dets:
            det = detections[det_idx]
            init_state = np.array([det.x, det.y, 0.0, 0.0], dtype=np.float32)
            init_cov = np.eye(4, dtype=np.float32) * 1.0
            init_cov[2:, 2:] = 25.0  # High initial velocity uncertainty for rapid convergence
            new_track = TrackedObstacle(
                track_id=self.next_track_id,
                state=init_state,
                covariance=init_cov,
                bbox=det,
                age=1,
                hits=1,
                time_since_update=0,
                confirmed=(self.min_hits <= 1),
            )
            self.tracks.append(new_track)
            self.next_track_id += 1

        # Step 6: Prune dead tracks
        self.tracks = [
            t for t in self.tracks if t.time_since_update <= self.max_missed_scans
        ]

        # Return active tracks
        return [t for t in self.tracks if t.confirmed]

    def _cluster_points(self, points: np.ndarray) -> List[BoundingBox25D]:
        """Euclidean Connected-Components Clustering (BFS-based)."""
        if len(points) < self.min_cluster_points:
            return []

        # Downsample if dense to guarantee real-time clustering
        stride = max(1, len(points) // 800)
        sub_pts = points[::stride, :3]

        tree = cKDTree(sub_pts)
        visited = np.zeros(len(sub_pts), dtype=bool)
        boxes = []

        for i in range(len(sub_pts)):
            if visited[i]:
                continue

            # BFS expansion for connected component
            component = []
            queue = [i]
            visited[i] = True

            head = 0
            while head < len(queue):
                curr = queue[head]
                head += 1
                component.append(curr)
                neighbors = tree.query_ball_point(sub_pts[curr], r=1.5)
                for n in neighbors:
                    if not visited[n]:
                        visited[n] = True
                        queue.append(n)

            if len(component) * stride >= self.min_cluster_points:
                c_pts = sub_pts[component]
                min_b = np.min(c_pts, axis=0)
                max_b = np.max(c_pts, axis=0)
                center = 0.5 * (min_b + max_b)
                extent = max_b - min_b

                boxes.append(BoundingBox25D(
                    x=float(center[0]),
                    y=float(center[1]),
                    z=float(center[2]),
                    length=max(float(extent[0]), 1.5),
                    width=max(float(extent[1]), 1.0),
                    height=max(float(extent[2]), 0.8),
                    num_points=len(component) * stride,
                ))

        return boxes

    def _associate(
        self, detections: List[BoundingBox25D]
    ) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """Greedy distance-based data association between tracks and detections."""
        if not self.tracks:
            return [], list(range(len(detections))), []
        if not detections:
            return [], [], list(range(len(self.tracks)))

        cost_matrix = np.zeros((len(self.tracks), len(detections)), dtype=np.float32)

        for t_idx, track in enumerate(self.tracks):
            for d_idx, det in enumerate(detections):
                dx = track.state[0] - det.x
                dy = track.state[1] - det.y
                cost_matrix[t_idx, d_idx] = float(np.hypot(dx, dy))

        matched = []
        unmatched_dets = set(range(len(detections)))
        unmatched_tracks = set(range(len(self.tracks)))

        while True:
            min_val = np.min(cost_matrix)
            if min_val > self.association_thresh or np.isinf(min_val):
                break

            t_min, d_min = np.unravel_index(np.argmin(cost_matrix), cost_matrix.shape)
            matched.append((int(t_min), int(d_min)))
            unmatched_dets.discard(int(d_min))
            unmatched_tracks.discard(int(t_min))

            # Invalidate row and column
            cost_matrix[t_min, :] = np.inf
            cost_matrix[:, d_min] = np.inf

        return matched, list(unmatched_dets), list(unmatched_tracks)
