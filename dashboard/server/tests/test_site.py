"""The API server also serves the built two-page site (home at /, dashboard at /dashboard/)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dashboard.server import app as server


def make_dist(root: Path) -> Path:
    """A tiny stand-in for `dashboard/client/dist`: two pages, a bundle and a brand file."""
    for sub in ("dashboard", "assets", "brand"):
        (root / sub).mkdir()
    (root / "index.html").write_text("<h1>home page</h1>", encoding="utf-8")
    (root / "dashboard" / "index.html").write_text("<h1>dashboard page</h1>", encoding="utf-8")
    (root / "assets" / "app.js").write_text("console.log('app')", encoding="utf-8")
    (root / "brand" / "logo.png").write_bytes(b"\x89PNG-bytes")
    (root / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    return root


def make_app(dist: Path) -> TestClient:
    app = FastAPI()

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ONLINE"}

    assert server.mount_site(app, dist) is True
    return TestClient(app)


def test_home_and_dashboard_pages_are_both_served(tmp_path):
    client = make_app(make_dist(tmp_path))
    assert "home page" in client.get("/").text
    assert "dashboard page" in client.get("/dashboard/").text
    # The dashboard link without its trailing slash still lands on the page.
    assert "dashboard page" in client.get("/dashboard").text


def test_assets_brand_files_and_favicon_are_served(tmp_path):
    client = make_app(make_dist(tmp_path))
    assert client.get("/assets/app.js").status_code == 200
    assert client.get("/brand/logo.png").content == b"\x89PNG-bytes"
    assert client.get("/favicon.svg").status_code == 200


def test_the_site_never_shadows_an_api_route_and_unknown_paths_are_404(tmp_path):
    client = make_app(make_dist(tmp_path))
    assert client.get("/api/health").json() == {"status": "ONLINE"}
    assert client.get("/no-such-page").status_code == 404
    assert client.get("/../secret.txt").status_code == 404


def test_without_a_build_nothing_is_mounted(tmp_path):
    app = FastAPI()
    assert server.mount_site(app, tmp_path) is False
    assert TestClient(app).get("/").status_code == 404


def test_the_real_app_keeps_its_api_when_a_build_exists():
    # Whether or not dist/ exists on this machine, the catch-all mount must sit after the API routes.
    client = TestClient(server.app)
    assert client.get("/api/health").json()["status"] == "ONLINE"
    if (server.DIST_DIR / "dashboard" / "index.html").is_file():
        assert client.get("/dashboard/").status_code == 200
