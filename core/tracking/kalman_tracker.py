"""2.5D Multi-Object Dynamic Tracker using Euclidean Clustering & Kalman Filtering.

Tracks dynamic objects (vehicles, pedestrians) in 2.5D space.
Estimates velocities (vx, vy), bounding box extents, and predicted trajectories
to feed downstream dynamic collision avoidance in path planners.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np
from scipy.spatial import cKDTree
from scipy.optimize import linear_sum_assignment


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
        max_active_tracks: int = 128,
    ):
        self.cluster_dist_thresh = cluster_dist_thresh
        self.min_cluster_points = min_cluster_points
        self.dt = dt
        self.association_thresh = association_dist_thresh
        self.max_missed_scans = max_missed_scans
        self.min_hits = min_hits_to_confirm
        self.max_active_tracks = max_active_tracks

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
            track.covariance = 0.5 * (track.covariance + track.covariance.T)
            track.age += 1
            track.time_since_update += 1

        # Step 2: Cluster dynamic points into bounding box detections
        detections = self._cluster_points(dynamic_points)

        # Step 3: Associate detections with existing tracks (Hungarian bipartite matching)
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
            track.covariance = 0.5 * (track.covariance + track.covariance.T)

            # Center bounding box on smoothed Kalman state
            det.x = float(track.state[0])
            det.y = float(track.state[1])
            track.bbox = det
            track.hits += 1
            track.time_since_update = 0
            if track.hits >= self.min_hits:
                track.confirmed = True

        # Step 5: Initialize new tracks for unmatched detections (capped at max_active_tracks)
        for det_idx in unmatched_dets:
            if len(self.tracks) >= self.max_active_tracks:
                break
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

        # Return active confirmed tracks
        return [t for t in self.tracks if t.confirmed]

    def _cluster_points(self, points: np.ndarray) -> List[BoundingBox25D]:
        """Euclidean Connected-Components Clustering with spatial filtering."""
        if len(points) < self.min_cluster_points:
            return []

        # Sanitize points against NaNs and infinite coordinates
        finite_mask = np.isfinite(points[:, :3]).all(axis=1)
        valid_pts = points[finite_mask, :3]
        if len(valid_pts) < self.min_cluster_points:
            return []

        # ROI filter: eliminate noise far beyond sensor range or high above ground
        ranges_sq = valid_pts[:, 0] ** 2 + valid_pts[:, 1] ** 2
        roi_mask = (ranges_sq <= 55.0 ** 2) & (valid_pts[:, 2] <= 4.0) & (valid_pts[:, 2] >= -3.0)
        filtered_pts = valid_pts[roi_mask]
        if len(filtered_pts) < self.min_cluster_points:
            return []

        # Downsample if dense to guarantee real-time clustering (< 10ms)
        stride = max(1, len(filtered_pts) // 1000)
        sub_pts = filtered_pts[::stride]

        tree = cKDTree(sub_pts)
        visited = np.zeros(len(sub_pts), dtype=bool)
        boxes: List[BoundingBox25D] = []

        for i in range(len(sub_pts)):
            if visited[i]:
                continue

            # BFS expansion for connected component
            component: List[int] = []
            queue = [i]
            visited[i] = True

            head = 0
            while head < len(queue):
                curr = queue[head]
                head += 1
                component.append(curr)
                neighbors = tree.query_ball_point(sub_pts[curr], r=self.cluster_dist_thresh)
                for n in neighbors:
                    if not visited[n]:
                        visited[n] = True
                        queue.append(n)

            # Strict noise rejection: must have at least 3 subsampled seeds AND satisfy min_cluster_points
            total_est_points = len(component) * stride
            if len(component) >= 3 and total_est_points >= self.min_cluster_points:
                c_pts = sub_pts[component]
                min_b = np.min(c_pts, axis=0)
                max_b = np.max(c_pts, axis=0)
                extent = max_b - min_b

                # Reject massive non-obstacle blobs (e.g. wall/ground segmentation leaks > 15m)
                if extent[0] > 16.0 or extent[1] > 8.0 or extent[2] > 4.5:
                    continue

                center = 0.5 * (min_b + max_b)
                boxes.append(BoundingBox25D(
                    x=float(center[0]),
                    y=float(center[1]),
                    z=float(center[2]),
                    length=max(float(extent[0]), 0.5),
                    width=max(float(extent[1]), 0.5),
                    height=max(float(extent[2]), 0.4),
                    num_points=total_est_points,
                ))

        return boxes

    def _associate(
        self, detections: List[BoundingBox25D]
    ) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        """Optimal Hungarian bipartite data association between tracks and detections."""
        if not self.tracks:
            return [], list(range(len(detections))), []
        if not detections:
            return [], [], list(range(len(self.tracks)))

        # Vectorized Euclidean cost matrix computation
        track_pos = np.array([[t.state[0], t.state[1]] for t in self.tracks], dtype=np.float32)
        det_pos = np.array([[d.x, d.y] for d in detections], dtype=np.float32)

        diff = track_pos[:, None, :] - det_pos[None, :, :]  # (N_tracks, N_dets, 2)
        cost_matrix = np.hypot(diff[:, :, 0], diff[:, :, 1])

        # Global optimal matching via Hungarian algorithm
        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        matched: List[Tuple[int, int]] = []
        unmatched_dets = set(range(len(detections)))
        unmatched_tracks = set(range(len(self.tracks)))

        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= self.association_thresh:
                matched.append((int(r), int(c)))
                unmatched_dets.discard(int(c))
                unmatched_tracks.discard(int(r))

        return matched, sorted(list(unmatched_dets)), sorted(list(unmatched_tracks))
