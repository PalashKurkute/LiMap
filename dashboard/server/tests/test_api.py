"""API contract tests for the dashboard server (run from repo root: pytest dashboard/server/tests)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from dashboard.server import app as server

REPO_ROOT = server.REPO_ROOT
client = TestClient(server.app)


@pytest.fixture(scope="session", autouse=True)
def synthetic_scenes() -> None:
    """The synthetic scenes are gitignored; generate them deterministically if absent."""
    bridge = REPO_ROOT / server.SCENE_FILES["scene_a_bridge"][0]
    if not bridge.is_file():
        from data.generate_synthetic import generate_all_scenes

        generate_all_scenes(str(REPO_ROOT / "data/synthetic"))


@pytest.fixture()
def bridge_grid():
    grid = server.SpatialHashGrid()
    server.load_scene_into(grid, "scene_a_bridge")
    return grid


def test_grid_cells_never_report_sentinel_as_overhang(bridge_grid):
    out = server.build_grid_cells(bridge_grid, limit=200_000)
    assert out["total_active"] > 0
    for c in out["cells"]:
        assert c["overhang_z"] is None or abs(c["overhang_z"]) < 900
        assert c["clearance"] is None or c["clearance"] < 900
    # The bridge scene must have genuine overhang cells, and also plenty without.
    with_overhang = [c for c in out["cells"] if c["overhang_z"] is not None]
    without = [c for c in out["cells"] if c["overhang_z"] is None]
    assert with_overhang, "bridge scene should contain overhang cells"
    assert without, "most cells have no overhang and must report None"


def test_cross_section_marks_unobserved_samples(bridge_grid):
    # Far outside any occupied area: nothing observed, no invented road surface.
    out = server.build_cross_section(bridge_grid, 150.0, 0.0, 160.0, 0.0, samples=10)
    assert all(p["observed"] is False for p in out["profile"])
    assert all(p["z_ground"] is None and p["sem_id"] is None for p in out["profile"])


def test_cross_section_observed_samples_have_values(bridge_grid):
    out = server.build_cross_section(bridge_grid, 5.0, 0.0, 28.0, 0.0, samples=80)
    observed = [p for p in out["profile"] if p["observed"]]
    assert observed, "bridge centreline should hit occupied cells"
    for p in observed:
        assert isinstance(p["z_ground"], float)
        assert p["z_overhang"] is None or p["clearance_m"] is not None


def test_telemetry_has_no_drdo_naming(bridge_grid):
    out = server.build_telemetry(bridge_grid)
    assert "under_drdo_bound" not in out["telemetry"]
    assert "under_drdo_bound" not in out["baselines"]
    assert out["telemetry"]["within_pool_budget"] is True


def test_routes_match_builders():
    server.load_scene_into(server.GLOBAL_GRID, "scene_a_bridge")
    assert client.get("/api/telemetry").json() == server.build_telemetry(server.GLOBAL_GRID)
    assert client.get("/api/grid_cells?limit=300").json() == server.build_grid_cells(server.GLOBAL_GRID, 300)


def test_load_scene_unknown_is_404():
    r = client.post("/api/load_scene/not_a_scene")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "UNKNOWN_SCENE"


def test_load_scene_missing_data_is_503():
    if (REPO_ROOT / server.SCENE_FILES["real_seq08_f100"][0]).is_file():
        pytest.skip("real KITTI frames present locally")
    r = client.post("/api/load_scene/real_seq08_f100")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "SCENE_DATA_MISSING"


def test_load_scene_success_returns_ints_and_label_source():
    r = client.post("/api/load_scene/scene_a_bridge")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["points"], int) and isinstance(body["active_cells"], int)
    assert body["label_source"] == "gt"


def test_cross_section_validates_samples():
    assert client.get("/api/cross_section?samples=1").status_code == 422
    assert client.get("/api/cross_section?samples=5000").status_code == 422


@pytest.mark.parametrize("name", sorted(server.RESULTS_WHITELIST))
def test_results_endpoint_matches_disk(name):
    r = client.get(f"/api/results/{name}")
    assert r.status_code == 200
    env = r.json()
    path = REPO_ROOT / server.RESULTS_WHITELIST[name]
    assert env["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert env["data"] == json.loads(path.read_text(encoding="utf-8"))
    assert env["source_path"] == server.RESULTS_WHITELIST[name]


@pytest.mark.parametrize("bad", ["nope", "..%2F..%2Fpyproject.toml", "fidelity.json", "FIDELITY"])
def test_results_endpoint_rejects_unknown_names(bad):
    assert client.get(f"/api/results/{bad}").status_code == 404


def test_health_reports_scene_availability():
    body = client.get("/api/health").json()
    assert body["status"] == "ONLINE"
    assert set(body["scenes"]) == set(server.SCENE_FILES)
    assert body["label_engine"] in {"onnx", "heuristic"}


def test_labels_stay_aligned_when_sanitizer_drops_points(tmp_path, monkeypatch):
    """Regression: labels used to be loaded unfiltered after points were sanitized, shifting every class."""
    import numpy as np

    pts = np.array(
        [
            [5.0, 0.0, -1.7, 0.1],      # kept, label 40
            [np.nan, 0.0, 0.0, 0.1],    # dropped (non-finite)
            [0.1, 0.0, 0.0, 0.1],       # dropped (inside min range / ego reflection)
            [10.0, 1.0, -1.7, 0.1],     # kept, label 50
            [500.0, 0.0, 0.0, 0.1],     # dropped (beyond max range)
            [15.0, -2.0, 0.5, 0.1],     # kept, label 80
        ],
        dtype=np.float32,
    )
    labels = np.array([40, 11, 12, 50, 13, 80], dtype=np.uint32)  # distinct id per point
    (tmp_path / "t.bin").write_bytes(pts.tobytes())
    (tmp_path / "t.label").write_bytes(labels.tobytes())

    monkeypatch.setattr(server, "REPO_ROOT", tmp_path)
    monkeypatch.setitem(server.SCENE_FILES, "tmp_scene", ("t.bin", "t.label"))

    out_pts, out_sem, source = server.load_scene_arrays("tmp_scene")
    assert source == "gt"
    assert len(out_pts) == len(out_sem) == 3
    assert out_sem.tolist() == [40, 50, 80]
    assert out_pts[:, 0].tolist() == [5.0, 10.0, 15.0]
