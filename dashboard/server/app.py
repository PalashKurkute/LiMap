"""High-Performance FastAPI & Binary WebSocket Streaming Telemetry Server.

Streams LiMap 2.5D multi-layer elevation data, memory metrics, and tracked obstacles
via zero-copy binary ArrayBuffers to the UI/UX Pro Max dashboard.
Provides REST APIs for cross-section slicing, benchmark verification, and scene selection.
"""

from __future__ import annotations

import json
from pathlib import Path
import struct
import sys
from typing import Dict, List, Optional

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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

# Global persistent system state
GLOBAL_GRID = SpatialHashGrid()
SEMANTIC_ENGINE = SemanticSegmentationEngine()
MOS_FILTER = MovingObjectSegmentationFilter()
TRACKER = DynamicObstacleTracker(dt=0.1)
COSTMAP_GEN = CostmapGenerator(grid_width_m=70.0, grid_height_m=70.0)

# Load default scene
DEFAULT_SCENE_BIN = "data/synthetic/scene_a_bridge_underpass.bin"
DEFAULT_SCENE_LBL = "data/synthetic/scene_a_bridge_underpass.label"

if Path(DEFAULT_SCENE_BIN).is_file():
    _pts = load_kitti_bin(DEFAULT_SCENE_BIN)
    _sem = load_kitti_label(DEFAULT_SCENE_LBL)[0] if Path(DEFAULT_SCENE_LBL).is_file() else None
    GLOBAL_GRID.insert_points(_pts, semantic_labels=_sem)

DIST_DIR = Path(__file__).resolve().parent.parent / "client" / "dist"
if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/")
def serve_dashboard():
    if (DIST_DIR / "index.html").is_file():
        return FileResponse(DIST_DIR / "index.html")
    index_file = Path(__file__).resolve().parent.parent / "client" / "index.html"
    return FileResponse(index_file)


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ONLINE", "stack": "LiMap-2.5D", "client": "DRDO-SIH26053"}


@app.get("/api/telemetry")
def get_telemetry() -> Dict[str, object]:
    """Returns memory footprint, active cells, load factor, and baseline comparison."""
    telemetry = GLOBAL_GRID.export_telemetry()
    baselines = calculate_baselines()
    
    return {
        "telemetry": telemetry,
        "baselines": {
            "dense_3d_voxel_mb": baselines.dense_3d_voxel_mb,
            "uniform_25d_mb": baselines.uniform_25d_mb,
            "foveagrid_25d_mb": baselines.foveagrid_25d_mb,
            "reduction_vs_3d": f"{baselines.reduction_vs_3d:.1f}x",
            "reduction_vs_uniform_25d": f"{baselines.reduction_vs_uniform_25d:.1f}x",
            "under_drdo_bound": bool(telemetry["total_heap_mb"] < 3.5),
            "per_ring_breakdown": baselines.per_ring_breakdown,
        },
    }


@app.get("/api/cross_section")
def get_cross_section(
    x_start: float = 5.0,
    y_start: float = 0.0,
    x_end: float = 28.0,
    y_end: float = 0.0,
    samples: int = 80,
) -> Dict[str, object]:
    """Slices through the grid to extract continuous elevation and clearance profile.
    
    Demonstrates overhang clearance (bridge underpass) or pothole crater depth.
    """
    s_vals = np.linspace(0.0, 1.0, samples)
    xs = x_start + s_vals * (x_end - x_start)
    ys = y_start + s_vals * (y_end - y_start)
    distances = np.hypot(xs - x_start, ys - y_start)

    lattice = GLOBAL_GRID.lattice
    profile = []

    for d, x, y in zip(distances, xs, ys):
        rad = np.hypot(x, y)
        r_id = 0
        for cfg in lattice.rings:
            if cfg.r_inner <= rad < cfg.r_outer:
                r_id = cfg.ring_id
                break

        res = lattice.rings[r_id].cell_size
        ix = int(np.floor(x / res))
        iy = int(np.floor(y / res))
        base_slot = GLOBAL_GRID._hash_coords(ix, iy, r_id)

        found = False
        for step in range(GLOBAL_GRID.max_probe_steps):
            slot = (base_slot + step) % GLOBAL_GRID.capacity
            cell = GLOBAL_GRID.cells[slot]
            if cell["occupied"] == 0:
                break
            if cell["ix"] == ix and cell["iy"] == iy and cell["ring_id"] == r_id:
                profile.append({
                    "distance_m": round(float(d), 2),
                    "x": round(float(x), 2),
                    "y": round(float(y), 2),
                    "z_ground": round(float(cell["mean_z"]), 2),
                    "z_overhang": round(float(cell["overhang_z"]), 2) if cell["overhang_z"] < 900 else None,
                    "clearance_m": round(float(cell["clearance"]), 2) if cell["clearance"] < 900 else None,
                    "variance": round(float(cell["m2_z"] / max(int(cell["count"]) - 1, 1)), 4),
                    "sem_id": int(cell["sem_id"]),
                })
                found = True
                break

        if not found:
            profile.append({
                "distance_m": round(float(d), 2),
                "x": round(float(x), 2),
                "y": round(float(y), 2),
                "z_ground": -1.73,
                "z_overhang": None,
                "clearance_m": None,
                "variance": 0.0,
                "sem_id": 40,
            })

    return {
        "x_start": x_start,
        "y_start": y_start,
        "x_end": x_end,
        "y_end": y_end,
        "profile": profile,
    }


@app.get("/api/scenes")
def list_scenes() -> Dict[str, object]:
    manifest_path = Path("data/synthetic/manifest.json")
    if manifest_path.is_file():
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        return manifest
    return {}


@app.get("/api/benchmark_results")
def get_benchmark_results() -> Dict[str, object]:
    """Exposes real-world SemanticKITTI benchmark results to dashboard."""
    results_path = Path("data/real/seq08_run_results.json")
    if results_path.is_file():
        with open(results_path, "r") as f:
            return json.load(f)
    return {"status": "NO_RUN_RESULTS", "message": "Run scripts/run_seq08.py first"}


@app.get("/api/grid_cells")
def get_grid_cells(limit: int = 5000) -> Dict[str, object]:
    """Exposes real active cells with resolution tier, semantics, height, variance, clearance."""
    active = GLOBAL_GRID.get_active_cells()
    if len(active) == 0:
        return {"total_active": 0, "cells": []}

    if len(active) > limit:
        indices = np.linspace(0, len(active) - 1, limit, dtype=np.int32)
        sampled = active[indices]
    else:
        sampled = active

    lattice = GLOBAL_GRID.lattice
    cell_list = []
    for c in sampled:
        r_id = int(c["ring_id"])
        res = float(lattice.rings[r_id].cell_size) if r_id < len(lattice.rings) else 0.1
        count = int(c["count"])
        variance = float(c["m2_z"] / (count - 1)) if count > 1 else 0.0

        x_m = round(float(c["ix"] * res + res * 0.5), 2)
        y_m = round(float(c["iy"] * res + res * 0.5), 2)

        cell_list.append({
            "ix": int(c["ix"]),
            "iy": int(c["iy"]),
            "ring_id": r_id,
            "res_m": res,
            "x_m": x_m,
            "y_m": y_m,
            "sem_id": int(c["sem_id"]),
            "count": count,
            "mean_z": round(float(c["mean_z"]), 2),
            "variance": round(variance, 4),
            "min_z": round(float(c["min_z"]), 2),
            "max_z": round(float(c["max_z"]), 2),
            "overhang_z": round(float(c["overhang_z"]), 2) if c["overhang_z"] > -900 else None,
            "clearance": round(float(c["clearance"]), 2) if c["clearance"] > 0 else None,
        })

    return {
        "total_active": len(active),
        "sampled_count": len(cell_list),
        "heap_mb": GLOBAL_GRID.total_memory_mb,
        "cells": cell_list,
    }


@app.post("/api/load_scene/{scene_id}")
def load_scene(scene_id: str) -> Dict[str, str]:
    """Loads synthetic stress scenes or real SemanticKITTI frames into the live engine."""
    scene_map = {
        "scene_a_bridge": ("data/synthetic/scene_a_bridge_underpass.bin", "data/synthetic/scene_a_bridge_underpass.label"),
        "scene_b_potholes": ("data/synthetic/scene_b_pothole_cluster.bin", "data/synthetic/scene_b_pothole_cluster.label"),
        "scene_c_moving": ("data/synthetic/scene_c_moving_veh_frame_02.bin", "data/synthetic/scene_c_moving_veh_frame_02.label"),
        "scene_d_poles": ("data/synthetic/scene_d_thin_pole_array.bin", "data/synthetic/scene_d_thin_pole_array.label"),
        "real_seq08_f00": ("data/real/sequences/08/velodyne/000000.bin", "data/real/sequences/08/labels/000000.label"),
        "real_seq08_f25": ("data/real/sequences/08/velodyne/000025.bin", "data/real/sequences/08/labels/000025.label"),
        "real_seq08_f50": ("data/real/sequences/08/velodyne/000050.bin", "data/real/sequences/08/labels/000050.label"),
        "real_seq08_f100": ("data/real/sequences/08/velodyne/000100.bin", "data/real/sequences/08/labels/000100.label"),
    }

    if scene_id in scene_map:
        bin_file, lbl_file = scene_map[scene_id]
    elif scene_id.startswith("real_seq08_f"):
        try:
            f_num = int(scene_id.replace("real_seq08_f", ""))
            bin_file = f"data/real/sequences/08/velodyne/{f_num:06d}.bin"
            lbl_file = f"data/real/sequences/08/labels/{f_num:06d}.label"
        except ValueError:
            return {"error": f"Invalid scene ID format: {scene_id}"}
    else:
        return {"error": f"Unknown scene: {scene_id}"}

    if not Path(bin_file).is_file():
        return {"error": f"Scene binary not found: {bin_file}"}

    raw_pts = load_kitti_bin(bin_file)
    pts, _ = sanitize_point_cloud(raw_pts, min_range=0.5, max_range=120.0)

    if lbl_file and Path(lbl_file).is_file():
        sem = load_kitti_label(lbl_file)[0]
    else:
        sem = SEMANTIC_ENGINE.infer(pts)

    GLOBAL_GRID.reset()
    GLOBAL_GRID.insert_points(pts, semantic_labels=sem)

    return {"status": "SUCCESS", "loaded_scene": scene_id, "points": str(len(pts)), "active_cells": str(GLOBAL_GRID.active_count)}


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
