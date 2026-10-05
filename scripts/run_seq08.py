"""Phase 1: Real-World LiDAR Pipeline Benchmark on SemanticKITTI Sequence 08.

Ingests real velodyne scans, executes sanitization and 2.5D spatial hash insertion,
profiles frame processing latency, active cells, and memory footprint.
Generates verifiable metrics saved to data/real/seq08_run_results.json.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List

import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.ingestion.loader import load_kitti_bin, sanitize_point_cloud, compute_azimuth_timestamps
from core.ingestion.odometry import LidarOdometryDeskewer
from core.grid.spatial_hash import SpatialHashGrid
from core.perception.segmentation_infer import SemanticSegmentationEngine
from core.tracking.mos_filter import MovingObjectSegmentationFilter
from core.tracking.kalman_tracker import DynamicObstacleTracker
from core.tracking.free_space_eraser import FreeSpaceGhostEraser


def run_sequence_08_benchmark(
    data_dir: str = "data/real/sequences/08/velodyne",
    max_frames: int = 100,
    output_json: str = "data/real/seq08_run_results.json",
) -> Dict[str, object]:
    velodyne_path = Path(data_dir)
    if not velodyne_path.is_dir():
        raise FileNotFoundError(f"Velodyne directory not found: {velodyne_path.resolve()}")

    bin_files = sorted(list(velodyne_path.glob("*.bin")))
    if not bin_files:
        raise FileNotFoundError(f"No .bin files found in: {velodyne_path.resolve()}")

    target_files = bin_files[:max_frames]
    total_frames = len(target_files)

    print(f"============================================================")
    print(f"  FoveaGrid 2.5D — Real Data Benchmark (SemanticKITTI Seq 08)")
    print(f"============================================================")
    print(f"  Directory:      {velodyne_path.resolve()}")
    print(f"  Frames to run:  {total_frames} (out of {len(bin_files)} available)")
    print(f"------------------------------------------------------------\n")

    grid = SpatialHashGrid()
    engine = SemanticSegmentationEngine()
    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=0.35)
    deskewer = LidarOdometryDeskewer(voxel_size=0.8, max_range=60.0, deskew=True)
    tracker = DynamicObstacleTracker(dt=0.1, min_hits_to_confirm=2)
    eraser = FreeSpaceGhostEraser(stride=16, clearance_tolerance_m=0.4)

    initial_telemetry = grid.export_telemetry()
    allocated_mb = initial_telemetry["total_heap_mb"]
    within_budget = initial_telemetry["within_pool_budget"]

    latencies_ms: List[float] = []
    infer_latencies_ms: List[float] = []
    points_per_frame: List[int] = []
    active_cells_per_frame: List[int] = []

    total_dynamic_points = 0
    total_static_points = 0
    total_ghost_cells_erased = 0
    total_tracks_formed = 0

    start_total_time = time.perf_counter()

    for idx, file_path in enumerate(target_files):
        # 1. Ingest raw points
        raw_points = load_kitti_bin(file_path, use_mmap=False)

        # 2. Sanitize points (drop NaNs, infs, ego vehicle self-hits < 0.5m)
        sanitized_pts, _ = sanitize_point_cloud(raw_points, min_range=1.0, max_range=60.0)
        timestamps = compute_azimuth_timestamps(sanitized_pts, scan_frequency_hz=10.0)

        # 3. Odometry & Motion Deskewing (provides delta_pose for disparity check)
        deskewed_pts, delta_pose, current_pose = deskewer.process_frame(sanitized_pts, timestamps, dt=0.1)

        # 4. Semantic Segmentation Inference
        t_inf0 = time.perf_counter()
        semantic_labels = engine.infer(deskewed_pts)
        t_inf1 = time.perf_counter()
        infer_ms = (t_inf1 - t_inf0) * 1000.0
        infer_latencies_ms.append(infer_ms)

        # 5. Moving Object Segmentation with true inter-frame SE(3) disparity
        static_pts, dyn_pts, is_dyn = mos.separate_dynamic_points(
            deskewed_pts,
            semantic_labels=semantic_labels,
            delta_pose_from_last=delta_pose if idx > 0 else None,
        )

        total_dynamic_points += len(dyn_pts)
        total_static_points += len(static_pts)

        # 6. Dynamic Obstacle Tracking & Ghost Trail Carving
        active_tracks = tracker.update(dyn_pts)
        total_tracks_formed += len(active_tracks)

        # Rolling local map window (10 frames = 1.0s window)
        if idx % 10 == 0:
            grid.reset()

        # Timed insertion into bounded spatial hash
        t0 = time.perf_counter()
        active_count = grid.insert_points(static_pts, semantic_labels=semantic_labels[~is_dyn])
        t1 = time.perf_counter()

        frame_ms = (t1 - t0) * 1000.0
        latencies_ms.append(frame_ms)
        points_per_frame.append(len(sanitized_pts))
        active_cells_per_frame.append(active_count)

        erased = 0
        if len(dyn_pts) > 0 and len(active_tracks) > 0:
            erased = eraser.erase_ghost_trails(grid, dyn_pts[::64], max_ray_range_m=35.0)
            total_ghost_cells_erased += erased

        if (idx + 1) % 10 == 0 or (idx + 1) == total_frames:
            dyn_pct = (len(dyn_pts) / max(len(sanitized_pts), 1)) * 100.0
            print(
                f"  Frame [{idx + 1:4d}/{total_frames}] | "
                f"Points: {len(sanitized_pts):6d} | "
                f"Dyn: {len(dyn_pts):5d} ({dyn_pct:4.1f}%) | "
                f"Tracks: {len(active_tracks):2d} | "
                f"Ghost Erased: {erased:3d} | "
                f"Grid Latency: {frame_ms:5.2f} ms"
            )

    total_time_s = time.perf_counter() - start_total_time
    latencies_arr = np.array(latencies_ms)
    points_arr = np.array(points_per_frame)
    cells_arr = np.array(active_cells_per_frame)

    mean_latency = float(np.mean(latencies_arr))
    p50_latency = float(np.percentile(latencies_arr, 50))
    p95_latency = float(np.percentile(latencies_arr, 95))
    p99_latency = float(np.percentile(latencies_arr, 99))
    max_latency = float(np.max(latencies_arr))
    mean_points = float(np.mean(points_arr))
    mean_active_cells = float(np.mean(cells_arr))
    max_active_cells = int(np.max(cells_arr))
    throughput_fps = float(total_frames / total_time_s)
    insertion_fps = float(1000.0 / mean_latency)

    results = {
        "dataset": "SemanticKITTI",
        "sequence": "08",
        "frames_evaluated": total_frames,
        "memory": {
            "allocated_heap_mb": allocated_mb,
            "memory_budget_mb": 3.5,
            "within_pool_budget": within_budget,
            "max_active_cells": max_active_cells,
            "mean_active_cells": round(mean_active_cells, 1),
            "table_capacity": grid.capacity,
            "peak_load_factor": round(max_active_cells / grid.capacity, 4),
        },
        "points": {
            "mean_points_per_frame": round(mean_points, 1),
            "total_points_processed": int(np.sum(points_arr)),
            "total_static_points": total_static_points,
            "total_dynamic_points": total_dynamic_points,
            "dynamic_ratio_pct": round((total_dynamic_points / max(total_dynamic_points + total_static_points, 1)) * 100.0, 2),
        },
        "dynamic_anti_ghosting": {
            "ghost_cells_carved": total_ghost_cells_erased,
            "kalman_tracks_formed": total_tracks_formed,
            "range_disparity_thresh_m": 0.35,
        },
        "grid_latency_ms": {
            "mean": round(mean_latency, 2),
            "p50": round(p50_latency, 2),
            "p95": round(p95_latency, 2),
            "p99": round(p99_latency, 2),
            "max": round(max_latency, 2),
        },
        "semantic_inference_ms": {
            "mean": round(float(np.mean(infer_latencies_ms)), 2),
            "p50": round(float(np.percentile(infer_latencies_ms, 50)), 2),
            "p95": round(float(np.percentile(infer_latencies_ms, 95)), 2),
        },
        "throughput": {
            "insertion_only_fps": round(insertion_fps, 1),
            "pipeline_end_to_end_fps": round(throughput_fps, 1),
        },
    }

    out_file = Path(output_json)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    avg_dyn_pct = (total_dynamic_points / max(total_dynamic_points + total_static_points, 1)) * 100.0

    print("\n" + "=" * 60)
    print("  RESULTS SUMMARY (Real SemanticKITTI Sequence 08)")
    print("=" * 60)
    print(f"  Frames Evaluated:        {total_frames}")
    print(f"  Avg Points/Frame:        {mean_points:,.0f}")
    print(f"  Dynamic Points:          {total_dynamic_points:,} ({avg_dyn_pct:.1f}%)")
    print(f"  Ghost Cells Carved:      {total_ghost_cells_erased:,}")
    print(f"  Kalman Track Events:     {total_tracks_formed:,}")
    print(f"  Mean Active Cells:       {mean_active_cells:,.0f} (Peak: {max_active_cells})")
    print(f"  Heap Memory:             {allocated_mb:.2f} MB (budget < 3.5 MB: {within_budget})")
    print(f"  Mean Insertion Latency:  {mean_latency:.2f} ms ({insertion_fps:.1f} FPS)")
    print(f"  P95 Insertion Latency:   {p95_latency:.2f} ms")
    print(f"  P99 Insertion Latency:   {p99_latency:.2f} ms")
    print(f"  End-to-End Pipeline FPS: {throughput_fps:.1f} FPS")
    print(f"  Results saved to:        {out_file.resolve()}")
    print("=" * 60 + "\n")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run FoveaGrid 2.5D on SemanticKITTI Sequence 08")
    parser.add_argument("--data-dir", type=str, default="data/real/sequences/08/velodyne")
    parser.add_argument("--max-frames", type=int, default=100)
    parser.add_argument("--output", type=str, default="data/real/seq08_run_results.json")
    args = parser.parse_args()

    run_sequence_08_benchmark(
        data_dir=args.data_dir,
        max_frames=args.max_frames,
        output_json=args.output,
    )
