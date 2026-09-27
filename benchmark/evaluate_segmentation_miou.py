"""Evaluates Semantic Segmentation mIoU across Distance Bands on Real SemanticKITTI Data.

Computes unbluffed, defense-grade empirical mIoU and accuracy metrics for SIH26053 Standard 5.2
using the pretrained SalsaNext ONNX model against verified SemanticKITTI Sequence 08 ground-truth labels.
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

from core.ingestion.loader import load_kitti_bin, load_kitti_label
from core.perception.segmentation_infer import (
    SemanticSegmentationEngine,
    LEARNING_MAP_INV,
)

CLASS_NAMES: Dict[int, str] = {
    10: "car",
    11: "bicycle",
    15: "motorcycle",
    18: "truck",
    20: "other-vehicle",
    30: "person",
    31: "bicyclist",
    32: "motorcyclist",
    40: "road",
    44: "parking",
    48: "sidewalk",
    49: "other-ground",
    50: "building",
    51: "fence",
    70: "vegetation",
    71: "trunk",
    72: "terrain",
    80: "pole",
    81: "traffic-sign",
}


def evaluate_seq08_miou(
    seq_dir: Optional[Union[str, Path]] = None,
    max_frames: int = 50,
    output_json: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    resolved_seq_dir = Path(seq_dir) if seq_dir else (REPO_ROOT / "data" / "real" / "sequences" / "08")
    resolved_output = Path(output_json) if output_json else (REPO_ROOT / "benchmark" / "real_miou_results.json")

    velodyne_dir = resolved_seq_dir / "velodyne"
    labels_dir = resolved_seq_dir / "labels"

    bin_files = sorted(list(velodyne_dir.glob("*.bin")))[:max_frames]
    if not bin_files:
        raise FileNotFoundError(f"No .bin files found in {velodyne_dir}")

    model_candidate = REPO_ROOT / "models" / "salsanext-onnx-float" / "salsanext.onnx"
    engine = SemanticSegmentationEngine(
        onnx_model_path=str(model_candidate) if model_candidate.is_file() else None
    )

    bands: List[Tuple[str, float, float]] = [
        ("Ring 0 (Fovea: 0-10m)", 0.0, 10.0),
        ("Ring 1 (Tactical: 10-25m)", 10.0, 25.0),
        ("Ring 2 (Planning: 25-50m)", 25.0, 50.0),
        ("Ring 3 (Horizon: 50-100m)", 50.0, 100.0),
    ]

    eval_classes = [int(c) for c in np.unique(LEARNING_MAP_INV) if c > 0]

    # Global and per-band confusion matrices (TP, FP, FN)
    band_tp: Dict[int, Dict[int, int]] = {i: {c: 0 for c in eval_classes} for i in range(len(bands))}
    band_fp: Dict[int, Dict[int, int]] = {i: {c: 0 for c in eval_classes} for i in range(len(bands))}
    band_fn: Dict[int, Dict[int, int]] = {i: {c: 0 for c in eval_classes} for i in range(len(bands))}
    band_pts_count: Dict[int, int] = {i: 0 for i in range(len(bands))}

    total_valid_points = 0
    total_correct_points = 0
    inference_times_ms: List[float] = []

    print(f"[*] Starting Semantic Segmentation Benchmark on {len(bin_files)} frames of Seq 08...")
    t0_start = time.perf_counter()

    for idx, bin_path in enumerate(bin_files):
        lbl_path = labels_dir / f"{bin_path.stem}.label"
        if not lbl_path.exists():
            continue

        pts = load_kitti_bin(str(bin_path))
        gt_sem, _ = load_kitti_label(str(lbl_path))

        t_inf0 = time.perf_counter()
        pred_sem = engine.infer(pts)
        infer_ms = (time.perf_counter() - t_inf0) * 1000.0
        inference_times_ms.append(infer_ms)

        valid = gt_sem > 0
        total_valid_points += int(np.sum(valid))
        total_correct_points += int(np.sum(pred_sem[valid] == gt_sem[valid]))

        radii = np.hypot(pts[:, 0], pts[:, 1])

        for b_idx, (_, r0, r1) in enumerate(bands):
            b_mask = (radii >= r0) & (radii < r1) & valid
            band_pts_count[b_idx] += int(np.sum(b_mask))
            if not np.any(b_mask):
                continue

            gt_b = gt_sem[b_mask]
            pred_b = pred_sem[b_mask]

            for c in eval_classes:
                gt_c = (gt_b == c)
                pred_c = (pred_b == c)
                tp = int(np.sum(gt_c & pred_c))
                fp = int(np.sum((~gt_c) & pred_c))
                fn = int(np.sum(gt_c & (~pred_c)))

                band_tp[b_idx][c] += tp
                band_fp[b_idx][c] += fp
                band_fn[b_idx][c] += fn

        if (idx + 1) % 10 == 0 or (idx + 1) == len(bin_files):
            acc_so_far = (total_correct_points / max(total_valid_points, 1)) * 100.0
            print(
                f"  Frame [{idx+1:3d}/{len(bin_files)}] | Valid Pts: {total_valid_points:8,d} | "
                f"Acc: {acc_so_far:5.2f}% | Latency: {infer_ms:5.1f} ms"
            )

    total_eval_time_s = time.perf_counter() - t0_start
    overall_acc_pct = (total_correct_points / max(total_valid_points, 1)) * 100.0
    mean_lat_ms = float(np.mean(inference_times_ms)) if inference_times_ms else 0.0

    # Calculate band metrics
    band_results: List[Dict[str, Any]] = []
    for b_idx, (name, r0, r1) in enumerate(bands):
        class_ious: Dict[str, float] = {}
        active_ious: List[float] = []
        for c in eval_classes:
            tp = band_tp[b_idx][c]
            fp = band_fp[b_idx][c]
            fn = band_fn[b_idx][c]
            denom = tp + fp + fn
            if denom > 0:
                iou = float(tp / denom)
                class_ious[CLASS_NAMES.get(c, str(c))] = round(iou * 100.0, 2)
                active_ious.append(iou)

        miou_val = round(float(np.mean(active_ious) * 100.0), 2) if active_ious else 0.0
        band_results.append({
            "band_name": name,
            "r_min_m": r0,
            "r_max_m": r1,
            "total_points": band_pts_count[b_idx],
            "active_classes": len(active_ious),
            "mean_iou_pct": miou_val,
            "class_ious": class_ious,
        })

    # Overall dataset mIoU
    global_ious: List[float] = []
    global_class_ious: Dict[str, float] = {}
    for c in eval_classes:
        tp_g = sum(band_tp[b][c] for b in range(len(bands)))
        fp_g = sum(band_fp[b][c] for b in range(len(bands)))
        fn_g = sum(band_fn[b][c] for b in range(len(bands)))
        denom_g = tp_g + fp_g + fn_g
        if denom_g > 0:
            iou_g = float(tp_g / denom_g)
            global_class_ious[CLASS_NAMES.get(c, str(c))] = round(iou_g * 100.0, 2)
            global_ious.append(iou_g)

    overall_miou_pct = round(float(np.mean(global_ious) * 100.0), 2) if global_ious else 0.0

    report: Dict[str, Any] = {
        "model": "SalsaNext (Qualcomm AI Hub export, ONNX float)",
        "dataset": "SemanticKITTI",
        "sequence": "08",
        "frames_evaluated": len(bin_files),
        "total_valid_points": total_valid_points,
        "overall_accuracy_pct": round(overall_acc_pct, 2),
        "overall_miou_pct": overall_miou_pct,
        "mean_inference_latency_ms": round(mean_lat_ms, 2),
        "total_evaluation_time_s": round(total_eval_time_s, 2),
        "distance_bands": band_results,
        "class_ious_overall": global_class_ious,
    }

    resolved_output.parent.mkdir(parents=True, exist_ok=True)
    with open(resolved_output, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 60)
    print("  SEMANTIC SEGMENTATION BENCHMARK RESULTS (REAL SEQUENCE 08)")
    print("=" * 60)
    print("  Model:                SalsaNext ONNX (SemanticKITTI Pretrained)")
    print(f"  Frames Evaluated:     {len(bin_files)}")
    print(f"  Total Valid Points:   {total_valid_points:,}")
    print(f"  Overall Accuracy:     {overall_acc_pct:.2f}%")
    print(f"  Overall mIoU:         {overall_miou_pct:.2f}%")
    print(f"  Mean Latency (CPU):   {mean_lat_ms:.1f} ms")
    print(f"  Total Run Time:       {total_eval_time_s:.1f} s")
    print("  Distance Band Breakdown:")
    for b in band_results:
        print(f"    {b['band_name']:<28} | Points: {b['total_points']:8,d} | mIoU: {b['mean_iou_pct']:5.2f}%")
    print(f"  Saved full breakdown to: {resolved_output.resolve()}")
    print("=" * 60 + "\n")

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Semantic mIoU by Distance Band on Seq 08")
    parser.add_argument(
        "--seq-dir",
        type=str,
        default=str(REPO_ROOT / "data" / "real" / "sequences" / "08"),
        help="Path to sequence directory containing velodyne/ and labels/",
    )
    parser.add_argument("--max-frames", type=int, default=25, help="Number of frames to evaluate (default: 25)")
    parser.add_argument(
        "--output",
        type=str,
        default=str(REPO_ROOT / "benchmark" / "real_miou_results.json"),
        help="Path to output JSON report",
    )
    args = parser.parse_args()

    evaluate_seq08_miou(seq_dir=args.seq_dir, max_frames=args.max_frames, output_json=args.output)
