"""High-Performance FastAPI & Binary WebSocket Streaming Telemetry Server.

Streams LiMap 2.5D multi-layer elevation data, memory metrics, and tracked obstacles
via zero-copy binary ArrayBuffers to the UI/UX Pro Max dashboard.
Provides REST APIs for cross-section slicing, benchmark verification, and scene selection.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import struct
import subprocess
import sys
import threading
import time
import unicodedata
from typing import Dict, List, Optional, Tuple

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np

from core.ingestion.loader import load_kitti_bin, load_kitti_label, sanitize_point_cloud
from core.grid.spatial_hash import SpatialHashGrid
from core.grid.baselines import calculate_baselines
from core.perception.segmentation_infer import SemanticSegmentationEngine
from core.tracking.mos_filter import MovingObjectSegmentationFilter
from core.tracking.kalman_tracker import DynamicObstacleTracker
from core.planning.costmap_generator import CostmapGenerator

app = FastAPI(
    title="LiMap 2.5D Defense Perception Telemetry API",
    version="1.0.0",
    description="SIH26053 / DRDO Real-Time Adaptive Variable-Resolution 2.5D LiDAR Perception Stack",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Global persistent system state
GLOBAL_GRID = SpatialHashGrid()
SEMANTIC_ENGINE = SemanticSegmentationEngine()
MOS_FILTER = MovingObjectSegmentationFilter()
TRACKER = DynamicObstacleTracker(dt=0.1)
COSTMAP_GEN = CostmapGenerator(grid_width_m=70.0, grid_height_m=70.0)

# Scene id -> (point file, label file), relative to the repo root.
SCENE_FILES: Dict[str, Tuple[str, str]] = {
    "scene_a_bridge": ("data/synthetic/scene_a_bridge_underpass.bin", "data/synthetic/scene_a_bridge_underpass.label"),
    "scene_b_potholes": ("data/synthetic/scene_b_pothole_cluster.bin", "data/synthetic/scene_b_pothole_cluster.label"),
    "scene_c_moving": ("data/synthetic/scene_c_moving_veh_frame_02.bin", "data/synthetic/scene_c_moving_veh_frame_02.label"),
    "scene_d_poles": ("data/synthetic/scene_d_thin_pole_array.bin", "data/synthetic/scene_d_thin_pole_array.label"),
    "real_seq08_f00": ("data/real/sequences/08/velodyne/000000.bin", "data/real/sequences/08/labels/000000.label"),
    "real_seq08_f25": ("data/real/sequences/08/velodyne/000025.bin", "data/real/sequences/08/labels/000025.label"),
    "real_seq08_f50": ("data/real/sequences/08/velodyne/000050.bin", "data/real/sequences/08/labels/000050.label"),
    "real_seq08_f100": ("data/real/sequences/08/velodyne/000100.bin", "data/real/sequences/08/labels/000100.label"),
}

# Whitelisted benchmark result files (name -> path relative to repo root).
# Only these can be served; there is no path parameter, so traversal is impossible.
RESULTS_WHITELIST: Dict[str, str] = {
    "fidelity": "benchmark/fidelity_study_results.json",
    "latency": "benchmark/latency_profile_results.json",
    "miou": "benchmark/real_miou_results.json",
    "mos": "benchmark/real_dynamic_mos_results.json",
    "regret": "benchmark/real_regret_results.json",
    "edge_profile": "benchmark/edge_hardware_profile.json",
}

# Sentinel used by SpatialHashGrid for "no overhang / no clearance" (spatial_hash.py).
NO_VALUE_THRESHOLD = 900.0


class SceneError(Exception):
    """Raised by load_scene_into; carries the HTTP status the route should return."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def resolve_scene_files(scene_id: str) -> Tuple[Path, Path]:
    """Maps a scene id to (point file, label file) absolute paths."""
    if scene_id in SCENE_FILES:
        bin_rel, lbl_rel = SCENE_FILES[scene_id]
    elif scene_id.startswith("real_seq08_f"):
        try:
            f_num = int(scene_id.replace("real_seq08_f", ""))
        except ValueError:
            raise SceneError(404, "UNKNOWN_SCENE", f"Invalid scene ID format: {scene_id}")
        bin_rel = f"data/real/sequences/08/velodyne/{f_num:06d}.bin"
        lbl_rel = f"data/real/sequences/08/labels/{f_num:06d}.label"
    else:
        raise SceneError(404, "UNKNOWN_SCENE", f"Unknown scene: {scene_id}")
    return REPO_ROOT / bin_rel, REPO_ROOT / lbl_rel


def load_scene_arrays(
    scene_id: str, engine: Optional[SemanticSegmentationEngine] = None
) -> Tuple[np.ndarray, np.ndarray, str]:
    """Reads a scene from disk: sanitized points, per-point semantic ids, and where the labels came from.

    Labels are filtered by the same mask as the points, so the two arrays always stay aligned.
    """
    bin_file, lbl_file = resolve_scene_files(scene_id)
    if not bin_file.is_file():
        raise SceneError(503, "SCENE_DATA_MISSING", f"Scene binary not found: {bin_file.relative_to(REPO_ROOT)}")

    raw_pts = load_kitti_bin(str(bin_file))
    if lbl_file.is_file():
        raw_sem = load_kitti_label(str(lbl_file))[0]
        pts, sem = sanitize_point_cloud(raw_pts, min_range=0.5, max_range=120.0, labels=raw_sem)
        return pts, sem, "gt"

    pts, _ = sanitize_point_cloud(raw_pts, min_range=0.5, max_range=120.0)
    engine = engine or SEMANTIC_ENGINE
    sem = engine.infer(pts)
    return pts, sem, "onnx" if getattr(engine, "session", None) is not None else "heuristic"


def load_scene_into(grid: SpatialHashGrid, scene_id: str, engine: Optional[SemanticSegmentationEngine] = None) -> Dict[str, object]:
    """Loads a scene into `grid` (reset first). Shared by /api/load_scene and the snapshot exporter."""
    pts, sem, label_source = load_scene_arrays(scene_id, engine)
    grid.reset()
    grid.insert_points(pts, semantic_labels=sem)
    return {
        "status": "SUCCESS",
        "loaded_scene": scene_id,
        "points": int(len(pts)),
        "active_cells": int(grid.active_count),
        "label_source": label_source,
    }


_default_bin, _default_lbl = (REPO_ROOT / f for f in SCENE_FILES["scene_a_bridge"])
if _default_bin.is_file():
    _pts = load_kitti_bin(str(_default_bin))
    _sem = load_kitti_label(str(_default_lbl))[0] if _default_lbl.is_file() else None
    GLOBAL_GRID.insert_points(_pts, semantic_labels=_sem)

DIST_DIR = Path(__file__).resolve().parent.parent / "client" / "dist"
if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


# ---------------------------------------------------------------------------
# Pure builders (no FastAPI types) - reused by scripts/export_dashboard_data.py
# so the static snapshots and the live API can never drift apart.
# ---------------------------------------------------------------------------

def build_telemetry(grid: SpatialHashGrid) -> Dict[str, object]:
    """Memory footprint, active cells, load factor, and baseline comparison."""
    telemetry = dict(grid.export_telemetry())
    # API-layer rename: the core keeps its historical key, the UI never sees "DRDO bound".
    telemetry.pop("under_drdo_bound", None)
    telemetry["within_pool_budget"] = bool(telemetry["total_heap_mb"] < 3.5)
    baselines = calculate_baselines()
    return {
        "telemetry": telemetry,
        "baselines": {
            "dense_3d_voxel_mb": baselines.dense_3d_voxel_mb,
            "uniform_25d_mb": baselines.uniform_25d_mb,
            "foveagrid_25d_mb": baselines.foveagrid_25d_mb,
            "reduction_vs_3d": f"{baselines.reduction_vs_3d:.1f}x",
            "reduction_vs_uniform_25d": f"{baselines.reduction_vs_uniform_25d:.1f}x",
            "within_pool_budget": telemetry["within_pool_budget"],
            "per_ring_breakdown": baselines.per_ring_breakdown,
        },
    }


def _opt(value: float) -> Optional[float]:
    """Rounds a cell value, mapping the 'no value' sentinel to None."""
    v = float(value)
    if v >= NO_VALUE_THRESHOLD or v <= -NO_VALUE_THRESHOLD:
        return None
    return round(v, 2)


def build_grid_cells(grid: SpatialHashGrid, limit: int = 5000, ring_id: Optional[int] = None) -> Dict[str, object]:
    """Active cells with resolution tier, semantics, height, variance, clearance. Optionally one resolution ring only."""
    active = grid.get_active_cells()
    if ring_id is not None:
        active = active[active["ring_id"] == ring_id]
    if len(active) == 0:
        return {"total_active": 0, "sampled_count": 0, "sampled": False, "heap_mb": grid.total_memory_mb, "cells": []}

    sampled_flag = len(active) > limit
    if sampled_flag:
        indices = np.linspace(0, len(active) - 1, limit, dtype=np.int32)
        sampled = active[indices]
    else:
        sampled = active

    lattice = grid.lattice
    cell_list = []
    for c in sampled:
        r_id = int(c["ring_id"])
        res = float(lattice.rings[r_id].cell_size) if r_id < len(lattice.rings) else 0.1
        count = int(c["count"])
        variance = float(c["m2_z"] / (count - 1)) if count > 1 else 0.0

        cell_list.append({
            "ix": int(c["ix"]),
            "iy": int(c["iy"]),
            "ring_id": r_id,
            "res_m": res,
            "x_m": round(float(c["ix"] * res + res * 0.5), 2),
            "y_m": round(float(c["iy"] * res + res * 0.5), 2),
            "sem_id": int(c["sem_id"]),
            "count": count,
            "mean_z": round(float(c["mean_z"]), 2),
            "variance": round(variance, 4),
            "min_z": round(float(c["min_z"]), 2),
            "max_z": round(float(c["max_z"]), 2),
            "overhang_z": _opt(c["overhang_z"]),
            "clearance": _opt(c["clearance"]),
        })

    return {
        "total_active": int(len(active)),
        "sampled_count": len(cell_list),
        "sampled": sampled_flag,
        "heap_mb": grid.total_memory_mb,
        "cells": cell_list,
    }


def build_cross_section(
    grid: SpatialHashGrid,
    x_start: float = 5.0,
    y_start: float = 0.0,
    x_end: float = 28.0,
    y_end: float = 0.0,
    samples: int = 80,
) -> Dict[str, object]:
    """Slices through the grid for an elevation / clearance profile.

    Samples that fall in an empty cell (or outside the lattice) are returned with
    observed=False and null elevation - never a made-up road surface.
    """
    s_vals = np.linspace(0.0, 1.0, samples)
    xs = x_start + s_vals * (x_end - x_start)
    ys = y_start + s_vals * (y_end - y_start)
    distances = np.hypot(xs - x_start, ys - y_start)

    lattice = grid.lattice
    profile = []

    for d, x, y in zip(distances, xs, ys):
        rad = float(np.hypot(x, y))
        r_id: Optional[int] = None
        for cfg in lattice.rings:
            if cfg.r_inner <= rad < cfg.r_outer:
                r_id = cfg.ring_id
                break

        base = {
            "distance_m": round(float(d), 2),
            "x": round(float(x), 2),
            "y": round(float(y), 2),
        }
        unobserved = {
            **base,
            "observed": False,
            "ring_id": r_id,
            "z_ground": None,
            "z_overhang": None,
            "clearance_m": None,
            "variance": None,
            "sem_id": None,
        }
        if r_id is None:
            profile.append(unobserved)
            continue

        res = lattice.rings[r_id].cell_size
        ix = int(np.floor(x / res))
        iy = int(np.floor(y / res))
        base_slot = grid._hash_coords(ix, iy, r_id)

        found = False
        for step in range(grid.max_probe_steps):
            slot = (base_slot + step) % grid.capacity
            cell = grid.cells[slot]
            if cell["occupied"] == 0:
                break
            if cell["ix"] == ix and cell["iy"] == iy and cell["ring_id"] == r_id:
                profile.append({
                    **base,
                    "observed": True,
                    "ring_id": r_id,
                    "z_ground": round(float(cell["mean_z"]), 2),
                    "z_overhang": _opt(cell["overhang_z"]),
                    "clearance_m": _opt(cell["clearance"]),
                    "variance": round(float(cell["m2_z"] / max(int(cell["count"]) - 1, 1)), 4),
                    "sem_id": int(cell["sem_id"]),
                })
                found = True
                break

        if not found:
            profile.append(unobserved)

    return {
        "x_start": x_start,
        "y_start": y_start,
        "x_end": x_end,
        "y_end": y_end,
        "profile": profile,
    }


def build_result_envelope(name: str) -> Dict[str, object]:
    """Wraps a whitelisted benchmark JSON with provenance (path, sha256, mtime)."""
    if name not in RESULTS_WHITELIST:
        raise KeyError(name)
    rel = RESULTS_WHITELIST[name]
    path = REPO_ROOT / rel
    raw = path.read_bytes()
    return {
        "name": name,
        "source_path": rel,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "mtime": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        "data": json.loads(raw.decode("utf-8")),
    }


# Snapshot builders. They live here (moved from scripts/export_dashboard_data.py, which imports them back) so the
# committed static snapshots and the live POST /api/analyze_scan are produced by one implementation.

MAX_CELLS = 40_000  # stride-sampled above this and flagged `sampled`
MAX_POINTS = 25_000  # seeded subsample above this


def git_sha() -> str:
    """Short commit hash of this checkout, or "unknown" when git or the .git folder is missing. Never raises."""
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=Path(__file__).resolve().parent.parent.parent,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=10,
        ).strip()
        return out or "unknown"
    except Exception:
        return "unknown"


def _round_all(values: np.ndarray, nd: int) -> List[float]:
    return [round(float(v), nd) for v in values]


def cells_columnar(grid: SpatialHashGrid, limit: int) -> Dict[str, object]:
    """Active cells as parallel arrays. x/y/res are derived on the client from (ix, iy, ring)."""
    active = grid.get_active_cells()
    total = int(len(active))
    sampled = total > limit
    if sampled:
        active = active[np.linspace(0, total - 1, limit, dtype=np.int32)]

    count = active["count"].astype(np.int64)
    var = np.where(count > 1, active["m2_z"] / np.maximum(count - 1, 1), 0.0)
    oh = active["overhang_z"].astype(np.float64)
    cl = active["clearance"].astype(np.float64)
    oh_ok = np.abs(oh) < NO_VALUE_THRESHOLD
    cl_ok = np.abs(cl) < NO_VALUE_THRESHOLD

    return {
        "total_active": total,
        "n": int(len(active)),
        "sampled": sampled,
        "ix": active["ix"].astype(int).tolist(),
        "iy": active["iy"].astype(int).tolist(),
        "ring": active["ring_id"].astype(int).tolist(),
        "sem": active["sem_id"].astype(int).tolist(),
        "count": count.tolist(),
        "z": _round_all(active["mean_z"], 2),
        "var": _round_all(var, 4),
        "zmin": _round_all(active["min_z"], 2),
        "zmax": _round_all(active["max_z"], 2),
        "oh": [round(float(v), 2) if ok else None for v, ok in zip(oh, oh_ok)],
        "cl": [round(float(v), 2) if ok else None for v, ok in zip(cl, cl_ok)],
    }


def points_columnar(pts: np.ndarray, sem: np.ndarray, limit: int) -> Dict[str, object]:
    n = len(pts)
    idx = np.arange(n)
    if n > limit:
        idx = np.sort(np.random.default_rng(0).choice(n, size=limit, replace=False))
    return {
        "total": int(n),
        "n": int(len(idx)),
        "x": _round_all(pts[idx, 0], 2),
        "y": _round_all(pts[idx, 1], 2),
        "z": _round_all(pts[idx, 2], 2),
        "sem": sem[idx].astype(int).tolist(),
    }


def lattice_table(grid: SpatialHashGrid) -> List[Dict[str, float]]:
    return [
        {"ring_id": int(c.ring_id), "res_m": float(c.cell_size), "r_inner": float(c.r_inner), "r_outer": float(c.r_outer)}
        for c in grid.lattice.rings
    ]


def scene_snapshot(scene_id: str, kind: str, pts: np.ndarray, sem: np.ndarray, label_source: str,
                   inputs: Dict[str, str], note: Optional[str] = None) -> Dict[str, object]:
    """meta + telemetry + cross-section + cells + points for one scan, built on a FRESH grid (no global is touched)."""
    grid = SpatialHashGrid()
    grid.insert_points(pts, semantic_labels=sem)
    cells = cells_columnar(grid, MAX_CELLS)
    return {
        "meta": {
            "scene_id": scene_id,
            "kind": kind,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "git_sha": git_sha(),
            "label_source": label_source,
            "points_raw": int(len(pts)),
            "active_cells": int(grid.active_count),
            "cells_exported": cells["n"],
            "cells_sampled": cells["sampled"],
            "inputs_sha256": inputs,
            "lattice": lattice_table(grid),
            "note": note,
        },
        "telemetry": build_telemetry(grid),
        "cross_section": build_cross_section(grid),
        "cells": cells,
        "points": points_columnar(pts, sem, MAX_POINTS),
    }


# ---------------------------------------------------------------------------
# "Try your own scan": POST /api/analyze_scan (raw SemanticKITTI / Velodyne .bin bytes in, scene snapshot out)
# ---------------------------------------------------------------------------

MAX_SCAN_BYTES = 8 * 1024 * 1024  # published in /api/health; the upload is refused above this
SCAN_POINT_BYTES = 16  # float32 x, y, z, intensity
SCAN_MIN_RANGE_M = 0.5  # same sanitising window as load_scene_arrays
SCAN_MAX_RANGE_M = 120.0
SCAN_NAME_MAX_CHARS = 100
SCAN_DEFAULT_NAME = "scan.bin"
SCAN_ID = "upload"

# One analysis at a time: a second upload waits its turn (it is queued, never rejected).
_ANALYZE_LOCK = threading.Lock()


def _describe_bytes(n: int) -> str:
    return f"{n / (1024 * 1024):g} MB" if n >= 1024 * 1024 else f"{n:,} bytes"


def clean_scan_name(name: Optional[str]) -> str:
    """File name safe to echo back: final path component only, no control characters, length capped."""
    final = re.split(r"[\\/]", name or "")[-1]
    final = "".join(ch for ch in final if unicodedata.category(ch)[0] != "C")[:SCAN_NAME_MAX_CHARS].strip()
    return final if final not in ("", ".", "..") else SCAN_DEFAULT_NAME


def _scan_too_large() -> SceneError:
    return SceneError(
        413,
        "SCAN_TOO_LARGE",
        f"This file is larger than the {_describe_bytes(MAX_SCAN_BYTES)} limit for an uploaded scan. "
        "Upload a single LiDAR frame as a SemanticKITTI / Velodyne .bin file.",
    )


async def read_capped_body(request: Request, cap: int) -> bytes:
    """Reads the request body, refusing anything above `cap` without ever buffering more than cap bytes."""
    declared = request.headers.get("content-length")
    if declared is not None and declared.strip().isdigit() and int(declared) > cap:
        raise _scan_too_large()
    chunks: List[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > cap:
            raise _scan_too_large()
        chunks.append(chunk)
    return b"".join(chunks)


def analyze_scan_bytes(data: bytes, name: str) -> Dict[str, object]:
    """Runs one uploaded .bin through the real pipeline. Pure: fresh grid, no global state modified, nothing written."""
    if len(data) == 0:
        raise SceneError(400, "EMPTY_SCAN", "The file is empty (0 bytes). Choose a LiDAR scan saved as a SemanticKITTI / Velodyne .bin file.")
    if len(data) > MAX_SCAN_BYTES:
        raise _scan_too_large()
    if len(data) % SCAN_POINT_BYTES != 0:
        raise SceneError(
            400,
            "BAD_SCAN_SIZE",
            f"This file is {len(data):,} bytes, which is not a whole number of points. A SemanticKITTI / Velodyne .bin "
            f"stores {SCAN_POINT_BYTES} bytes per point (four 32-bit floats: x, y, z, intensity), "
            f"so its size must be a multiple of {SCAN_POINT_BYTES}.",
        )

    digest = hashlib.sha256(data).hexdigest()
    with _ANALYZE_LOCK:
        started = time.perf_counter()
        raw = np.frombuffer(data, dtype="<f4").astype(np.float32).reshape(-1, 4)  # astype copies: writable, native
        pts, _ = sanitize_point_cloud(raw, min_range=SCAN_MIN_RANGE_M, max_range=SCAN_MAX_RANGE_M)
        if len(pts) == 0:
            raise SceneError(
                400,
                "NO_VALID_POINTS",
                f"No usable points were left in this file: every point was missing (NaN or infinite) or outside "
                f"{SCAN_MIN_RANGE_M:g} to {SCAN_MAX_RANGE_M:g} m from the sensor. "
                "Check that it is a SemanticKITTI / Velodyne .bin (float32 x, y, z, intensity).",
            )
        sem = SEMANTIC_ENGINE.infer(pts)
        onnx = getattr(SEMANTIC_ENGINE, "session", None) is not None
        note = (
            "Uploaded scan, labelled by the ONNX segmentation model; these labels are model output, not ground truth."
            if onnx else
            "Uploaded scan, labelled by the geometric heuristic (no ONNX model is loaded); these labels are not ground truth."
        )
        snapshot = scene_snapshot(SCAN_ID, "upload", pts, sem, "onnx" if onnx else "heuristic", {name: digest}, note)
        snapshot["timing_ms"] = round((time.perf_counter() - started) * 1000.0, 1)
    return snapshot


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def serve_dashboard():
    if (DIST_DIR / "index.html").is_file():
        return FileResponse(DIST_DIR / "index.html")
    index_file = Path(__file__).resolve().parent.parent / "client" / "index.html"
    return FileResponse(index_file)


@app.get("/api/health")
def health_check() -> Dict[str, object]:
    return {
        "status": "ONLINE",
        "stack": "LiMap-2.5D",
        "active_cells": int(GLOBAL_GRID.active_count),
        "scenes": {sid: (REPO_ROOT / files[0]).is_file() for sid, files in SCENE_FILES.items()},
        "label_engine": "onnx" if SEMANTIC_ENGINE.session is not None else "heuristic",
        "max_scan_bytes": MAX_SCAN_BYTES,
    }


@app.get("/api/telemetry")
def get_telemetry() -> Dict[str, object]:
    """Returns memory footprint, active cells, load factor, and baseline comparison."""
    return build_telemetry(GLOBAL_GRID)


@app.get("/api/cross_section")
def get_cross_section(
    x_start: float = 5.0,
    y_start: float = 0.0,
    x_end: float = 28.0,
    y_end: float = 0.0,
    samples: int = Query(80, ge=2, le=1000),
) -> Dict[str, object]:
    """Slices through the grid to extract continuous elevation and clearance profile."""
    return build_cross_section(GLOBAL_GRID, x_start, y_start, x_end, y_end, samples)


@app.get("/api/scenes")
def list_scenes() -> Dict[str, object]:
    return {
        sid: {"data_present": (REPO_ROOT / files[0]).is_file(), "kind": "real" if sid.startswith("real_") else "synthetic"}
        for sid, files in SCENE_FILES.items()
    }


@app.get("/api/benchmark_results")
def get_benchmark_results() -> Dict[str, object]:
    """Exposes real-world SemanticKITTI run results to dashboard."""
    results_path = REPO_ROOT / "data/real/seq08_run_results.json"
    if results_path.is_file():
        with open(results_path, "r") as f:
            return json.load(f)
    return {"status": "NO_RUN_RESULTS", "message": "Run scripts/run_seq08.py first"}


@app.get("/api/results/{name}")
def get_result(name: str) -> JSONResponse:
    """Serves a whitelisted benchmark result file wrapped with provenance."""
    if name not in RESULTS_WHITELIST:
        raise HTTPException(status_code=404, detail=f"Unknown result: {name}")
    try:
        envelope = build_result_envelope(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Result file missing: {name}")
    return JSONResponse(envelope, headers={"Cache-Control": "public, s-maxage=3600"})


@app.get("/api/grid_cells")
def get_grid_cells(
    limit: int = Query(5000, ge=1, le=110000),
    ring_id: Optional[int] = Query(None, ge=0, le=3),
) -> Dict[str, object]:
    """Exposes real active cells with resolution tier, semantics, height, variance, clearance."""
    return build_grid_cells(GLOBAL_GRID, limit, ring_id)


@app.post("/api/load_scene/{scene_id}")
def load_scene(scene_id: str) -> Dict[str, object]:
    """Loads synthetic stress scenes or real SemanticKITTI frames into the live engine."""
    try:
        return load_scene_into(GLOBAL_GRID, scene_id)
    except SceneError as e:
        raise HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message})


@app.post(
    "/api/analyze_scan",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}},
        }
    },
)
async def analyze_scan(request: Request, name: str = Query(SCAN_DEFAULT_NAME)) -> JSONResponse:
    """Analyses an uploaded SemanticKITTI / Velodyne .bin (raw bytes) and returns a scene snapshot plus `timing_ms`.

    Uses a fresh grid: the live scene, tracker and filters are untouched, and nothing is written to disk.
    """
    try:
        data = await read_capped_body(request, MAX_SCAN_BYTES)
        snapshot = await run_in_threadpool(analyze_scan_bytes, data, clean_scan_name(name))
    except SceneError as e:
        raise HTTPException(status_code=e.status_code, detail={"code": e.code, "message": e.message})
    return JSONResponse(snapshot)


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket) -> None:
    """Binary WebSocket stream packing header + cell buffer."""
    await websocket.accept()
    try:
        while True:
            # Receive client ping or heartbeat
            _ = await websocket.receive_text()

            active = GLOBAL_GRID.get_active_cells()
            num_cells = len(active)

            # 32-byte Header format:
            # magic (4B: 'FOVA'), timestamp (8B: double), ego_x (4B), ego_y (4B),
            # active_cells (4B: uint32), total_mem_kb (4B: uint32), padding (4B)
            magic = b"FOVA"
            timestamp = 0.0
            ego_x, ego_y = 0.0, 0.0
            total_mem_kb = int(GLOBAL_GRID.total_memory_mb * 1024)
            padding = 0

            header = struct.pack(
                "<4sdffiII",
                magic,
                timestamp,
                ego_x,
                ego_y,
                num_cells,
                total_mem_kb,
                padding,
            )

            # Binary payload: contiguous raw bytes of structured cells (num_cells * 32 bytes)
            payload = active.tobytes()
            await websocket.send_bytes(header + payload)

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("dashboard.server.app:app", host="0.0.0.0", port=8000, reload=False)
