#!/usr/bin/env python3
"""Export static dashboard snapshots so the deployed (Vercel) site shows real pipeline output.

The scene data under data/ is gitignored, so a deployed API starts with an EMPTY grid. This script runs
the real pipeline offline (SpatialHashGrid + the same builders the API uses) and writes compact,
content-addressable JSON into dashboard/client/public/data/, which Vercel serves from its CDN:

    public/data/manifest.json                 index + provenance
    public/data/scenes/<scene_id>.json        telemetry, cells, cross-section, points
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
from typing import Dict, List, Optional

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dashboard.server import app as server  # noqa: E402  (builders + scene registry)
from core.grid.spatial_hash import SpatialHashGrid  # noqa: E402

OUT_DIR = REPO_ROOT / "dashboard" / "client" / "public" / "data"
SYNTHETIC_IDS = ["scene_a_bridge", "scene_b_potholes", "scene_c_moving", "scene_d_poles"]
REAL_ID = "real_seq08_f00"
KITTI_SAMPLE = REPO_ROOT / "dashboard" / "client" / "public" / "kitti_sample_08.json"

MAX_CELLS = 40_000  # stride-sampled above this and flagged `sampled`
MAX_POINTS = 25_000  # seeded subsample above this
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


def scene_snapshot(scene_id: str, kind: str, pts: np.ndarray, sem: np.ndarray, label_source: str,
                   inputs: Dict[str, str], note: Optional[str] = None) -> Dict[str, object]:
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
        "telemetry": server.build_telemetry(grid),
        "cross_section": server.build_cross_section(grid),
        "cells": cells,
        "points": points_columnar(pts, sem, MAX_POINTS),
    }


def synthetic_snapshots(tmp: Path) -> Dict[str, Dict[str, object]]:
    from data.generate_synthetic import generate_all_scenes

    generate_all_scenes(str(tmp))
    out: Dict[str, Dict[str, object]] = {}
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
        out[sid] = scene_snapshot(
            sid, "synthetic", pts, sem, src,
            {name_bin: sha256_file(tmp / name_bin), name_lbl: sha256_file(tmp / name_lbl)},
        )
    return out


def real_snapshot() -> Optional[Dict[str, object]]:
    bin_file, _ = server.resolve_scene_files(REAL_ID)
    if bin_file.is_file():
        pts, sem, src = server.load_scene_arrays(REAL_ID)
        _, lbl = server.resolve_scene_files(REAL_ID)
        inputs = {bin_file.name: sha256_file(bin_file)}
        if lbl.is_file():
            inputs[lbl.name] = sha256_file(lbl)
        return scene_snapshot(REAL_ID, "real", pts, sem, src, inputs, LICENSE_NOTE[REAL_ID])

    if not KITTI_SAMPLE.is_file():
        return None
    # Fallback: the 5,000-point SemanticKITTI sample bundled with the client, run through the real grid.
    raw = json.loads(KITTI_SAMPLE.read_text(encoding="utf-8"))
    xyz = np.asarray(raw["points"], dtype=np.float32)
    pts = np.concatenate([xyz, np.zeros((len(xyz), 1), dtype=np.float32)], axis=1)
    sem = np.asarray(raw.get("semantics", [0] * len(xyz)), dtype=np.uint16)
    note = LICENSE_NOTE[REAL_ID] + " Sparse 5,000-point sample, not a full frame."
    return scene_snapshot(REAL_ID, "real", pts, sem, "gt", {KITTI_SAMPLE.name: sha256_file(KITTI_SAMPLE)}, note)


def export(out_dir: Path) -> Dict[str, object]:
    (out_dir / "scenes").mkdir(parents=True, exist_ok=True)
    (out_dir / "results").mkdir(parents=True, exist_ok=True)
    manifest: Dict[str, object] = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git_sha": git_sha(),
        "scenes": {},
        "results": {},
    }

    with tempfile.TemporaryDirectory() as td:
        snapshots = synthetic_snapshots(Path(td))
    real = real_snapshot()
    if real:
        snapshots[REAL_ID] = real

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

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="export to a temp dir and fail if committed results/scene content differs (ignores timestamps)")
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
            if a != b:
                stale.append(f"scenes/{p.name}")
        if stale:
            print("STALE snapshots (re-run scripts/export_dashboard_data.py):\n  " + "\n  ".join(stale))
            return 1
        print("snapshots are up to date")
        return 0


if __name__ == "__main__":
    sys.exit(main())
