"""Evaluates Real Moving Object Segmentation (MOS) Precision, Recall & Ego-Turn Robustness.

Addresses SIH26053 Standards 3.1, 3.2, and Task 4.3:
  - Standard 3.1: Zero ghost trails measured on real moving sequences.
  - Standard 3.2: Moving vs static classification precision/recall against GT classes 252-259.
  - Task 4.3: Ego-turn viewpoint robustness check on real turning sequences (confirm parked cars
    and static obstacles are not falsely flagged during ego vehicle rotation).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional, Tuple, Union

# Add project root to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np

from core.ingestion.loader import (
    load_kitti_bin,
    load_kitti_label,
    sanitize_point_cloud,
    compute_azimuth_timestamps,
)
from core.ingestion.odometry import LidarOdometryDeskewer
from core.perception.segmentation_infer import SemanticSegmentationEngine
from core.tracking.mos_filter import MovingObjectSegmentationFilter, MOVING_CLASS_MIN, MOVING_CLASS_MAX
from core.tracking.kalman_tracker import DynamicObstacleTracker
from core.tracking.free_space_eraser import FreeSpaceGhostEraser
from core.grid.spatial_hash import SpatialHashGrid


def evaluate_dynamic_mos(
    seq_dir: Optional[Union[str, Path]] = None,
    max_frames: int = 50,
    disparity_thresh_m: float = 0.35,
    output_json: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    resolved_seq_dir = Path(seq_dir) if seq_dir else (REPO_ROOT / "data" / "real" / "sequences" / "08")
    resolved_output = Path(output_json) if output_json else (REPO_ROOT / "benchmark" / "real_dynamic_mos_results.json")

    velodyne_dir = resolved_seq_dir / "velodyne"
    labels_dir = resolved_seq_dir / "labels"

    bin_files = sorted(list(velodyne_dir.glob("*.bin")))[:max_frames]
    if not bin_files:
        raise FileNotFoundError(f"No .bin files found in {velodyne_dir}")

    deskewer = LidarOdometryDeskewer(voxel_size=0.8, max_range=60.0, deskew=True)
    mos = MovingObjectSegmentationFilter(range_disparity_thresh_m=disparity_thresh_m)
    engine = SemanticSegmentationEngine()
    tracker = DynamicObstacleTracker(dt=0.1, min_hits_to_confirm=2)
    grid = SpatialHashGrid()
    eraser = FreeSpaceGhostEraser(stride=16, clearance_tolerance_m=0.4)

    # Metrics accumulation
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_tn = 0

    total_gt_dynamic_pts = 0
    total_pred_dynamic_pts = 0
    total_points = 0
    total_ghost_cells_erased = 0
    total_tracks = 0

    # Ego-turn robustness evaluation buckets
    straight_fp = 0
    straight_tn = 0
    straight_frames = 0

    turning_fp = 0
    turning_tn = 0
    turning_frames = 0
    turning_indices = []

    print(f"[*] Starting Dynamic MOS & Ego-Turn Benchmark on {len(bin_files)} frames of Seq 08...")
    t0_start = time.perf_counter()

    for idx, bin_path in enumerate(bin_files):
        lbl_path = labels_dir / f"{bin_path.stem}.label"
        raw_pts = load_kitti_bin(str(bin_path))
        sanitized_pts, _ = sanitize_point_cloud(raw_pts, min_range=1.0, max_range=60.0)
        timestamps = compute_azimuth_timestamps(sanitized_pts, scan_frequency_hz=10.0)

        # Scan-to-scan odometry & delta pose
        deskewed_pts, delta_pose, current_pose = deskewer.process_frame(sanitized_pts, timestamps, dt=0.1)

        # Semantic inference
        pred_sem = engine.infer(deskewed_pts)

        # Separate dynamic points
        static_pts, dyn_pts, is_dyn = mos.separate_dynamic_points(
            deskewed_pts,
            semantic_labels=pred_sem,
            delta_pose_from_last=delta_pose if idx > 0 else None,
        )

        # Tracking & ghost erasing
        active_tracks = tracker.update(dyn_pts)
        total_tracks += len(active_tracks)

        if idx % 10 == 0:
            grid.reset()
        grid.insert_points(static_pts, semantic_labels=pred_sem[~is_dyn])

        if len(dyn_pts) > 0 and len(active_tracks) > 0:
            erased = eraser.erase_ghost_trails(grid, dyn_pts[::32], max_ray_range_m=35.0)
            total_ghost_cells_erased += erased

        # Ground truth comparison if label exists
        if lbl_path.exists():
            gt_sem_raw, _ = load_kitti_label(str(lbl_path))
            # Align with sanitized points range
            dists = np.linalg.norm(raw_pts[:, :3], axis=1)
            valid_mask = (dists >= 1.0) & (dists <= 60.0) & (~np.isnan(raw_pts).any(axis=1))
            gt_sem = gt_sem_raw[valid_mask]

            if len(gt_sem) == len(is_dyn):
                gt_is_dynamic = (gt_sem >= MOVING_CLASS_MIN) & (gt_sem <= MOVING_CLASS_MAX)
                pred_is_dynamic = is_dyn

                tp = int(np.sum(pred_is_dynamic & gt_is_dynamic))
                fp = int(np.sum(pred_is_dynamic & (~gt_is_dynamic)))
                fn = int(np.sum((~pred_is_dynamic) & gt_is_dynamic))
                tn = int(np.sum((~pred_is_dynamic) & (~gt_is_dynamic)))

                total_tp += tp
                total_fp += fp
                total_fn += fn
                total_tn += tn

                total_gt_dynamic_pts += int(np.sum(gt_is_dynamic))
                total_pred_dynamic_pts += int(np.sum(pred_is_dynamic))
                total_points += len(gt_sem)

                # Compute ego rotational yaw velocity |omega_z|
                if delta_pose is not None:
                    # R_00 = delta_pose[0, 0], R_10 = delta_pose[1, 0]
                    yaw_delta_rad = float(np.arctan2(delta_pose[1, 0], delta_pose[0, 0]))
                    yaw_rate_rad_s = abs(yaw_delta_rad) / 0.1

                    is_turning = yaw_rate_rad_s >= 0.08  # ~4.6 deg/s threshold

                    if is_turning:
                        turning_fp += fp
                        turning_tn += tn
                        turning_frames += 1
                        turning_indices.append(idx)
                    else:
                        straight_fp += fp
                        straight_tn += tn
                        straight_frames += 1

        if (idx + 1) % 10 == 0 or (idx + 1) == len(bin_files):
            cur_p = (total_tp / max(total_tp + total_fp, 1)) * 100.0
            cur_r = (total_tp / max(total_tp + total_fn, 1)) * 100.0
            print(
                f"  Frame [{idx+1:3d}/{len(bin_files)}] | "
                f"Dynamic Pts: {total_pred_dynamic_pts:7,d} | "
                f"Tracks: {len(active_tracks):2d} | "
                f"Ghost Erased: {total_ghost_cells_erased:4d} | "
                f"Precision: {cur_p:5.1f}% | Recall: {cur_r:5.1f}%"
            )

    total_eval_time_s = time.perf_counter() - t0_start

    # Global MOS Performance Metrics
    precision = (total_tp / max(total_tp + total_fp, 1)) * 100.0
    recall = (total_tp / max(total_tp + total_fn, 1)) * 100.0
    f1 = (2.0 * precision * recall / max(precision + recall, 1e-4))
    overall_fpr = (total_fp / max(total_fp + total_tn, 1)) * 100.0

    # Ego-Turn Viewpoint Robustness Metrics (Task 4.3)
    straight_fpr = (straight_fp / max(straight_fp + straight_tn, 1)) * 100.0
    turning_fpr = (turning_fp / max(turning_fp + turning_tn, 1)) * 100.0
    fpr_delta = turning_fpr - straight_fpr

    robustness_passed = turning_fpr < 3.5 and fpr_delta < 1.5

    report: Dict[str, Any] = {
        "dataset": "SemanticKITTI",
        "sequence": "08",
        "frames_evaluated": len(bin_files),
        "total_points_evaluated": total_points,
        "total_gt_dynamic_points": total_gt_dynamic_pts,
        "total_pred_dynamic_points": total_pred_dynamic_pts,
        "confusion_matrix": {
            "true_positives": total_tp,
            "false_positives": total_fp,
            "false_negatives": total_fn,
            "true_negatives": total_tn,
        },
        "classification_metrics": {
            "precision_pct": round(precision, 2),
            "recall_pct": round(recall, 2),
            "f1_score_pct": round(f1, 2),
            "false_positive_rate_pct": round(overall_fpr, 3),
        },
        "task_4_3_ego_turn_robustness": {
            "straight_driving_frames": straight_frames,
            "straight_fpr_pct": round(straight_fpr, 3),
            "turning_frames": turning_frames,
            "turning_fpr_pct": round(turning_fpr, 3),
            "fpr_degradation_during_turn_pct": round(fpr_delta, 3),
            "viewpoint_robustness_check_passed": robustness_passed,
            "turning_frame_indices": turning_indices,
        },
        "anti_ghosting_metrics": {
            "kalman_tracks_formed": total_tracks,
            "ghost_cells_carved": total_ghost_cells_erased,
            "range_disparity_thresh_m": disparity_thresh_m,
        },
        "total_run_time_s": round(total_eval_time_s, 2),
    }

    resolved_output.parent.mkdir(parents=True, exist_ok=True)
    with open(resolved_output, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 65)
    print("  PHASE 4 DYNAMIC MOS & EGO-TURN ROBUSTNESS REPORT")
    print("=" * 65)
    print(f"  Frames Evaluated:        {len(bin_files)}")
    print(f"  Total Evaluated Points:  {total_points:,}")
    print(f"  GT Moving Points:        {total_gt_dynamic_pts:,}")
    print(f"  MOS Precision:           {precision:5.2f}%")
    print(f"  MOS Recall:              {recall:5.2f}%")
    print(f"  MOS F1 Score:            {f1:5.2f}%")
    print(f"  Static FPR (Overall):    {overall_fpr:5.3f}%")
    print(f"  Ghost Cells Carved:      {total_ghost_cells_erased:,}")
    print("-" * 65)
    print("  Task 4.3 — Ego-Turn Viewpoint Robustness Check:")
    print(f"    Straight Driving FPR:  {straight_fpr:5.3f}% ({straight_frames} frames)")
    print(f"    Turning Driving FPR:   {turning_fpr:5.3f}% ({turning_frames} frames)")
    print(f"    Turn FPR Delta:        {fpr_delta:+5.3f}%")
    print(f"    Robustness Verdict:    {'PASSED (No false ghosting during turns)' if robustness_passed else 'NEEDS TUNING'}")
    print(f"  Saved full report to:    {resolved_output.resolve()}")
    print("=" * 65 + "\n")

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Dynamic MOS & Ego-Turn Robustness on Seq 08")
    parser.add_argument(
        "--seq-dir",
        type=str,
        default=str(REPO_ROOT / "data" / "real" / "sequences" / "08"),
        help="Path to sequence directory containing velodyne/ and labels/",
    )
    parser.add_argument("--max-frames", type=int, default=50, help="Number of frames to evaluate (default: 50)")
    parser.add_argument("--disparity-thresh", type=float, default=0.35, help="MOS disparity threshold in meters")
    parser.add_argument(
        "--output",
        type=str,
        default=str(REPO_ROOT / "benchmark" / "real_dynamic_mos_results.json"),
        help="Path to output JSON report",
    )
    args = parser.parse_args()

    evaluate_dynamic_mos(
        seq_dir=args.seq_dir,
        max_frames=args.max_frames,
        disparity_thresh_m=args.disparity_thresh,
        output_json=args.output,
    )
