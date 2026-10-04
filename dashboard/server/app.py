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
import struct
import sys
from typing import Dict, List, Optional, Tuple

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
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
