"""Deterministic Synthetic Test Suite Generator for FoveaGrid 2.5D.

Generates 4 canonical adversarial stress scenes matching Velodyne HDL-64E beam optics,
ROS REP 103 coordinates (X forward, Y left, Z up), and SemanticKITTI binary formats.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np


# SemanticKITTI Class IDs
LABEL_UNLABELED = 0
LABEL_CAR = 10
LABEL_ROAD = 40
LABEL_BUILDING_STRUCTURE = 50
LABEL_TERRAIN_CRATER = 72
LABEL_POLE = 80
LABEL_MOVING_CAR = 252


def get_hdl64e_beams(num_rings: int = 64, num_azimuth: int = 2048) -> Tuple[np.ndarray, np.ndarray]:
    """Generates elevation and azimuth angles matching Velodyne HDL-64E geometry.
    
    Vertical FOV: -24.8 deg to +2.0 deg (non-uniform distribution).
    Lower 32 beams cover -24.8 to -8.3 deg (~0.53 deg resolution).
    Upper 32 beams cover -8.3 to +2.0 deg (~0.32 deg resolution).
    """
    elev_lower = np.linspace(np.radians(-24.8), np.radians(-8.3), num_rings // 2, endpoint=False)
    elev_upper = np.linspace(np.radians(-8.3), np.radians(10.0), num_rings // 2)
    elevations = np.concatenate([elev_lower, elev_upper])
    azimuths = np.linspace(-np.pi, np.pi, num_azimuth, endpoint=False)
    return elevations, azimuths


def build_ray_directions(elevations: np.ndarray, azimuths: np.ndarray) -> np.ndarray:
    """Computes normalized ray direction vectors (num_rings, num_azimuth, 3)."""
    el, az = np.meshgrid(elevations, azimuths, indexing="ij")
    cos_el = np.cos(el)
    dx = cos_el * np.cos(az)
    dy = cos_el * np.sin(az)
    dz = np.sin(el)
    return np.stack([dx, dy, dz], axis=-1)  # (R, A, 3)


def ray_intersect_plane(
    ray_dirs: np.ndarray,
    origin: np.ndarray,
    plane_z: float,
    max_range: float = 100.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Finds intersection of rays with horizontal plane Z = plane_z."""
    dz = ray_dirs[..., 2]
    # For ground plane z < origin_z, rays must point downwards (dz < -1e-4)
    # For overhead deck z > origin_z, rays must point upwards (dz > 1e-4)
    diff = plane_z - origin[2]
    valid_dir = (dz < -1e-4) if diff < 0 else (dz > 1e-4)
    
    t = np.full(dz.shape, np.inf, dtype=np.float32)
    valid = valid_dir & (np.abs(dz) > 1e-4)
    t[valid] = diff / dz[valid]
    t[t <= 0.1] = np.inf
    t[t > max_range] = np.inf
    
    hit_pts = np.zeros_like(ray_dirs)
    finite_mask = np.isfinite(t)
    hit_pts[finite_mask] = origin + ray_dirs[finite_mask] * t[finite_mask, None]
    return t, hit_pts


def generate_scene_a_bridge_underpass(
    output_dir: Path,
    num_rings: int = 64,
    num_azimuth: int = 2048,
) -> Dict[str, str]:
    """Scene A: Bridge Underpass.
    
    - Ground plane at Z = -1.73m (vehicle frame origin Z=0 at sensor height 1.73m).
    - Bridge deck: X in [15, 25], Y in [-15, 15], clearance at Z = 0.77m (2.5m above ground).
      Deck thickness = 0.8m (top at Z = 1.57m).
    - Bridge pillars: rectangular columns at X in [18, 22], Y in [-9, -7] and [7, 9].
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    elev, az = get_hdl64e_beams(num_rings, num_azimuth)
    rays = build_ray_directions(elev, az)
    origin = np.array([0.0, 0.0, 0.0], dtype=np.float32)
    
    # 1. Ground plane (Z = -1.73m)
    t_min = np.full(rays.shape[:2], np.inf, dtype=np.float32)
    label_map = np.zeros(rays.shape[:2], dtype=np.uint32)
    intensity_map = np.zeros(rays.shape[:2], dtype=np.float32)

    t_ground, _ = ray_intersect_plane(rays, origin, plane_z=-1.73)
    valid_ground = t_ground < t_min
    t_min[valid_ground] = t_ground[valid_ground]
    label_map[valid_ground] = LABEL_ROAD
    intensity_map[valid_ground] = 0.25

    # 2. Bridge underside plane (Z = 0.77m -> 2.5m clearance above road)
    t_deck_bot, pts_deck_bot = ray_intersect_plane(rays, origin, plane_z=0.77)
    deck_bot_mask = (
        (pts_deck_bot[..., 0] >= 15.0) & (pts_deck_bot[..., 0] <= 25.0) &
        (pts_deck_bot[..., 1] >= -15.0) & (pts_deck_bot[..., 1] <= 15.0) &
        (t_deck_bot < t_min)
    )
    t_min[deck_bot_mask] = t_deck_bot[deck_bot_mask]
    label_map[deck_bot_mask] = LABEL_BUILDING_STRUCTURE
    intensity_map[deck_bot_mask] = 0.65

    # 3. Bridge front vertical fascia face (X = 15.0m, Z in [0.77, 1.57], Y in [-15, 15])
    dx = rays[..., 0]
    valid_front = dx > 1e-4
    t_front = np.full_like(t_min, np.inf)
    t_front[valid_front] = (15.0 - origin[0]) / dx[valid_front]
    pts_front = origin + rays * t_front[..., None]
    front_mask = (
        valid_front &
        (pts_front[..., 1] >= -15.0) & (pts_front[..., 1] <= 15.0) &
        (pts_front[..., 2] >= 0.77) & (pts_front[..., 2] <= 1.57) &
        (t_front < t_min)
    )
    t_min[front_mask] = t_front[front_mask]
    label_map[front_mask] = LABEL_BUILDING_STRUCTURE
    intensity_map[front_mask] = 0.70

    # 4. Bridge pillars (Left: Y in [7, 9], Right: Y in [-9, -7], X in [18, 22], Z in [-1.73, 0.77])
    for y_min, y_max in [(-9.0, -7.0), (7.0, 9.0)]:
        # Front face of pillar at X = 18.0
        t_pil = np.full_like(t_min, np.inf)
        t_pil[valid_front] = (18.0 - origin[0]) / dx[valid_front]
        pts_pil = origin + rays * t_pil[..., None]
        pil_mask = (
            valid_front &
            (pts_pil[..., 1] >= y_min) & (pts_pil[..., 1] <= y_max) &
            (pts_pil[..., 2] >= -1.73) & (pts_pil[..., 2] <= 0.77) &
            (t_pil < t_min)
        )
        t_min[pil_mask] = t_pil[pil_mask]
        label_map[pil_mask] = LABEL_BUILDING_STRUCTURE
        intensity_map[pil_mask] = 0.50

    # Collect valid hit points
    hit_mask = np.isfinite(t_min) & (t_min <= 80.0)
    pts = origin + rays[hit_mask] * t_min[hit_mask, None]
    
    x = pts[:, 0]
    y = pts[:, 1]
    z = pts[:, 2]
    remission = intensity_map[hit_mask]
    labels = label_map[hit_mask]

    # Add realistic sensor Gaussian noise (std = 1.5 cm)
    noise = np.random.default_rng(42).normal(0.0, 0.015, size=(len(x), 3)).astype(np.float32)
    x += noise[:, 0]
    y += noise[:, 1]
    z += noise[:, 2]

    points = np.stack([x, y, z, remission], axis=-1).astype(np.float32)
    labels = labels.astype(np.uint32)

    bin_path = output_dir / "scene_a_bridge_underpass.bin"
    label_path = output_dir / "scene_a_bridge_underpass.label"
    points.tofile(bin_path)
    labels.tofile(label_path)

    return {
        "bin": str(bin_path),
        "label": str(label_path),
        "point_count": str(len(points)),
        "description": "Bridge underpass with 2.5m vertical clearance over road plane",
    }


def generate_scene_b_pothole_cluster(
    output_dir: Path,
    num_rings: int = 64,
    num_azimuth: int = 2048,
) -> Dict[str, str]:
    """Scene B: Pothole & Negative Hazard Cluster.
    
    Road plane at Z = -1.73m.
    Craters modeled as parabolic/cylindrical depressions below road plane:
      - Crater 1: Center (8.0, 0.0), Radius 0.5m, Depth 0.25m
      - Crater 2: Center (14.0, -1.2), Radius 0.75m, Depth 0.35m
      - Crater 3: Center (6.0, 1.0), Radius 0.4m, Depth 0.18m
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    elev, az = get_hdl64e_beams(num_rings, num_azimuth)
    rays = build_ray_directions(elev, az)
    origin = np.array([0.0, 0.0, 0.0], dtype=np.float32)

    t_ground, pts_ground = ray_intersect_plane(rays, origin, plane_z=-1.73)
    valid = np.isfinite(t_ground) & (t_ground <= 60.0)

    pts = pts_ground[valid].copy()
    labels = np.full(pts.shape[0], LABEL_ROAD, dtype=np.uint32)
    intensities = np.full(pts.shape[0], 0.25, dtype=np.float32)

    craters = [
        {"center": (8.0, 0.0), "radius": 0.55, "depth": 0.25},
        {"center": (14.0, -1.2), "radius": 0.75, "depth": 0.35},
        {"center": (6.0, 1.0), "radius": 0.40, "depth": 0.18},
    ]

    for c in craters:
        cx, cy = c["center"]
        r, d = c["radius"], c["depth"]
        dist = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy)
        in_crater = dist < r
        if np.any(in_crater):
            # Parabolic depression: delta_z = -d * (1 - (dist / r)^2)
            delta_z = -d * (1.0 - (dist[in_crater] / r) ** 2)
            pts[in_crater, 2] += delta_z
            labels[in_crater] = LABEL_TERRAIN_CRATER
            intensities[in_crater] = 0.08  # Darker/rougher crater cavity

    # Noise
    noise = np.random.default_rng(101).normal(0.0, 0.012, size=pts.shape).astype(np.float32)
    pts += noise

    points = np.column_stack([pts, intensities]).astype(np.float32)
    bin_path = output_dir / "scene_b_pothole_cluster.bin"
    label_path = output_dir / "scene_b_pothole_cluster.label"
    points.tofile(bin_path)
    labels.tofile(label_path)

    return {
        "bin": str(bin_path),
        "label": str(label_path),
        "point_count": str(len(points)),
        "description": "Roadway with 3 negative obstacle craters (depths 18cm to 35cm)",
    }


def generate_scene_c_moving_vehicle_sequence(
    output_dir: Path,
    num_frames: int = 5,
    num_rings: int = 64,
    num_azimuth: int = 2048,
    speed_mps: float = 8.0,
    dt: float = 0.1,
) -> List[Dict[str, str]]:
    """Scene C: Moving Vehicle Sequence (5 scans at 10 Hz).
    
    Tests Dynamic Object Segmentation (MOS) and anti-ghosting ray-eraser.
    Moving vehicle box: 4.5m x 2.0m x 1.6m traveling along +X at 8.0 m/s.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    elev, az = get_hdl64e_beams(num_rings, num_azimuth)
    rays = build_ray_directions(elev, az)
    origin = np.array([0.0, 0.0, 0.0], dtype=np.float32)
    dx, dy, dz = rays[..., 0], rays[..., 1], rays[..., 2]

    results = []
    rng = np.random.default_rng(202)

    for frame_idx in range(num_frames):
        t_sec = frame_idx * dt
        veh_center_x = 10.0 + speed_mps * t_sec
        veh_center_y = 1.8
        veh_min_x, veh_max_x = veh_center_x - 2.25, veh_center_x + 2.25
        veh_min_y, veh_max_y = veh_center_y - 1.0, veh_center_y + 1.0
        veh_min_z, veh_max_z = -1.73, -0.13  # 1.6m high box resting on road

        t_min = np.full(rays.shape[:2], np.inf, dtype=np.float32)
        label_map = np.zeros(rays.shape[:2], dtype=np.uint32)
        intensity_map = np.zeros(rays.shape[:2], dtype=np.float32)

        # Ground plane
        t_ground, _ = ray_intersect_plane(rays, origin, plane_z=-1.73)
        valid_ground = t_ground < t_min
        t_min[valid_ground] = t_ground[valid_ground]
        label_map[valid_ground] = LABEL_ROAD
        intensity_map[valid_ground] = 0.25

        # Vehicle rear face (facing sensor, X = veh_min_x)
        valid_rear = dx > 1e-4
        t_rear = np.full_like(t_min, np.inf)
        t_rear[valid_rear] = (veh_min_x - origin[0]) / dx[valid_rear]
        pts_rear = origin + rays * t_rear[..., None]
        rear_mask = (
            valid_rear &
            (pts_rear[..., 1] >= veh_min_y) & (pts_rear[..., 1] <= veh_max_y) &
            (pts_rear[..., 2] >= veh_min_z) & (pts_rear[..., 2] <= veh_max_z) &
            (t_rear < t_min)
        )
        t_min[rear_mask] = t_rear[rear_mask]
        label_map[rear_mask] = LABEL_MOVING_CAR
        intensity_map[rear_mask] = 0.85

        # Vehicle left face (facing sensor line, Y = veh_min_y)
        valid_side = np.abs(dy) > 1e-4
        t_side = np.full_like(t_min, np.inf)
        t_side[valid_side] = (veh_min_y - origin[1]) / dy[valid_side]
        side_mask = (
            valid_side & (t_side > 0) & (t_side < t_min)
        )
        if np.any(side_mask):
            pts_side_eval = origin + rays[side_mask] * t_side[side_mask, None]
            in_side_box = (
                (pts_side_eval[:, 0] >= veh_min_x) & (pts_side_eval[:, 0] <= veh_max_x) &
                (pts_side_eval[:, 2] >= veh_min_z) & (pts_side_eval[:, 2] <= veh_max_z)
            )
            side_sub_indices = np.where(side_mask)
            matched_mask = (side_sub_indices[0][in_side_box], side_sub_indices[1][in_side_box])
            t_min[matched_mask] = t_side[matched_mask]
            label_map[matched_mask] = LABEL_MOVING_CAR
            intensity_map[matched_mask] = 0.80

        # Vehicle roof (Z = veh_max_z)
        t_roof, pts_roof = ray_intersect_plane(rays, origin, plane_z=veh_max_z)
        roof_mask = (
            (pts_roof[..., 0] >= veh_min_x) & (pts_roof[..., 0] <= veh_max_x) &
            (pts_roof[..., 1] >= veh_min_y) & (pts_roof[..., 1] <= veh_max_y) &
            (t_roof < t_min)
        )
        t_min[roof_mask] = t_roof[roof_mask]
        label_map[roof_mask] = LABEL_MOVING_CAR
        intensity_map[roof_mask] = 0.75

        hit_mask = np.isfinite(t_min) & (t_min <= 60.0)
        pts = origin + rays[hit_mask] * t_min[hit_mask, None]

        x = pts[:, 0]
        y = pts[:, 1]
        z = pts[:, 2]
        rem = intensity_map[hit_mask]
        lbl = label_map[hit_mask]

        noise = rng.normal(0.0, 0.015, size=(len(x), 3)).astype(np.float32)
        x += noise[:, 0]
        y += noise[:, 1]
        z += noise[:, 2]

        points = np.stack([x, y, z, rem], axis=-1).astype(np.float32)
        lbl = lbl.astype(np.uint32)

        bin_path = output_dir / f"scene_c_moving_veh_frame_{frame_idx:02d}.bin"
        label_path = output_dir / f"scene_c_moving_veh_frame_{frame_idx:02d}.label"
        points.tofile(bin_path)
        lbl.tofile(label_path)

        results.append({
            "frame": str(frame_idx),
            "timestamp": f"{t_sec:.2f}",
            "bin": str(bin_path),
            "label": str(label_path),
            "point_count": str(len(points)),
            "veh_x": f"{veh_center_x:.2f}",
        })

    return results


def generate_scene_d_thin_pole_array(
    output_dir: Path,
    num_rings: int = 64,
    num_azimuth: int = 2048,
) -> Dict[str, str]:
    """Scene D: Thin Vertical Wire & Pole Array.
    
    Poles of radius r = 0.05m (10cm diameter), height 4.0m (-1.73m to +2.27m).
    Distances: 5m, 20m, 40m, 70m along Y = 2.0m.
    Tests foveation resolution limits and point sparsity across range bands.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    elev, az = get_hdl64e_beams(num_rings, num_azimuth)
    rays = build_ray_directions(elev, az)
    origin = np.array([0.0, 0.0, 0.0], dtype=np.float32)

    t_min = np.full(rays.shape[:2], np.inf, dtype=np.float32)
    label_map = np.zeros(rays.shape[:2], dtype=np.uint32)
    intensity_map = np.zeros(rays.shape[:2], dtype=np.float32)

    # Road plane
    t_ground, _ = ray_intersect_plane(rays, origin, plane_z=-1.73)
    valid_ground = t_ground < t_min
    t_min[valid_ground] = t_ground[valid_ground]
    label_map[valid_ground] = LABEL_ROAD
    intensity_map[valid_ground] = 0.25

    # Cylindrical poles
    pole_distances = [5.0, 20.0, 40.0, 70.0]
    pole_radius = 0.05
    pole_y = 2.0
    pole_hit_counts = {}

    d_xy = rays[..., :2]  # (R, A, 2)
    d_xy_norm_sq = np.sum(d_xy ** 2, axis=-1)  # (R, A)

    for p_dist in pole_distances:
        c = np.array([p_dist, pole_y], dtype=np.float32)
        # Vector from ray origin in XY to cylinder center
        f = origin[:2] - c
        # Quadric: a = |d_xy|^2, b = 2 * (d_xy . f), c = |f|^2 - r^2
        a = d_xy_norm_sq
        b = 2.0 * (d_xy[..., 0] * f[0] + d_xy[..., 1] * f[1])
        c_val = float(np.sum(f ** 2) - pole_radius ** 2)

        disc = b ** 2 - 4.0 * a * c_val
        valid_disc = disc >= 0
        
        t_cyl = np.full_like(t_min, np.inf)
        sqrt_disc = np.sqrt(np.maximum(0.0, disc[valid_disc]))
        t_cand = (-b[valid_disc] - sqrt_disc) / (2.0 * a[valid_disc])
        
        # Check Z boundaries [-1.73, 2.27]
        z_cand = origin[2] + rays[valid_disc, 2] * t_cand
        in_z = (z_cand >= -1.73) & (z_cand <= 2.27) & (t_cand > 0)

        t_sub = np.full(np.sum(valid_disc), np.inf, dtype=np.float32)
        t_sub[in_z] = t_cand[in_z]
        t_cyl[valid_disc] = t_sub

        pole_mask = (t_cyl < t_min)
        t_min[pole_mask] = t_cyl[pole_mask]
        label_map[pole_mask] = LABEL_POLE
        intensity_map[pole_mask] = 0.90
        pole_hit_counts[f"pole_{int(p_dist)}m"] = int(np.sum(pole_mask))

    hit_mask = np.isfinite(t_min) & (t_min <= 90.0)
    pts = origin + rays[hit_mask] * t_min[hit_mask, None]

    x = pts[:, 0]
    y = pts[:, 1]
    z = pts[:, 2]
    rem = intensity_map[hit_mask]
    labels = label_map[hit_mask]

    noise = np.random.default_rng(303).normal(0.0, 0.010, size=(len(x), 3)).astype(np.float32)
    x += noise[:, 0]
    y += noise[:, 1]
    z += noise[:, 2]

    points = np.stack([x, y, z, rem], axis=-1).astype(np.float32)
    labels = labels.astype(np.uint32)

    bin_path = output_dir / "scene_d_thin_pole_array.bin"
    label_path = output_dir / "scene_d_thin_pole_array.label"
    points.tofile(bin_path)
    labels.tofile(label_path)

    return {
        "bin": str(bin_path),
        "label": str(label_path),
        "point_count": str(len(points)),
        "hits_per_pole": pole_hit_counts,
        "description": "Thin poles (10cm diam) at 5m, 20m, 40m, 70m for foveation tests",
    }


def generate_all_scenes(target_dir: str = "data/synthetic") -> Dict[str, object]:
    """Generates all 4 synthetic scenes and records metadata manifest."""
    out = Path(target_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {
        "scene_a_bridge": generate_scene_a_bridge_underpass(out),
        "scene_b_potholes": generate_scene_b_pothole_cluster(out),
        "scene_c_moving_vehicle": generate_scene_c_moving_vehicle_sequence(out),
        "scene_d_thin_poles": generate_scene_d_thin_pole_array(out),
    }
    manifest_path = out / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "data/synthetic"
    print(f"Generating synthetic LiDAR scenes in: {target}")
    summary = generate_all_scenes(target)
    print("Generation complete:")
    for k, v in summary.items():
        if isinstance(v, dict):
            pts = v.get("point_count", "N/A")
            desc = v.get("description", "")
            print(f"  - {k}: {pts} points ({desc})")
        elif isinstance(v, list):
            print(f"  - {k}: {len(v)} frames generated")
