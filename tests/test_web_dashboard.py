def test_root_serves_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Imagine AI" in r.text
    assert "Model Comparison" in r.text


def test_dashboard_alias(client):
    r = client.get("/dashboard")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_static_assets(client):
    r_css = client.get("/static/styles.css")
    assert r_css.status_code == 200
    assert "var(--bg-app)" in r_css.text

    r_js = client.get("/static/app.js")
    assert r_js.status_code == 200
    assert "initModelComparisonChart" in r_js.text


def test_metrics_summary(client):
    r = client.get("/api/v1/metrics/summary")
    assert r.status_code == 200
    data = r.json()
    assert "summary_cards" in data
    import json
    from pathlib import Path
    f = Path(__file__).resolve().parents[1] / "evaluation" / "results" / "fid" / "fid_results.json"
    cards = data["summary_cards"]
    if f.is_file() and data["source"].startswith("measured"):  # numbers must come from the measured benchmark
        m = json.loads(f.read_text())
        assert cards["best_clip_alignment"] == round(max(v["clip_mean"] for v in m.values()), 3)
        assert cards["baseline_latency_ms"] == round(m["B0"]["latency_median_ms"], 1)
    else:
        assert cards["best_clip_alignment"] == 0.333 and cards["inference_speedup_x"] == 3.01  # legacy fallback labelled "legacy"


def test_stress_generate_adaptive_ladder(client):
    from unittest.mock import patch
    from PIL import Image

    dummy_img = Image.new("RGB", (128, 128), color="red")
    with patch("backend.app.main.generate_with_model") as mock_gen:
        mock_gen.return_value = {
            "image": dummy_img,
            "latency_ms": 95.0,
            "peak_vram_mb": 1400.0,
            "precision": "fp16"
        }

        # Test tight constraints triggering ladder step 4
        tight_payload = {
            "prompt": "neon cyber drone",
            "latency_budget_ms": 100,
            "vram_budget_mb": 1800,
            "model_choice": "sd_turbo"
        }
        r = client.post("/api/v1/adaptive/stress-generate", json=tight_payload)
        assert r.status_code == 200
        d = r.json()
        assert d["ladder_step"] == 4
        assert d["budget_met"] is True  # 95 <= 100
        assert "Classical Rescaling" in d["ladder_name"]
        assert "image_url" in d

        # Test standard budget triggering ladder step 1
        standard_payload = {
            "prompt": "mountain landscape at sunrise",
            "latency_budget_ms": 400,
            "vram_budget_mb": 4096,
            "model_choice": "sd_turbo"
        }
        r2 = client.post("/api/v1/adaptive/stress-generate", json=standard_payload)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ladder_step"] == 1
        assert d2["chosen_steps"] == 2
        assert d2["chosen_resolution"] == 512
