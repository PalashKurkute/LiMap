"""Tests for POST /api/analyze_scan, the "try your own scan" endpoint (run from repo root: pytest dashboard/server/tests)."""

from __future__ import annotations

import hashlib
import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Optional

import numpy as np
import pytest
from fastapi.testclient import TestClient

from core.ingestion.loader import sanitize_point_cloud
from dashboard.server import app as server

REPO_ROOT = server.REPO_ROOT
client = TestClient(server.app)

COMMITTED_SCENE = REPO_ROOT / "dashboard" / "client" / "public" / "data" / "scenes" / "scene_a_bridge.json"
BRIDGE_BIN = REPO_ROOT / "data" / "synthetic" / "scene_a_bridge_underpass.bin"
POTHOLE_BIN = REPO_ROOT / "data" / "synthetic" / "scene_b_pothole_cluster.bin"
OCTET = {"Content-Type": "application/octet-stream"}


@pytest.fixture(scope="module", autouse=True)
def synthetic_scenes() -> None:
    """The synthetic scenes are gitignored; generate them deterministically if absent."""
    if not BRIDGE_BIN.is_file() or not POTHOLE_BIN.is_file():
        from data.generate_synthetic import generate_all_scenes

        generate_all_scenes(str(REPO_ROOT / "data/synthetic"))


def post(data: bytes, name: Optional[str] = None, headers: Optional[Dict[str, str]] = None):
    params = {} if name is None else {"name": name}
    return client.post("/api/analyze_scan", params=params, content=data, headers={**OCTET, **(headers or {})})


def small_scan(n: int = 2000, seed: int = 7) -> bytes:
    """A flat road patch with a few pillars: valid float32 x, y, z, intensity rows, quick to analyse."""
    rng = np.random.default_rng(seed)
    pts = np.empty((n, 4), dtype=np.float32)
    pts[:, 0] = rng.uniform(2.0, 40.0, n)
    pts[:, 1] = rng.uniform(-10.0, 10.0, n)
    pts[:, 2] = -1.7
    pts[: n // 10, 2] = rng.uniform(-1.4, 1.5, n // 10)
    pts[:, 3] = rng.uniform(0.0, 1.0, n)
    return pts.tobytes()


def error(resp) -> Dict[str, str]:
    detail = resp.json()["detail"]
    assert set(detail) == {"code", "message"}
    assert isinstance(detail["message"], str) and detail["message"]
    return detail


def stripped(body: Dict[str, object]) -> Dict[str, object]:
    out = {k: v for k, v in body.items() if k != "timing_ms"}
    out["meta"] = {k: v for k, v in body["meta"].items() if k != "generated_at"}  # type: ignore[union-attr]
    return out


# --- success --------------------------------------------------------------------------------------------------------


def test_valid_scan_has_the_committed_snapshot_shape():
    data = BRIDGE_BIN.read_bytes()
    r = post(data, name="my scan.bin")
    assert r.status_code == 200
    body, committed = r.json(), json.loads(COMMITTED_SCENE.read_text(encoding="utf-8"))

    assert set(body) == set(committed) | {"timing_ms"}
    assert set(body["meta"]) == set(committed["meta"])
    for part in ("telemetry", "cross_section", "cells", "points"):
        assert set(body[part]) == set(committed[part]), part

    meta = body["meta"]
    assert meta["scene_id"] == "upload" and meta["kind"] == "upload"
    assert meta["label_source"] == ("onnx" if server.SEMANTIC_ENGINE.session is not None else "heuristic")
    assert meta["inputs_sha256"] == {"my scan.bin": hashlib.sha256(data).hexdigest()}
    assert meta["active_cells"] > 0 and meta["points_raw"] > 0
    assert meta["cells_exported"] == body["cells"]["n"]
    assert "uploaded scan" in meta["note"].lower() and "not ground truth" in meta["note"]
    assert isinstance(body["timing_ms"], float) and body["timing_ms"] > 0


def test_default_name_is_scan_bin():
    body = post(small_scan()).json()
    assert list(body["meta"]["inputs_sha256"]) == ["scan.bin"]


def test_label_source_follows_the_engine(monkeypatch):
    """With a segmentation session the labels are reported as ONNX, and they come from SEMANTIC_ENGINE.infer."""
    monkeypatch.setattr(server.SEMANTIC_ENGINE, "session", object())
    monkeypatch.setattr(server.SEMANTIC_ENGINE, "infer", lambda pts: np.full(len(pts), 40, dtype=np.uint32))
    body = post(small_scan()).json()
    assert body["meta"]["label_source"] == "onnx"
    assert "onnx" in body["meta"]["note"].lower() and "not ground truth" in body["meta"]["note"]
    assert set(body["points"]["sem"]) == {40}


def test_upload_leaves_global_state_untouched():
    server.load_scene_into(server.GLOBAL_GRID, "scene_a_bridge")
    grid = server.GLOBAL_GRID
    cells_before = hashlib.sha256(grid.cells.tobytes()).hexdigest()
    active_before = int(grid.active_count)
    sample_before = grid.get_active_cells()[::97].copy()
    tracker, mos = server.TRACKER, server.MOS_FILTER
    tracks_before, next_id_before = list(tracker.tracks), tracker.next_track_id
    last_img_before, last_pose_before = mos.last_range_img, mos.last_pose

    r = post(POTHOLE_BIN.read_bytes())  # a different scene than the live one
    assert r.status_code == 200

    assert server.GLOBAL_GRID is grid
    assert int(grid.active_count) == active_before > 0
    assert hashlib.sha256(grid.cells.tobytes()).hexdigest() == cells_before
    assert np.array_equal(grid.get_active_cells()[::97], sample_before)
    assert server.TRACKER is tracker and server.MOS_FILTER is mos
    assert tracker.tracks == tracks_before and tracker.next_track_id == next_id_before
    assert mos.last_range_img is last_img_before and mos.last_pose is last_pose_before
    assert r.json()["meta"]["active_cells"] != active_before  # the response really is the uploaded scene


def test_same_bytes_twice_give_identical_output():
    data = BRIDGE_BIN.read_bytes()
    a, b = post(data).json(), post(data).json()
    assert stripped(a) == stripped(b)


def test_upload_does_not_drift_from_scene_snapshot():
    """The endpoint must return exactly what scene_snapshot builds from the same sanitised arrays."""
    data = BRIDGE_BIN.read_bytes()
    raw = np.fromfile(BRIDGE_BIN, dtype=np.float32).reshape(-1, 4)
    pts, _ = sanitize_point_cloud(raw, min_range=0.5, max_range=120.0)
    sem = server.SEMANTIC_ENGINE.infer(pts)
    source = "onnx" if server.SEMANTIC_ENGINE.session is not None else "heuristic"
    direct = json.loads(json.dumps(server.scene_snapshot("upload", "upload", pts, sem, source, {"scan.bin": hashlib.sha256(data).hexdigest()})))

    body = post(data).json()
    assert body["cells"] == direct["cells"]
    assert body["telemetry"] == direct["telemetry"]
    assert body["cross_section"] == direct["cross_section"]
    assert body["points"] == direct["points"]
    assert body["meta"]["points_raw"] == len(pts)
    assert body["meta"]["active_cells"] == direct["meta"]["active_cells"] > 0


# --- errors ---------------------------------------------------------------------------------------------------------


def test_empty_scan_is_400():
    r = post(b"")
    assert r.status_code == 400
    assert error(r)["code"] == "EMPTY_SCAN"


def test_size_not_a_multiple_of_16_is_400():
    r = post(small_scan(50) + b"\x00\x00\x00")
    assert r.status_code == 400
    detail = error(r)
    assert detail["code"] == "BAD_SCAN_SIZE"
    assert "16" in detail["message"] and "float" in detail["message"]


def test_all_nan_scan_is_400():
    r = post(np.full((64, 4), np.nan, dtype=np.float32).tobytes())
    assert r.status_code == 400
    assert error(r)["code"] == "NO_VALID_POINTS"


def test_all_out_of_range_scan_is_400():
    far = np.tile(np.array([[500.0, 0.0, 0.0, 0.5], [0.0, 0.0, 0.0, 0.5]], dtype=np.float32), (10, 1))
    r = post(far.tobytes())  # one point 500 m away, one on the sensor itself
    assert r.status_code == 400
    assert error(r)["code"] == "NO_VALID_POINTS"


def test_oversize_scan_is_413_and_the_cap_is_inclusive(monkeypatch):
    data = small_scan(100)
    monkeypatch.setattr(server, "MAX_SCAN_BYTES", len(data))
    assert post(data).status_code == 200  # exactly at the cap
    r = post(data + bytes(16))
    assert r.status_code == 413
    assert error(r)["code"] == "SCAN_TOO_LARGE"


def test_declared_content_length_is_checked_before_reading(monkeypatch):
    """A Content-Length above the cap is refused although the body actually sent is small and valid."""
    data = small_scan(100)
    monkeypatch.setattr(server, "MAX_SCAN_BYTES", len(data))
    r = post(data, headers={"Content-Length": str(len(data) + 1)})
    assert r.status_code == 413
    assert error(r)["code"] == "SCAN_TOO_LARGE"


def test_chunked_body_without_content_length_is_capped_while_streaming(monkeypatch):
    data = small_scan(100)
    monkeypatch.setattr(server, "MAX_SCAN_BYTES", len(data))
    chunks = [data[i : i + 160] for i in range(0, len(data), 160)] + [bytes(16)]
    r = client.post("/api/analyze_scan", content=iter(chunks), headers=OCTET)
    assert "content-length" not in r.request.headers
    assert r.status_code == 413
    assert error(r)["code"] == "SCAN_TOO_LARGE"
    assert client.post("/api/analyze_scan", content=iter(chunks[:-1]), headers=OCTET).status_code == 200


# --- health, names, helpers -----------------------------------------------------------------------------------------


def test_health_publishes_the_scan_cap_and_keeps_its_other_keys():
    body = client.get("/api/health").json()
    assert body["max_scan_bytes"] == server.MAX_SCAN_BYTES == 8 * 1024 * 1024
    assert {"status", "stack", "active_cells", "scenes", "label_engine"} <= set(body)


@pytest.mark.parametrize(
    "given, expected",
    [
        ("frame.bin", "frame.bin"),
        ("../../etc/passwd", "passwd"),
        ("C:\\Users\\me\\000000.bin", "000000.bin"),
        ("a\r\nb\x00c.bin", "abc.bin"),
        ("evil\u202egnp.bin", "evilgnp.bin"),  # bidi override is a control (Cf) character
        ("   ", "scan.bin"),
        ("..", "scan.bin"),
        ("dir/", "scan.bin"),
        (None, "scan.bin"),
    ],
)
def test_clean_scan_name(given, expected):
    assert server.clean_scan_name(given) == expected


def test_long_names_are_capped():
    assert len(server.clean_scan_name("x" * 5000 + ".bin")) == server.SCAN_NAME_MAX_CHARS
    body = post(small_scan(), name="/tmp/" + "y" * 300).json()
    (name,) = body["meta"]["inputs_sha256"]
    assert name == "y" * server.SCAN_NAME_MAX_CHARS


def test_git_sha_never_raises(monkeypatch):
    assert isinstance(server.git_sha(), str) and server.git_sha()

    def boom(*args, **kwargs):
        raise FileNotFoundError("git")

    monkeypatch.setattr(subprocess, "check_output", boom)
    assert server.git_sha() == "unknown"

    def not_a_repo(*args, **kwargs):
        raise subprocess.CalledProcessError(128, "git")

    monkeypatch.setattr(subprocess, "check_output", not_a_repo)
    assert server.git_sha() == "unknown"


def test_exporter_reuses_the_server_builders():
    from scripts import export_dashboard_data as exporter

    for name in ("MAX_CELLS", "MAX_POINTS", "cells_columnar", "points_columnar", "lattice_table", "scene_snapshot", "git_sha"):
        assert getattr(exporter, name) is getattr(server, name), name


def test_concurrent_uploads_queue_one_at_a_time(monkeypatch):
    """Two or more simultaneous uploads all succeed (none is rejected) and never run the analysis at the same time."""
    real = server.scene_snapshot
    lock, state = threading.Lock(), {"now": 0, "peak": 0}

    def tracked(*args, **kwargs):
        with lock:
            state["now"] += 1
            state["peak"] = max(state["peak"], state["now"])
        try:
            time.sleep(0.15)
            return real(*args, **kwargs)
        finally:
            with lock:
                state["now"] -= 1

    monkeypatch.setattr(server, "scene_snapshot", tracked)
    payloads = [small_scan(seed=s) for s in range(4)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(post, payloads))
    assert [r.status_code for r in results] == [200] * 4
    assert state["peak"] == 1
