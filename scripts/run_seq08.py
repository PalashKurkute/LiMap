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

from core.ingestion.loader import load_kitti_bin, sanitize_point_cloud
from core.grid.spatial_hash import SpatialHashGrid
from core.perception.segmentation_infer import SemanticSegmentationEngine
from core.tracking.mos_filter import MovingObjectSegmentationFilter


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
    mos = MovingObjectSegmentationFilter()

    initial_telemetry = grid.export_telemetry()
    allocated_mb = initial_telemetry["total_heap_mb"]
    under_drdo = initial_telemetry["under_drdo_bound"]

    latencies_ms: List[float] = []
    infer_latencies_ms: List[float] = []
    points_per_frame: List[int] = []
    active_cells_per_frame: List[int] = []

    start_total_time = time.perf_counter()

    for idx, file_path in enumerate(target_files):
        # 1. Ingest raw points
        raw_points = load_kitti_bin(file_path, use_mmap=False)

        # 2. Sanitize points (drop NaNs, infs, ego vehicle self-hits < 0.5m)
        sanitized_pts, _ = sanitize_point_cloud(raw_points, min_range=0.5, max_range=120.0)

        # 3. Semantic Segmentation Inference
        t_inf0 = time.perf_counter()
        semantic_labels = engine.infer(sanitized_pts)
        t_inf1 = time.perf_counter()
        infer_ms = (t_inf1 - t_inf0) * 1000.0
        infer_latencies_ms.append(infer_ms)

        # 4. Moving Object Segmentation (isolate dynamic returns)
        static_pts, dyn_pts, is_dyn = mos.separate_dynamic_points(
            sanitized_pts, semantic_labels=semantic_labels
        )

        # 5. Timed insertion into bounded spatial hash
        grid.reset()
        t0 = time.perf_counter()
        active_count = grid.insert_points(static_pts, semantic_labels=semantic_labels[~is_dyn])
        t1 = time.perf_counter()

        frame_ms = (t1 - t0) * 1000.0
        latencies_ms.append(frame_ms)
        points_per_frame.append(len(sanitized_pts))
        active_cells_per_frame.append(active_count)

        if (idx + 1) % 25 == 0 or (idx + 1) == total_frames:
            print(
                f"  Frame [{idx + 1:4d}/{total_frames}] | "
                f"Points: {len(sanitized_pts):6d} | "
                f"Infer: {infer_ms:5.1f} ms | "
                f"Active Cells: {active_count:5d} | "
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
            "drdo_bound_mb": 3.5,
            "under_drdo_bound": under_drdo,
            "max_active_cells": max_active_cells,
            "mean_active_cells": round(mean_active_cells, 1),
            "table_capacity": grid.capacity,
            "peak_load_factor": round(max_active_cells / grid.capacity, 4),
        },
        "points": {
            "mean_points_per_frame": round(mean_points, 1),
            "total_points_processed": int(np.sum(points_arr)),
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

    print("\n" + "=" * 60)
    print("  RESULTS SUMMARY (Real SemanticKITTI Sequence 08)")
    print("=" * 60)
    print(f"  Frames Evaluated:        {total_frames}")
    print(f"  Avg Points/Frame:        {mean_points:,.0f}")
    print(f"  Mean Active Cells:       {mean_active_cells:,.0f} (Peak: {max_active_cells})")
    print(f"  Heap Memory:             {allocated_mb:.2f} MB (DRDO Bound: < 3.5 MB: {under_drdo})")
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
