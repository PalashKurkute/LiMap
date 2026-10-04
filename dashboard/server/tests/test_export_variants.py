"""Tests for the variant snapshots written by scripts/export_dashboard_data.py (schema limap.variant/1).

One synthetic scene (scene_d_poles) is generated into a tmp dir, exactly as the exporter does, so these tests
never touch the committed snapshots. Run from the repo root: pytest dashboard/server/tests
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Dict

import numpy as np
import pytest

from core.grid.fovea_controller import DynamicFoveaController
from core.grid.spatial_hash import CELL_DTYPE, DEFAULT_MAX_CELLS, SpatialHashGrid
from scripts import export_dashboard_data as exporter

SCENE_ID = "scene_d_poles"
POOL_MB = 3.2616  # 106,875 cells x 32 B, the product pool
CELL_KEYS = {"total_active", "n", "sampled", "ix", "iy", "ring", "sem", "count", "z", "var", "zmin", "zmax", "oh", "cl"}
FOVEA_KEYS = {"preset", "input", "shift_x_m", "shift_y_m", "forward_reach_m", "stretch_ratio"}
META_KEYS = {"scene_id", "variant", "kind", "generated_at", "git_sha", "label_source", "base_inputs_sha256",
             "points_raw", "lattice", "pool", "fovea", "uniform", "stats"}
STATS_KEYS = {"active_cells", "cells_per_ring", "cells_per_band", "ring0_ahead", "ring0_behind"}


@pytest.fixture(scope="module")
def scene(tmp_path_factory) -> exporter.SceneData:
    return exporter.load_synthetic_scenes(tmp_path_factory.mktemp("synthetic"))[SCENE_ID]


@pytest.fixture(scope="module")
def base(scene) -> Dict[str, object]:
    return exporter.scene_snapshot(SCENE_ID, scene.kind, scene.pts, scene.sem, scene.src, scene.inputs, scene.note)


@pytest.fixture(scope="module")
def variants(scene, base) -> Dict[str, Dict[str, object]]:
    return exporter.build_variants(SCENE_ID, scene, base["cells"])


@pytest.fixture(scope="module")
def fovea_variants(variants):
    return {vid: variants[vid] for vid in exporter.FOVEA_VARIANTS}


def _strip(blob: Dict[str, object]) -> Dict[str, object]:
    return exporter._without_provenance(blob)


def _cell_centres(variant: Dict[str, object]):
    """(x, y, res) of every exported cell, derived the way the client does: from (ix, iy, ring) + the lattice table."""
    cells = variant["cells"]
    res_by_ring = {r["ring_id"]: r["res_m"] for r in variant["meta"]["lattice"]}
    res = np.array([res_by_ring[r] for r in cells["ring"]])
    ix, iy = np.array(cells["ix"], dtype=np.float64), np.array(cells["iy"], dtype=np.float64)
    return (ix + 0.5) * res, (iy + 0.5) * res, res


# --- preset selection ----------------------------------------------------------------------------------------------

@pytest.mark.parametrize("variant_id", list(exporter.FOVEA_VARIANTS))
def test_input_selects_expected_preset(variant_id, variants):
    preset, (vx, vy, yaw) = exporter.FOVEA_VARIANTS[variant_id]
    state = DynamicFoveaController().update(np.array([vx, vy]), yaw_rate_rads=yaw)
    assert state.preset_name == preset
    fovea = variants[variant_id]["meta"]["fovea"]
    assert fovea["preset"] == preset
    assert fovea["input"] == {"vx_mps": vx, "vy_mps": vy, "yaw_rate_rads": yaw}
    shift_x, shift_y, reach = DynamicFoveaController.PRESETS[preset]
    assert (fovea["shift_x_m"], fovea["shift_y_m"], fovea["forward_reach_m"]) == (shift_x, shift_y, reach)


def test_nominal_input_is_nominal_and_has_no_variant(variants):
    state = DynamicFoveaController().update(np.array(exporter.NOMINAL_INPUT[:2]), yaw_rate_rads=exporter.NOMINAL_INPUT[2])
    assert state.preset_name == "NOMINAL"
    assert set(variants) == set(exporter.VARIANT_IDS) and len(variants) == 5
    assert not any("nominal" in vid for vid in variants)


def test_run_grid_returns_state_only_with_velocity(scene):
    assert exporter.run_grid(scene.pts, scene.sem, SpatialHashGrid()) is None
    state = exporter.run_grid(scene.pts, scene.sem, SpatialHashGrid(), velocity=(12.0, 0.0))
    assert state.preset_name == "HIGHWAY_EXTENDED"


def test_forward_reach_is_along_the_fovea_centre_line(fovea_variants):
    """forward_reach_m = shift_x + 10 m is the reach through the fovea CENTRE (y = shift_y).

    On the vehicle axis (y = 0) a turning preset reaches slightly less: 2 + sqrt(10^2 - 1.5^2) = 11.887 m, not 12.0.
    """
    for vid, v in fovea_variants.items():
        f = v["meta"]["fovea"]
        assert f["forward_reach_m"] == pytest.approx(f["shift_x_m"] + 10.0)
        axis_reach = f["shift_x_m"] + math.sqrt(10.0 ** 2 - f["shift_y_m"] ** 2)
        if f["shift_y_m"] == 0.0:
            assert axis_reach == pytest.approx(f["forward_reach_m"])
        else:
            assert axis_reach == pytest.approx(11.887, abs=1e-3) and axis_reach < f["forward_reach_m"]


# --- NOMINAL == base -----------------------------------------------------------------------------------------------

def test_nominal_cells_equal_base_snapshot(scene, base):
    grid = SpatialHashGrid()
    state = exporter.run_grid(scene.pts, scene.sem, grid, velocity=(0.0, 0.0), yaw=0.0)
    assert state.preset_name == "NOMINAL"
    assert exporter.cells_columnar(grid, exporter.MAX_CELLS) == base["cells"]
    exporter.assert_nominal_is_base(scene, base["cells"])  # the exporter's own guard agrees


# --- geometry ------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("variant_id", list(exporter.FOVEA_VARIANTS))
def test_fovea_cell_ring_matches_distance_from_shifted_centre(variant_id, variants):
    v = variants[variant_id]
    f = v["meta"]["fovea"]
    cx, cy, res = _cell_centres(v)
    d = np.hypot(cx - f["shift_x_m"], cy - f["shift_y_m"])
    tol = res * math.sqrt(2.0) / 2.0 + 1e-6  # a cell is keyed by points up to half a diagonal from its centre
    bands = {r["ring_id"]: (r["r_inner"], r["r_outer"]) for r in v["meta"]["lattice"]}
    lo = np.array([bands[r][0] for r in v["cells"]["ring"]])
    hi = np.array([bands[r][1] for r in v["cells"]["ring"]])
    assert len(d) > 0
    assert np.all(d >= lo - tol), "cell sits inside its ring's inner radius"
    assert np.all(d < hi + tol), "cell sits outside its ring's outer radius"


def test_shifted_fovea_moves_fine_cells_ahead(variants):
    for vid in ("fovea_city_cruise", "fovea_highway_extended"):
        s = variants[vid]["meta"]["stats"]
        assert s["ring0_ahead"] > s["ring0_behind"], vid
    # the unshifted 5 cm reference has fine cells on both sides of the sensor
    uniform = variants["uniform_5cm"]["meta"]["stats"]
    assert uniform["ring0_ahead"] > 0 and uniform["ring0_behind"] > 0


@pytest.mark.parametrize("variant_id", list(exporter.FOVEA_VARIANTS))
def test_fovea_variants_keep_the_product_pool(variant_id, variants):
    meta = variants[variant_id]["meta"]
    assert meta["kind"] == "fovea_preset" and meta["uniform"] is None
    assert meta["pool"]["mb"] == POOL_MB
    assert meta["pool"]["capacity"] == DEFAULT_MAX_CELLS
    assert meta["pool"]["cell_bytes"] == CELL_DTYPE.itemsize == 32
    assert 0 < meta["pool"]["active_cells"] <= meta["pool"]["capacity"]
    assert len(meta["lattice"]) == 4


def test_uniform_lattice_is_one_5cm_ring(variants):
    meta = variants["uniform_5cm"]["meta"]
    assert meta["kind"] == "uniform_reference" and meta["fovea"] is None
    assert len(meta["lattice"]) == 1
    assert meta["lattice"][0] == {"ring_id": 0, "res_m": 0.05, "r_inner": 0.0, "r_outer": 100.0}
    assert set(variants["uniform_5cm"]["cells"]["ring"]) == {0}
    assert meta["pool"]["capacity"] == 500_000 == meta["uniform"]["pool_capacity"]
    assert meta["pool"]["mb"] == meta["uniform"]["pool_mb"] == round(500_000 * 32 / 2 ** 20, 4)
    assert meta["uniform"]["res_m"] == 0.05 and meta["uniform"]["r_outer_m"] == 100.0
    assert meta["uniform"]["theoretical_capacity_mb"] == exporter.calculate_baselines().uniform_25d_mb


def test_constructor_pool_assert_still_guards_the_product_pool():
    """The uniform grid swaps its pool in AFTER construction; the 3.5 MB assert itself must stay in force."""
    with pytest.raises(AssertionError):
        SpatialHashGrid(capacity=500_000)
    grid = exporter.make_uniform_reference_grid()
    assert grid.capacity == len(grid.cells) == 500_000
    assert grid.total_memory_mb == grid.cells.nbytes / (1024.0 * 1024.0)


def test_uniform_has_at_least_as_many_cells_as_every_fovea_variant(variants):
    uniform = variants["uniform_5cm"]["meta"]["pool"]["active_cells"]
    for vid in exporter.FOVEA_VARIANTS:
        assert uniform >= variants[vid]["meta"]["pool"]["active_cells"], vid


# --- stats ---------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("variant_id", exporter.VARIANT_IDS)
def test_stats_are_consistent_and_computed_on_the_full_grid(variant_id, variants):
    v = variants[variant_id]
    stats, pool, cells = v["meta"]["stats"], v["meta"]["pool"], v["cells"]
    assert set(stats) == STATS_KEYS
    assert stats["active_cells"] == pool["active_cells"] == cells["total_active"]
    assert sum(stats["cells_per_band"]) == stats["active_cells"]
    assert sum(stats["cells_per_ring"]) == stats["active_cells"]
    assert len(stats["cells_per_band"]) == 4
    assert len(stats["cells_per_ring"]) == len(v["meta"]["lattice"])
    # stats must not shrink to the sampled subset
    assert stats["active_cells"] >= cells["n"]
    if variant_id == "uniform_5cm":
        assert stats["ring0_ahead"] + stats["ring0_behind"] == stats["cells_per_band"][0]
    else:
        assert stats["ring0_ahead"] + stats["ring0_behind"] == stats["cells_per_ring"][0]


# --- FoveaGrid ring 0 == uniform 5 cm inside the fovea ------------------------------------------------------------

def test_nominal_ring0_cells_equal_uniform_cells_within_10m(scene):
    fovea = SpatialHashGrid()
    exporter.run_grid(scene.pts, scene.sem, fovea)
    uniform = exporter.make_uniform_reference_grid()
    exporter.run_grid(scene.pts, scene.sem, uniform)

    def interior(grid, ring_filter):
        a = grid.get_active_cells()
        # Centre within 9.9 m => every point that can fall in the cell (<= 0.036 m away) is inside ring 0 too.
        cx, cy = (a["ix"] + 0.5) * 0.05, (a["iy"] + 0.5) * 0.05
        a = a[(np.hypot(cx, cy) < 9.9) & ring_filter(a)]
        return {(int(c["ix"]), int(c["iy"])): (int(c["count"]), float(c["mean_z"])) for c in a}

    f = interior(fovea, lambda a: a["ring_id"] == 0)
    u = interior(uniform, lambda a: np.ones(len(a), dtype=bool))
    assert len(f) > 1000
    assert f.keys() == u.keys()
    for key, (count, mean_z) in f.items():
        assert u[key][0] == count
        assert u[key][1] == pytest.approx(mean_z, abs=1e-6)


# --- schema, sampling, determinism ---------------------------------------------------------------------------------

@pytest.mark.parametrize("variant_id", exporter.VARIANT_IDS)
def test_schema_shape(variant_id, variants):
    v = variants[variant_id]
    assert set(v) == {"schema", "meta", "cells"}  # cells only: no points, no cross_section
    assert v["schema"] == "limap.variant/1"
    meta = v["meta"]
    assert set(meta) == META_KEYS
    assert meta["scene_id"] == SCENE_ID and meta["variant"] == variant_id
    assert meta["label_source"] == "gt"
    assert meta["points_raw"] > 0
    assert set(meta["base_inputs_sha256"]) and all(len(h) == 64 for h in meta["base_inputs_sha256"].values())
    assert set(v["cells"]) == CELL_KEYS
    if meta["fovea"] is not None:
        assert set(meta["fovea"]) == FOVEA_KEYS
        assert set(meta["fovea"]["input"]) == {"vx_mps", "vy_mps", "yaw_rate_rads"}
    if meta["uniform"] is not None:
        assert set(meta["uniform"]) == {"res_m", "r_outer_m", "pool_capacity", "pool_mb", "theoretical_capacity_mb"}


@pytest.mark.parametrize("variant_id", exporter.VARIANT_IDS)
def test_cells_are_stride_sampled_above_the_variant_cap(variant_id, variants):
    cells = variants[variant_id]["cells"]
    total = cells["total_active"]
    assert exporter.MAX_VARIANT_CELLS == 20_000
    assert cells["sampled"] is (total > exporter.MAX_VARIANT_CELLS)
    assert cells["n"] == min(total, exporter.MAX_VARIANT_CELLS)
    for key in CELL_KEYS - {"total_active", "n", "sampled"}:
        assert len(cells[key]) == cells["n"], key


def test_base_inputs_match_the_base_snapshot(variants, base):
    for v in variants.values():
        assert v["meta"]["base_inputs_sha256"] == base["meta"]["inputs_sha256"]
        assert v["meta"]["points_raw"] == base["meta"]["points_raw"]
        assert v["meta"]["label_source"] == base["meta"]["label_source"]


def test_variant_export_is_deterministic(scene, base, variants):
    again = exporter.build_variants(SCENE_ID, scene, base["cells"])
    assert set(again) == set(variants)
    for vid in variants:
        assert exporter.dumps(_strip(again[vid])) == exporter.dumps(_strip(variants[vid])), vid


# --- manifest + --check --------------------------------------------------------------------------------------------

def test_written_files_and_manifest_entries_agree(scene, base, tmp_path):
    entries = exporter.write_variants(tmp_path, SCENE_ID, scene, base["cells"])
    on_disk = sorted(p.relative_to(tmp_path).as_posix() for p in (tmp_path / "variants").glob("*/*.json"))
    assert sorted(e["file"] for e in entries.values()) == on_disk
    assert set(entries) == set(exporter.VARIANT_IDS)
    for vid, e in entries.items():
        path = tmp_path / e["file"]
        assert path.name == f"{vid}.json" and path.parent.name == SCENE_ID
        assert e["bytes"] == path.stat().st_size
        blob = json.loads(path.read_text(encoding="utf-8"))
        assert e["active_cells"] == blob["meta"]["pool"]["active_cells"]
    assert not any("nominal" in name for name in on_disk)


def test_committed_manifest_lists_exactly_the_committed_variant_files():
    data_dir = exporter.OUT_DIR
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    assert {"generated_at", "git_sha", "scenes", "results", "variants"} <= set(manifest)
    listed = {e["file"]: e for per_scene in manifest["variants"].values() for e in per_scene.values()}
    on_disk = {p.relative_to(data_dir).as_posix() for p in (data_dir / "variants").glob("*/*.json")}
    assert set(listed) == on_disk
    assert set(manifest["variants"]) == set(manifest["scenes"])
    for rel, e in listed.items():
        assert (data_dir / rel).stat().st_size == e["bytes"], rel
    assert len(on_disk) == len(manifest["scenes"]) * 5


def test_check_flags_missing_stale_and_manifest_drift(scene, base, tmp_path):
    fresh, committed = tmp_path / "fresh", tmp_path / "committed"
    entries = exporter.write_variants(fresh, SCENE_ID, scene, base["cells"])
    (fresh / "manifest.json").write_text(json.dumps({"variants": {SCENE_ID: entries}}), encoding="utf-8")
    shutil.copytree(fresh, committed)
    assert exporter.stale_variants(fresh, committed) == []

    # Provenance moves with every commit and must not count as stale.
    path = committed / "variants" / SCENE_ID / "uniform_5cm.json"
    blob = json.loads(path.read_text(encoding="utf-8"))
    blob["meta"]["generated_at"], blob["meta"]["git_sha"] = "1999-01-01T00:00:00+00:00", "deadbee"
    path.write_text(exporter.dumps(blob), encoding="utf-8")
    manifest = json.loads((committed / "manifest.json").read_text(encoding="utf-8"))
    manifest["variants"][SCENE_ID]["uniform_5cm"]["bytes"] = path.stat().st_size
    (committed / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    assert exporter.stale_variants(fresh, committed) == []

    # Real content drift, a missing file, an unexpected file and a manifest cell-count mismatch are each reported.
    blob["cells"]["z"][0] += 1.0
    path.write_text(exporter.dumps(blob), encoding="utf-8")
    manifest["variants"][SCENE_ID]["uniform_5cm"]["bytes"] = path.stat().st_size
    manifest["variants"][SCENE_ID]["fovea_turning_left"]["active_cells"] += 1
    (committed / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    (committed / "variants" / SCENE_ID / "fovea_city_cruise.json").unlink()
    (committed / "variants" / SCENE_ID / "fovea_nominal.json").write_text("{}", encoding="utf-8")

    stale = exporter.stale_variants(fresh, committed)
    assert f"variants/{SCENE_ID}/uniform_5cm.json" in stale
    assert f"variants/{SCENE_ID}/fovea_city_cruise.json (missing)" in stale
    assert f"variants/{SCENE_ID}/fovea_nominal.json (unexpected)" in stale
    assert any(s.startswith("manifest.json variants block") and f"{SCENE_ID}/fovea_turning_left" in s for s in stale)
