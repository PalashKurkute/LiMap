#!/usr/bin/env python3
"""Generate synthetic LiDAR .bin + .label files for benchmark and test suites.

Run from repo root:
    python scripts/generate_synthetic.py

Generates:
    data/synthetic/scene_c_moving_veh_frame_01.bin / .label
    data/synthetic/scene_c_moving_veh_frame_02.bin / .label
    data/synthetic/scene_c_moving_veh_frame_03.bin / .label

Format: SemanticKITTI-compatible
    .bin  — float32 x,y,z,intensity  (N × 4)
    .label — uint32 packed label     (N,)   lower 16 bits = semantic, upper 16 bits = instance
"""
from __future__ import annotations
from pathlib import Path
import numpy as np

OUT_DIR = Path("data/synthetic")
OUT_DIR.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(seed=42)

# SemanticKITTI class IDs used in tests
CLASS_ROAD = 40
CLASS_CAR_MOVING = 252  # moving car (MOS label)
CLASS_CAR_STATIC = 10

def _write_frame(stem: str, pts: np.ndarray, labels: np.ndarray) -> None:
    """Write .bin (float32 xyzi) and .label (uint32) files."""
    xyzi = np.zeros((len(pts), 4), dtype=np.float32)
    xyzi[:, :3] = pts.astype(np.float32)
    xyzi[:, 3] = RNG.uniform(0.3, 1.0, len(pts)).astype(np.float32)
    xyzi.tofile(OUT_DIR / f"{stem}.bin")
    labels.astype(np.uint32).tofile(OUT_DIR / f"{stem}.label")

def _ground_plane(n: int = 50_000) -> tuple[np.ndarray, np.ndarray]:
    """Flat ground from -50m to 50m, z ~ -1.73m ± 0.05m."""
    x = RNG.uniform(-50, 50, n).astype(np.float32)
    y = RNG.uniform(-50, 50, n).astype(np.float32)
    z = RNG.normal(-1.73, 0.05, n).astype(np.float32)
    labels = np.full(n, CLASS_ROAD, dtype=np.uint32)
    return np.stack([x, y, z], axis=1), labels

def generate_scene_c_frame(frame_idx: int) -> None:
    """Scene C: ground + a moving vehicle at different positions per frame."""
    stem = f"scene_c_moving_veh_frame_{frame_idx:02d}"

    # Ground points
    g_pts, g_lbl = _ground_plane(50_000)

    # Moving vehicle — shifts 2m forward each frame
    vehicle_x_center = 10.0 + (frame_idx - 1) * 2.0
    veh_x = RNG.uniform(vehicle_x_center - 2.0, vehicle_x_center + 2.0, 2000).astype(np.float32)
    veh_y = RNG.uniform(-1.0, 1.0, 2000).astype(np.float32)
    veh_z = RNG.uniform(-1.73, 0.5, 2000).astype(np.float32)
    veh_pts = np.stack([veh_x, veh_y, veh_z], axis=1)
    veh_lbl = np.full(2000, CLASS_CAR_MOVING, dtype=np.uint32)

    pts = np.concatenate([g_pts, veh_pts], axis=0)
    labels = np.concatenate([g_lbl, veh_lbl], axis=0)
    _write_frame(stem, pts, labels)
    print(f"  Written {stem}: {len(pts):,} points")

if __name__ == "__main__":
    print(f"Generating synthetic data in {OUT_DIR.resolve()} ...")
    for i in range(1, 4):
        generate_scene_c_frame(i)
    print("Done. Run benchmark suite with: python -m pytest tests/ -v")
