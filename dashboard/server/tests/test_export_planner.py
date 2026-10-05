"""Tests for the bridge-underpass planner snapshot written by scripts/export_dashboard_data.py (schema limap.planner/1).

The scene is generated into a tmp dir exactly as the exporter does, so these tests never touch the committed data.
Run from the repo root: pytest dashboard/server/tests
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

import numpy as np
import pytest

from benchmark.regret_benchmark import PlannerRegretBenchmark
from core.planning.costmap_generator import COST_LETHAL
from scripts import export_dashboard_data as exporter

SCENE_ID = exporter.PLANNER_SCENE
META_KEYS = {"scene_id", "scenario", "generated_at", "git_sha", "label_source", "base_inputs_sha256", "costmap",
             "planner", "start", "goal", "grids"}
MAP_KEYS = {"n", "ix", "iy", "v"}


@pytest.fixture(scope="module")
def synthetic_dir(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("synthetic")


@pytest.fixture(scope="module")
def scene(synthetic_dir) -> exporter.SceneData:
    return exporter.load_synthetic_scenes(synthetic_dir)[SCENE_ID]


@pytest.fixture(scope="module")
def snap(scene) -> Dict[str, object]:
    return exporter.planner_snapshot(SCENE_ID, scene)


@pytest.fixture(scope="module")
def base(scene) -> Dict[str, object]:
    return exporter.scene_snapshot(SCENE_ID, scene.kind, scene.pts, scene.sem, scene.src, scene.inputs, scene.note)


def _world(cm_meta: Dict[str, object], ix, iy):
    res, ox, oy = cm_meta["resolution_m"], cm_meta["origin_x_m"], cm_meta["origin_y_m"]
    return ox + (np.asarray(ix) + 0.5) * res, oy + (np.asarray(iy) + 0.5) * res


# --- agreement with the benchmark -----------------------------------------------------------------------------------

def test_matches_the_benchmark_on_the_same_files(snap, synthetic_dir):
    """The dashboard must show what benchmark/regret_benchmark.py reports for the bridge underpass, not a lookalike."""
    bench = PlannerRegretBenchmark().benchmark_bridge_underpass(
        str(synthetic_dir / "scene_a_bridge_underpass.bin"), str(synthetic_dir / "scene_a_bridge_underpass.label"))
    res = snap["results"]
    assert tuple(bench["start"]) == tuple(snap["meta"]["start"]) and tuple(bench["goal"]) == tuple(snap["meta"]["goal"])
    assert res["aware"]["traversable"] is bench["underpass_traversable_fovea"]
    assert res["naive"]["traversable"] is bench["underpass_traversable_naive"]
    assert res["aware"]["cost"] == pytest.approx(float(bench["cost_foveagrid_25d"]), abs=0.005)
    assert res["reference"]["cost"] == pytest.approx(float(bench["cost_dense_3d_ideal"]), abs=0.005)
    assert bench["cost_naive_2d"] == "BLOCKED (INF)" and res["naive"]["cost"] is None


# --- schema -------------------------------------------------------------------------------------------------------

def test_schema_and_meta(snap, scene):
    assert snap["schema"] == exporter.PLANNER_SCHEMA == "limap.planner/1"
    assert set(snap) == {"schema", "meta", "maps", "results"}
    meta = snap["meta"]
    assert set(meta) == META_KEYS
    assert meta["scene_id"] == SCENE_ID and meta["label_source"] == scene.src
    assert meta["base_inputs_sha256"] == scene.inputs
    cm = meta["costmap"]
    assert cm["lethal"] == COST_LETHAL
    assert cm["nx"] * cm["resolution_m"] == pytest.approx(exporter.PLANNER_COSTMAP_M)
    assert cm["ny"] * cm["resolution_m"] == pytest.approx(exporter.PLANNER_COSTMAP_M)
    assert cm["origin_x_m"] == -exporter.PLANNER_COSTMAP_M / 2 and cm["origin_y_m"] == -exporter.PLANNER_COSTMAP_M / 2
    assert meta["planner"] == {"name": "HybridAStarPlanner", "step_size_m": exporter.PLANNER_STEP_M,
                               "xy_resolution_m": exporter.PLANNER_XY_RES_M}
    assert meta["start"] == list(exporter.PLANNER_START) and meta["goal"] == list(exporter.PLANNER_GOAL)
    assert set(meta["grids"]) == {"naive", "aware"} == set(snap["maps"])
    assert meta["grids"]["naive"]["ignore_overhang_clearance"] is True
    assert meta["grids"]["aware"]["ignore_overhang_clearance"] is False


def test_maps_are_sparse_and_self_consistent(snap):
    cm = snap["meta"]["costmap"]
    for name, m in snap["maps"].items():
        assert set(m) == MAP_KEYS
        assert m["n"] == len(m["ix"]) == len(m["iy"]) == len(m["v"])
        assert m["n"] > 0
        ix, iy, v = np.array(m["ix"]), np.array(m["iy"]), np.array(m["v"])
        assert ix.min() >= 0 and ix.max() < cm["nx"] and iy.min() >= 0 and iy.max() < cm["ny"]
        assert v.min() >= 1 and v.max() <= COST_LETHAL, "zero cells are implicit and must not be stored"
        assert snap["meta"]["grids"][name]["lethal_cells"] == int((v == COST_LETHAL).sum())
        # Row-major and duplicate-free, so the file is deterministic and each cell appears once.
        order = iy.astype(np.int64) * cm["nx"] + ix
        assert np.all(np.diff(order) > 0)


# --- what the two grids hand the planner --------------------------------------------------------------------------

def test_one_height_grid_walls_off_the_underpass(snap, base):
    """The naive grid has far more impassable cells, and they cover the deck; the 2.5D grid keeps most of it open."""
    naive, aware = snap["meta"]["grids"]["naive"]["lethal_cells"], snap["meta"]["grids"]["aware"]["lethal_cells"]
    assert naive > aware > 0

    cells = base["cells"]
    deck = [i for i, o in enumerate(cells["oh"]) if o is not None]
    assert deck, "the bridge scene must hold overhang cells"
    res = {r["ring_id"]: r["res_m"] for r in base["meta"]["lattice"]}
    dx = np.array([(cells["ix"][i] + 0.5) * res[cells["ring"][i]] for i in deck])
    dy = np.array([(cells["iy"][i] + 0.5) * res[cells["ring"][i]] for i in deck])

    def lethal_in_band(name):
        m = snap["maps"][name]
        wx, wy = _world(snap["meta"]["costmap"], m["ix"], m["iy"])
        lethal = np.array(m["v"]) == COST_LETHAL
        in_band = (wx >= dx.min() - 0.5) & (wx <= dx.max() + 0.5) & (wy >= dy.min() - 0.5) & (wy <= dy.max() + 0.5)
        return int((lethal & in_band).sum())

    assert lethal_in_band("naive") > 10 * max(1, lethal_in_band("aware"))


def test_one_height_grid_is_blocked_and_the_2p5d_grid_is_not(snap):
    res = snap["results"]
    assert res["naive"] == {"traversable": False, "cost": None, "waypoints": 0, "path": None}
    aware = res["aware"]
    assert aware["traversable"] is True and aware["waypoints"] == len(aware["path"]) > 2
    assert aware["cost"] >= res["reference"]["cost"] > 0  # an empty map is the cheapest possible route
    assert res["reference"]["traversable"] is True and "path" not in res["reference"]


def test_the_2p5d_path_is_a_real_route_through_the_deck(snap, base):
    meta, aware = snap["meta"], snap["results"]["aware"]
    path = np.array(aware["path"])
    sx, sy, _ = meta["start"]
    gx, gy, _ = meta["goal"]
    assert np.hypot(path[0, 0] - sx, path[0, 1] - sy) < 1e-6
    assert np.hypot(path[-1, 0] - gx, path[-1, 1] - gy) < 1.0  # the planner accepts a goal within its own tolerance
    step = np.hypot(*np.diff(path[:, :2], axis=0).T)
    assert np.all(step > 0.2) and np.all(step < 1.0)

    # No waypoint sits on an impassable cell of the map it was planned on.
    cm = meta["costmap"]
    m = snap["maps"]["aware"]
    lethal = {(x, y) for x, y, v in zip(m["ix"], m["iy"], m["v"]) if v == COST_LETHAL}
    gx_idx = np.floor((path[:, 0] - cm["origin_x_m"]) / cm["resolution_m"]).astype(int)
    gy_idx = np.floor((path[:, 1] - cm["origin_y_m"]) / cm["resolution_m"]).astype(int)
    assert not any((int(a), int(b)) in lethal for a, b in zip(gx_idx, gy_idx))

    # It really passes the deck: some waypoint lies between the overhang cells' extent along the road.
    cells = base["cells"]
    res = {r["ring_id"]: r["res_m"] for r in base["meta"]["lattice"]}
    dx = [(cells["ix"][i] + 0.5) * res[cells["ring"][i]] for i, o in enumerate(cells["oh"]) if o is not None]
    assert np.any((path[:, 0] >= min(dx)) & (path[:, 0] <= max(dx)))


# --- file format --------------------------------------------------------------------------------------------------

def test_is_deterministic_and_strict_json(snap, scene):
    again = exporter.planner_snapshot(SCENE_ID, scene)
    assert exporter._without_provenance(snap) == exporter._without_provenance(again)
    text = exporter.dumps(snap)  # allow_nan=False raises on inf / nan
    assert "Infinity" not in text and "NaN" not in text
    assert json.loads(text) == snap


def test_write_planner_returns_the_manifest_entry(scene, tmp_path):
    entry = exporter.write_planner(tmp_path, SCENE_ID, scene)
    file = tmp_path / entry["file"]
    assert entry["file"] == f"planner/{SCENE_ID}.json"
    assert file.is_file() and file.stat().st_size == entry["bytes"]
    assert json.loads(file.read_text(encoding="utf-8"))["schema"] == "limap.planner/1"


def test_stale_planner_detects_a_changed_or_missing_file(scene, tmp_path):
    fresh, committed = tmp_path / "fresh", tmp_path / "committed"
    for d in (fresh, committed):
        d.mkdir()
    entry = exporter.write_planner(fresh, SCENE_ID, scene)
    (fresh / "manifest.json").write_text(json.dumps({"planner": {SCENE_ID: entry}}), encoding="utf-8")

    # Missing in the committed tree.
    (committed / "manifest.json").write_text(json.dumps({"planner": {SCENE_ID: entry}}), encoding="utf-8")
    assert any("missing" in s for s in exporter.stale_planner(fresh, committed))

    # Identical content (timestamps may differ) is up to date.
    (committed / "planner").mkdir()
    blob = json.loads((fresh / entry["file"]).read_text(encoding="utf-8"))
    blob["meta"]["generated_at"] = "1970-01-01T00:00:00+00:00"
    blob["meta"]["git_sha"] = "abc1234"
    text = exporter.dumps(blob)
    (committed / entry["file"]).write_text(text, encoding="utf-8")
    (committed / "manifest.json").write_text(
        json.dumps({"planner": {SCENE_ID: {"file": entry["file"], "bytes": len(text.encode("utf-8"))}}}), encoding="utf-8")
    assert exporter.stale_planner(fresh, committed) == []

    # A changed result is stale.
    blob["results"]["aware"]["cost"] += 1
    text = exporter.dumps(blob)
    (committed / entry["file"]).write_text(text, encoding="utf-8")
    (committed / "manifest.json").write_text(
        json.dumps({"planner": {SCENE_ID: {"file": entry["file"], "bytes": len(text.encode("utf-8"))}}}), encoding="utf-8")
    assert exporter.stale_planner(fresh, committed) == [entry["file"]]
