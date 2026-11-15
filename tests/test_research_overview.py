"""The research pages must be built from measured files, and must not carry hand-typed legacy numbers."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_overview_shape_and_sources(client):
    j = client.get("/api/v1/research/overview").json()
    assert {"measured", "sources", "variants", "headlines", "insights", "failures", "protocol"} <= set(j)
    assert j["protocol"]["baseline"].startswith("Stable Diffusion 1.5")
    for f in j["failures"]:
        assert f["title"] and f["cause"] and f["evidence"] and f["mitigation"]  # every lesson states why, evidence and action


def test_headlines_are_derived_from_the_measured_file(client):
    f = ROOT / "evaluation" / "results" / "fid" / "fid_results.json"
    if not f.is_file():
        return
    data = json.loads(f.read_text())
    j = client.get("/api/v1/research/overview").json()
    b0 = data["B0"]
    fastest = min(data.values(), key=lambda v: v["latency_median_ms"])
    speed = next(h for h in j["headlines"] if h["label"].startswith("Faster"))
    assert speed["value"] == f"{b0['latency_median_ms'] / fastest['latency_median_ms']:.0f}x"
    row = next(r for r in j["variants"] if r["id"] == "B0")
    assert row["fid"] == b0["fid"] and abs(row["speedup"] - 1.0) < 1e-9


def test_missing_results_degrade_instead_of_failing(tmp_path):
    from backend.app.services.research import build_overview
    j = build_overview(tmp_path)  # no evaluation/ folder at all
    assert j["measured"] is False and j["variants"] == [] and j["headlines"] == []
    assert any(f["title"] == "Not run on a phone" for f in j["failures"])  # static honesty items still present


def test_dashboard_has_no_handtyped_legacy_numbers():
    html = (ROOT / "backend" / "app" / "static" / "index.html").read_text(encoding="utf-8")
    for stale in ("866 ms", "3.01×", "6,500 MB", "-43.4%", "1MS22CS001"):
        assert stale not in html, f"stale hand-typed value still in the research dashboard: {stale}"


def test_front_pages_use_our_own_images_not_the_old_horse_or_stock_photos():
    static = ROOT / "backend" / "app" / "static"
    assert not (static / "demo_cabin.png").exists()  # the mislabelled horse picture is gone
    assert (static / "showcase" / "cabin.jpg").is_file()
    html = (static / "index.html").read_text(encoding="utf-8")
    assert "demo_cabin" not in html and "riding a horse" not in html and "showcase/cabin.jpg" in html
    for f in (ROOT / "frontend" / "src").rglob("*.tsx"):
        text = f.read_text(encoding="utf-8")
        assert "demo_cabin" not in text and "picsum.photos" not in text and "unsplash.com" not in text, f"{f.name} still uses a placeholder image"
    for name in ("hero", "cabin", "neon", "dragon", "reef", "space", "abstract"):
        assert (ROOT / "frontend" / "src" / "assets" / "showcase" / f"{name}.jpg").is_file()
