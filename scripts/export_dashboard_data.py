#!/usr/bin/env python3
"""Export static dashboard snapshots so the deployed (Vercel) site shows real pipeline output.

The scene data under data/ is gitignored, so a deployed API starts with an EMPTY grid. This script runs
the real pipeline offline (SpatialHashGrid + the same builders the API uses) and writes compact,
content-addressable JSON into dashboard/client/public/data/, which Vercel serves from its CDN:

    public/data/manifest.json                 index + provenance
    public/data/scenes/<scene_id>.json        telemetry, cells, cross-section, points
    public/data/variants/<scene>/<variant>.json
                                              cells-only variant snapshots of the same scene: 4 dynamic-fovea
                                              presets (CITY_CRUISE / HIGHWAY_EXTENDED / TURNING_LEFT / TURNING_RIGHT)
                                              and the uniform 5 cm reference grid (schema limap.variant/1).
                                              NOMINAL is the base scene snapshot, so it has no variant file.
    public/data/results/<name>.json           benchmark/*.json wrapped with sha256 provenance

Usage (from the repo root):
    .venv/Scripts/python scripts/export_dashboard_data.py            # export everything available
    .venv/Scripts/python scripts/export_dashboard_data.py --check    # fail if committed snapshots are stale

Synthetic scenes are always regenerated through data.generate_synthetic (never scripts/generate_synthetic.py,
which would overwrite scene C with a different layout). Real SemanticKITTI frames are exported only when
data/real/... exists; otherwise the real scene falls back to the 5,000-point sample bundled with the client.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional, Tuple

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dashboard.server import app as server  # noqa: E402  (builders + scene registry)
from core.grid.baselines import calculate_baselines  # noqa: E402
from core.grid.nested_lattice import NestedLattice, RingConfig  # noqa: E402
from core.grid.fovea_controller import FoveaState  # noqa: E402
from core.grid.spatial_hash import CELL_DTYPE, SpatialHashGrid  # noqa: E402

OUT_DIR = REPO_ROOT / "dashboard" / "client" / "public" / "data"
SYNTHETIC_IDS = ["scene_a_bridge", "scene_b_potholes", "scene_c_moving", "scene_d_poles"]
REAL_ID = "real_seq08_f00"
KITTI_SAMPLE = REPO_ROOT / "dashboard" / "client" / "public" / "kitti_sample_08.json"

MAX_CELLS = 40_000  # stride-sampled above this and flagged `sampled`
MAX_POINTS = 25_000  # seeded subsample above this
MAX_VARIANT_CELLS = 20_000  # variant files carry cells only, so they are capped lower than the base scene

VARIANT_SCHEMA = "limap.variant/1"
# Ego inputs (vx_mps, vy_mps, yaw_rate_rads) per dynamic-fovea preset. Each is run through the real
# DynamicFoveaController and the resulting preset name is asserted, so a controller threshold change fails loudly.
# NOMINAL is deliberately absent: it IS the base scene snapshot (asserted equal in export_variants()).
FOVEA_VARIANTS: Dict[str, Tuple[str, Tuple[float, float, float]]] = {
    "fovea_city_cruise": ("CITY_CRUISE", (5.0, 0.0, 0.0)),
    "fovea_highway_extended": ("HIGHWAY_EXTENDED", (12.0, 0.0, 0.0)),
    "fovea_turning_left": ("TURNING_LEFT", (5.0, 0.0, 0.3)),
    "fovea_turning_right": ("TURNING_RIGHT", (5.0, 0.0, -0.3)),
}
NOMINAL_INPUT = (0.0, 0.0, 0.0)
UNIFORM_VARIANT = "uniform_5cm"
VARIANT_IDS = [*FOVEA_VARIANTS, UNIFORM_VARIANT]
UNIFORM_RES_M = 0.05
UNIFORM_R_OUTER_M = 100.0
UNIFORM_POOL_CELLS = 500_000  # same evaluation pool as benchmark/fidelity_study.py (15.26 MB, NOT the product pool)
BAND_EDGES_M = (10.0, 25.0, 50.0)  # cells_per_band: [0,10) [10,25) [25,50) [50, inf) of real cell-centre range
LICENSE_NOTE = {
    "real_seq08_f00": "SemanticKITTI (CC BY-NC-SA 3.0). Labels are dataset ground truth, not model output.",
}


def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, text=True).strip()
    except Exception:
        return "unknown"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dumps(obj: object) -> str:
    return json.dumps(obj, separators=(",", ":"), allow_nan=False)


def r(values: np.ndarray, nd: int) -> List[float]:
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
    oh_ok = np.abs(oh) < server.NO_VALUE_THRESHOLD
    cl_ok = np.abs(cl) < server.NO_VALUE_THRESHOLD

    return {
        "total_active": total,
        "n": int(len(active)),
        "sampled": sampled,
        "ix": active["ix"].astype(int).tolist(),
        "iy": active["iy"].astype(int).tolist(),
        "ring": active["ring_id"].astype(int).tolist(),
        "sem": active["sem_id"].astype(int).tolist(),
        "count": count.tolist(),
        "z": r(active["mean_z"], 2),
        "var": r(var, 4),
        "zmin": r(active["min_z"], 2),
        "zmax": r(active["max_z"], 2),
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
        "x": r(pts[idx, 0], 2),
        "y": r(pts[idx, 1], 2),
        "z": r(pts[idx, 2], 2),
        "sem": sem[idx].astype(int).tolist(),
    }


def lattice_table(grid: SpatialHashGrid) -> List[Dict[str, float]]:
    return [
        {"ring_id": int(c.ring_id), "res_m": float(c.cell_size), "r_inner": float(c.r_inner), "r_outer": float(c.r_outer)}
        for c in grid.lattice.rings
    ]


class SceneData(NamedTuple):
    """One loaded scene: sanitized points, per-point semantic ids, label provenance, input hashes."""

    pts: np.ndarray
    sem: np.ndarray
    src: str  # label_source: "gt" | "onnx" | "heuristic"
    inputs: Dict[str, str]  # file name -> sha256
    kind: str  # "synthetic" | "real"
    note: Optional[str] = None


def run_grid(pts: np.ndarray, sem: np.ndarray, grid: SpatialHashGrid,
             velocity: Optional[Tuple[float, float]] = None, yaw: float = 0.0) -> Optional[FoveaState]:
    """Insert one scene into `grid`. With `velocity` (vx, vy m/s) the points go through the real
    DynamicFoveaController (preset warp before ring assignment); returns the FoveaState it chose.

    `fovea.update()` is stateless, so calling it here to read the preset gives the same state that
    `insert_points` computes internally (insert_points does not expose it).
    """
    if velocity is None:
        grid.insert_points(pts, semantic_labels=sem)
        return None
    vel = np.asarray(velocity, dtype=np.float64)
    state = grid.fovea.update(vel, yaw_rate_rads=yaw)
    grid.insert_points(pts, semantic_labels=sem, ego_velocity_xy=vel, yaw_rate_rads=yaw)
    return state


def scene_snapshot(scene_id: str, kind: str, pts: np.ndarray, sem: np.ndarray, label_source: str,
                   inputs: Dict[str, str], note: Optional[str] = None) -> Dict[str, object]:
    grid = SpatialHashGrid()
    run_grid(pts, sem, grid)
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
        "telemetry": server.build_telemetry(grid),
        "cross_section": server.build_cross_section(grid),
        "cells": cells,
        "points": points_columnar(pts, sem, MAX_POINTS),
    }


def load_synthetic_scenes(tmp: Path) -> Dict[str, SceneData]:
    from data.generate_synthetic import generate_all_scenes

    generate_all_scenes(str(tmp))
    out: Dict[str, SceneData] = {}
    for sid in SYNTHETIC_IDS:
        bin_rel, lbl_rel = server.SCENE_FILES[sid]
        # Point the server's resolver at the freshly generated copies so load_scene_arrays reads those.
        name_bin, name_lbl = Path(bin_rel).name, Path(lbl_rel).name
        server.SCENE_FILES[sid] = (str((tmp / name_bin).relative_to(tmp)), str((tmp / name_lbl).relative_to(tmp)))
        old_root, server.REPO_ROOT = server.REPO_ROOT, tmp
        try:
            pts, sem, src = server.load_scene_arrays(sid)
        finally:
            server.REPO_ROOT = old_root
            server.SCENE_FILES[sid] = (bin_rel, lbl_rel)
        out[sid] = SceneData(
            pts, sem, src,
            {name_bin: sha256_file(tmp / name_bin), name_lbl: sha256_file(tmp / name_lbl)},
            "synthetic",
        )
    return out


def load_real_scene() -> Optional[SceneData]:
    bin_file, _ = server.resolve_scene_files(REAL_ID)
    if bin_file.is_file():
        pts, sem, src = server.load_scene_arrays(REAL_ID)
        _, lbl = server.resolve_scene_files(REAL_ID)
        inputs = {bin_file.name: sha256_file(bin_file)}
        if lbl.is_file():
            inputs[lbl.name] = sha256_file(lbl)
        return SceneData(pts, sem, src, inputs, "real", LICENSE_NOTE[REAL_ID])

    if not KITTI_SAMPLE.is_file():
        return None
    # Fallback: the 5,000-point SemanticKITTI sample bundled with the client, run through the real grid.
    raw = json.loads(KITTI_SAMPLE.read_text(encoding="utf-8"))
    xyz = np.asarray(raw["points"], dtype=np.float32)
    pts = np.concatenate([xyz, np.zeros((len(xyz), 1), dtype=np.float32)], axis=1)
    sem = np.asarray(raw.get("semantics", [0] * len(xyz)), dtype=np.uint16)
    note = LICENSE_NOTE[REAL_ID] + " Sparse 5,000-point sample, not a full frame."
    return SceneData(pts, sem, "gt", {KITTI_SAMPLE.name: sha256_file(KITTI_SAMPLE)}, "real", note)


def load_scenes() -> Dict[str, SceneData]:
    """Every available scene as (pts, sem, src, inputs, ...); the arrays are in memory, so the temp dir can go."""
    with tempfile.TemporaryDirectory() as td:
        scenes = load_synthetic_scenes(Path(td))
    real = load_real_scene()
    if real:
        scenes[REAL_ID] = real
    return scenes


# ---------------------------------------------------------------------------------------------------------------
# Variant snapshots: same scene, different grid configuration (dynamic-fovea presets / uniform 5 cm reference).
# ---------------------------------------------------------------------------------------------------------------

def make_uniform_reference_grid() -> SpatialHashGrid:
    """Single-ring 5 cm grid over 100 m: the uniform baseline the fovea grid is evaluated against."""
    # int16 cell indices cover +-32767 cells; 100 m / 5 cm = 2000 cells per side, so no overflow.
    assert int(np.ceil(UNIFORM_R_OUTER_M / UNIFORM_RES_M)) < np.iinfo(CELL_DTYPE["ix"]).max
    assert np.iinfo(CELL_DTYPE["ix"]).max == np.iinfo(CELL_DTYPE["iy"]).max

    lattice = NestedLattice([RingConfig(0, 0.0, UNIFORM_R_OUTER_M, UNIFORM_RES_M, 1)])
    grid = SpatialHashGrid(lattice=lattice)
    # The constructor's `< 3.5 MB` assert deliberately applies only to the product pool (106,875 cells). The
    # uniform reference is an evaluation pool of 500,000 cells (15.26 MB) - the same one benchmark/fidelity_study.py
    # allocates as a raw CELL_DTYPE array - so it is swapped in after construction rather than weakening the assert.
    grid.cells = np.zeros(UNIFORM_POOL_CELLS, dtype=CELL_DTYPE)
    grid.capacity = UNIFORM_POOL_CELLS
    grid.total_memory_mb = grid.cells.nbytes / (1024.0 * 1024.0)
    return grid


def variant_stats(grid: SpatialHashGrid) -> Dict[str, object]:
    """Counts over the FULL active set (before any export sampling), by lattice ring and by real range band.

    Bands use the real (unwarped) cell-centre range from the origin. The last band is open-ended: a shifted fovea
    admits points up to r_outer + shift from the sensor, so a few ring-3 cells sit slightly beyond 100 m.
    ring0_ahead / ring0_behind split the finest cells by real x >= 0 / x < 0 (for the uniform grid, which has a
    single ring, "finest" means cells whose centre is within 10 m, i.e. the area the fovea's ring 0 covers).
    """
    active = grid.get_active_cells()
    res = np.array([c.cell_size for c in grid.lattice.rings], dtype=np.float64)[active["ring_id"]]
    cx = (active["ix"].astype(np.float64) + 0.5) * res
    cy = (active["iy"].astype(np.float64) + 0.5) * res
    rng = np.hypot(cx, cy)

    band = np.digitize(rng, BAND_EDGES_M)
    if grid.lattice.num_rings == 1:
        near = rng < BAND_EDGES_M[0]
    else:
        near = active["ring_id"] == 0
    return {
        "active_cells": int(len(active)),
        "cells_per_ring": np.bincount(active["ring_id"], minlength=grid.lattice.num_rings).astype(int).tolist(),
        "cells_per_band": np.bincount(band, minlength=len(BAND_EDGES_M) + 1).astype(int).tolist(),
        "ring0_ahead": int(np.count_nonzero(near & (cx >= 0.0))),
        "ring0_behind": int(np.count_nonzero(near & (cx < 0.0))),
    }


def variant_snapshot(scene_id: str, scene: SceneData, variant: str, grid: SpatialHashGrid,
                     fovea: Optional[Dict[str, object]], uniform: Optional[Dict[str, object]]) -> Dict[str, object]:
    cells = cells_columnar(grid, MAX_VARIANT_CELLS)
    stats = variant_stats(grid)
    assert stats["active_cells"] == grid.active_count == cells["total_active"]
    return {
        "schema": VARIANT_SCHEMA,
        "meta": {
            "scene_id": scene_id,
            "variant": variant,
            "kind": "uniform_reference" if uniform else "fovea_preset",
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "git_sha": git_sha(),
            "label_source": scene.src,
            "base_inputs_sha256": scene.inputs,
            "points_raw": int(len(scene.pts)),
            "lattice": lattice_table(grid),
            "pool": {
                "capacity": int(grid.capacity),
                "cell_bytes": int(CELL_DTYPE.itemsize),
                "mb": round(float(grid.total_memory_mb), 4),
                "active_cells": int(grid.active_count),
            },
            "fovea": fovea,
            "uniform": uniform,
            "stats": stats,
        },
        "cells": cells,
    }


def fovea_variant(scene_id: str, scene: SceneData, variant: str) -> Dict[str, object]:
    preset, (vx, vy, yaw) = FOVEA_VARIANTS[variant]
    grid = SpatialHashGrid()
    state = run_grid(scene.pts, scene.sem, grid, velocity=(vx, vy), yaw=yaw)
    assert state is not None and state.preset_name == preset, (
        f"{variant}: input (vx={vx}, vy={vy}, yaw={yaw}) selected {state and state.preset_name}, expected {preset}"
    )
    fovea = {
        "preset": state.preset_name,
        "input": {"vx_mps": vx, "vy_mps": vy, "yaw_rate_rads": yaw},
        "shift_x_m": float(state.shift_x),
        "shift_y_m": float(state.shift_y),
        "forward_reach_m": float(state.forward_reach_m),
        "stretch_ratio": round(float(state.stretch_ratio), 4),
    }
    return variant_snapshot(scene_id, scene, variant, grid, fovea, None)


def uniform_variant(scene_id: str, scene: SceneData) -> Dict[str, object]:
    grid = make_uniform_reference_grid()
    run_grid(scene.pts, scene.sem, grid)
    uniform = {
        "res_m": UNIFORM_RES_M,
        "r_outer_m": UNIFORM_R_OUTER_M,
        "pool_capacity": UNIFORM_POOL_CELLS,
        "pool_mb": round(float(grid.total_memory_mb), 4),
        # Same figure benchmark/fidelity_study.py reports as the theoretical full-coverage uniform grid.
        "theoretical_capacity_mb": calculate_baselines().uniform_25d_mb,
    }
    return variant_snapshot(scene_id, scene, UNIFORM_VARIANT, grid, None, uniform)


def assert_nominal_is_base(scene: SceneData, base_cells: Dict[str, object]) -> None:
    """NOMINAL (vx=vy=0 through the controller) must reproduce the base snapshot, so it needs no variant file."""
    grid = SpatialHashGrid()
    state = run_grid(scene.pts, scene.sem, grid, velocity=NOMINAL_INPUT[:2], yaw=NOMINAL_INPUT[2])
    assert state is not None and state.preset_name == "NOMINAL", f"NOMINAL input selected {state}"
    assert cells_columnar(grid, MAX_CELLS) == base_cells, "NOMINAL cells differ from the base scene snapshot"


def build_variants(scene_id: str, scene: SceneData, base_cells: Dict[str, object]) -> Dict[str, Dict[str, object]]:
    assert_nominal_is_base(scene, base_cells)
    out = {vid: fovea_variant(scene_id, scene, vid) for vid in FOVEA_VARIANTS}
    out[UNIFORM_VARIANT] = uniform_variant(scene_id, scene)
    return out


def write_variants(out_dir: Path, scene_id: str, scene: SceneData, base_cells: Dict[str, object]) -> Dict[str, object]:
    """Writes variants/<scene_id>/<variant>.json and returns the manifest `variants[scene_id]` entries."""
    (out_dir / "variants" / scene_id).mkdir(parents=True, exist_ok=True)
    entries: Dict[str, object] = {}
    for vid, variant in build_variants(scene_id, scene, base_cells).items():
        text = dumps(variant)
        (out_dir / "variants" / scene_id / f"{vid}.json").write_text(text, encoding="utf-8")
        meta = variant["meta"]  # type: ignore[index]
        entries[vid] = {
            "file": f"variants/{scene_id}/{vid}.json",
            "bytes": len(text.encode("utf-8")),
            "active_cells": meta["pool"]["active_cells"],
        }
        print(f"  variant {scene_id:<16} {vid:<23} cells={meta['pool']['active_cells']:>6} "
              f"(exported {variant['cells']['n']:>6})  {len(text) / 1024:>7.0f} kB")  # type: ignore[index]
    return entries


def export(out_dir: Path) -> Dict[str, object]:
    (out_dir / "scenes").mkdir(parents=True, exist_ok=True)
    (out_dir / "results").mkdir(parents=True, exist_ok=True)
    manifest: Dict[str, object] = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_sha": git_sha(),
        "scenes": {},
        "results": {},
        "variants": {},
    }

    scenes = load_scenes()
    snapshots = {sid: scene_snapshot(sid, sc.kind, sc.pts, sc.sem, sc.src, sc.inputs, sc.note) for sid, sc in scenes.items()}

    for sid, snap in snapshots.items():
        path = out_dir / "scenes" / f"{sid}.json"
        text = dumps(snap)
        path.write_text(text, encoding="utf-8")
        meta = snap["meta"]
        manifest["scenes"][sid] = {  # type: ignore[index]
            "file": f"scenes/{sid}.json",
            "bytes": len(text.encode("utf-8")),
            "kind": meta["kind"],
            "label_source": meta["label_source"],
            "active_cells": meta["active_cells"],
            "cells_exported": meta["cells_exported"],
            "points_exported": snap["points"]["n"],  # type: ignore[index]
        }
        print(f"  scene {sid:<16} cells={meta['active_cells']:>6} (exported {meta['cells_exported']:>6})  "
              f"points={snap['points']['n']:>6}  {len(text) / 1024:>7.0f} kB")  # type: ignore[index]

    for name in server.RESULTS_WHITELIST:
        env = server.build_result_envelope(name)
        text = dumps(env)
        (out_dir / "results" / f"{name}.json").write_text(text, encoding="utf-8")
        manifest["results"][name] = {"file": f"results/{name}.json", "sha256": env["sha256"], "source_path": env["source_path"]}  # type: ignore[index]
        print(f"  result {name:<13} {len(text) / 1024:>7.0f} kB  <- {env['source_path']}")

    for sid, scene in scenes.items():
        manifest["variants"][sid] = write_variants(out_dir, sid, scene, snapshots[sid]["cells"])  # type: ignore[index,arg-type]

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def _without_provenance(blob: Dict[str, object]) -> Dict[str, object]:
    meta = dict(blob["meta"])  # type: ignore[call-overload]
    meta.pop("generated_at", None)
    meta.pop("git_sha", None)  # provenance moves with every commit
    return {**blob, "meta": meta}


def stale_variants(fresh: Path, committed: Path) -> List[str]:
    """Variant files / manifest `variants` block in `committed` that differ from a fresh export (timestamps ignored)."""
    stale: List[str] = []
    fresh_files = sorted((fresh / "variants").glob("*/*.json"))
    for p in fresh_files:
        rel = p.relative_to(fresh).as_posix()
        cp = committed / rel
        if not cp.is_file():
            stale.append(f"{rel} (missing)")
        elif _without_provenance(json.loads(p.read_text(encoding="utf-8"))) != _without_provenance(
                json.loads(cp.read_text(encoding="utf-8"))):
            stale.append(rel)
    expected = {p.relative_to(fresh).as_posix() for p in fresh_files}
    for cp in sorted((committed / "variants").glob("*/*.json")):
        rel = cp.relative_to(committed).as_posix()
        if rel not in expected:
            stale.append(f"{rel} (unexpected)")

    # Manifest `variants` block: same files and cell counts as a fresh export, and every committed `bytes` must equal
    # the size of the committed file (not the fresh one: the abbreviated git sha embedded in each file can change length).
    fresh_block = json.loads((fresh / "manifest.json").read_text(encoding="utf-8")).get("variants", {})
    mpath = committed / "manifest.json"
    committed_block = json.loads(mpath.read_text(encoding="utf-8")).get("variants") if mpath.is_file() else None
    if committed_block is None:
        stale.append("manifest.json variants block (missing)")
    else:
        mismatch = sorted(set(fresh_block) ^ set(committed_block))
        for sid in sorted(set(fresh_block) & set(committed_block)):
            f_entries, c_entries = fresh_block[sid], committed_block[sid]
            mismatch += [f"{sid}/{v}" for v in sorted(set(f_entries) ^ set(c_entries))]
            for vid in sorted(set(f_entries) & set(c_entries)):
                f, c = f_entries[vid], c_entries[vid]
                on_disk = committed / c["file"]
                if (f["file"] != c["file"] or f["active_cells"] != c["active_cells"]
                        or not on_disk.is_file() or on_disk.stat().st_size != c["bytes"]):
                    mismatch.append(f"{sid}/{vid}")
        if mismatch:
            stale.append("manifest.json variants block (" + ", ".join(mismatch) + ")")
    return stale


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="export to a temp dir and fail if committed results/scene/variant content differs (ignores timestamps)")
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    args = ap.parse_args()

    if not args.check:
        print(f"Exporting dashboard snapshots to {args.out}")
        export(args.out)
        print("done")
        return 0

    with tempfile.TemporaryDirectory() as td:
        fresh = Path(td)
        export(fresh)
        stale: List[str] = []
        for p in sorted((fresh / "results").glob("*.json")):
            committed = args.out / "results" / p.name
            if not committed.is_file() or json.loads(committed.read_text())["sha256"] != json.loads(p.read_text())["sha256"]:
                stale.append(f"results/{p.name}")
        for p in sorted((fresh / "scenes").glob("*.json")):
            committed = args.out / "scenes" / p.name
            if not committed.is_file():
                stale.append(f"scenes/{p.name} (missing)")
                continue
            a, b = json.loads(p.read_text()), json.loads(committed.read_text())
            for blob in (a, b):
                blob["meta"].pop("generated_at", None)
                blob["meta"].pop("git_sha", None)  # provenance moves with every commit
            if a != b:
                stale.append(f"scenes/{p.name}")
        stale += stale_variants(fresh, args.out)
        if stale:
            print("STALE snapshots (re-run scripts/export_dashboard_data.py):\n  " + "\n  ".join(stale))
            return 1
        print("snapshots are up to date")
        return 0


if __name__ == "__main__":
    sys.exit(main())
