"""The dashboard/website must show MEASURED data, never hard-coded numbers, and must degrade honestly when none exists."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "evaluation" / "scripts"))
sys.path.insert(0, str(ROOT / "ai_engine" / "training"))


def test_benchmark_endpoint_shape(client):
    j = client.get("/api/v1/metrics/benchmark").json()
    assert set(j) == {"measured", "variants", "protocol"}
    assert isinstance(j["measured"], bool) and isinstance(j["variants"], dict)
    for v in j["variants"].values():  # when a benchmark exists every row carries the required metrics
        assert {"fid", "kid_mean", "clip_mean", "latency_median_ms", "peak_vram_mb", "model_size_mb"} <= set(v)


def test_summary_is_labelled_with_its_source(client):
    j = client.get("/api/v1/metrics/summary").json()
    assert j["source"].startswith(("measured", "legacy"))  # never an unlabelled constant
    assert {"best_clip_alignment", "inference_speedup_x", "baseline_latency_ms", "vram_reduction_pct"} <= set(j["summary_cards"])


def test_summary_derives_numbers_from_measured_file(client, monkeypatch, tmp_path):
    import backend.app.main as m  # noqa: F401  (route reads evaluation/results/fid/fid_results.json relative to the repo)
    f = ROOT / "evaluation" / "results" / "fid" / "fid_results.json"
    if not f.is_file():
        pytest.skip("no measured benchmark in this checkout")
    data = json.loads(f.read_text())
    j = client.get("/api/v1/metrics/summary").json()
    if "B0" in data:
        assert j["source"].startswith("measured")
        assert j["summary_cards"]["baseline_latency_ms"] == round(data["B0"]["latency_median_ms"], 1)


def test_training_runs_are_real_records(client):
    j = client.get("/api/v1/training/runs").json()
    assert {"runs", "datasets", "reproduce"} <= set(j)
    names = {r["name"] for r in j["runs"]}
    approved = [r for r in j["runs"] if r["approved"]]
    for r in j["runs"]:
        assert r["name"] in names and r["base_model"]
    if (ROOT / "adapters" / "coco_sd15_lenbalanced_step2500" / "approval.json").is_file():
        assert any(r["name"] == "coco_sd15_lenbalanced_step2500" for r in approved)
    for d in j["datasets"]:
        assert d["train"] and d["validation"]  # held-out validation split exists


# ---- compositional prompt generator -------------------------------------------------------------------------------
def test_compositional_prompts_are_deterministic_and_grammatical():
    import run_compositional_eval as c
    a, b = c.make_prompts(10), c.make_prompts(10)
    assert [x["prompt"] for x in a] == [x["prompt"] for x in b]
    assert len(a) == 50 and {x["cat"] for x in a} == set(c.CATS)
    for x in a:
        assert " a apple" not in x["prompt"] and " a orange " not in x["prompt"] and " a elephant" not in x["prompt"]
    counting = [x for x in a if x["cat"] == "counting"]
    assert all(2 <= x["n"] <= 4 for x in counting)


def test_compositional_prompts_two_objects_are_distinct():
    import run_compositional_eval as c
    for x in c.make_prompts(30):
        if x["cat"] in {"two_objects", "position"}:
            assert x["objs"][0] != x["objs"][1]


# ---- LCM warm-start helper ----------------------------------------------------------------------------------------
def test_pop_arg_handles_both_forms_and_absence():
    from ai_engine.training.lcm_warmstart import pop_arg
    argv = ["x", "--init_lora_from", "foo", "--a", "1"]
    assert pop_arg(argv, "--init_lora_from") == "foo" and argv == ["x", "--a", "1"]
    argv = ["x", "--init_lora_from=bar"]
    assert pop_arg(argv, "--init_lora_from") == "bar" and argv == ["x"]
    assert pop_arg(["x"], "--init_lora_from") is None


def test_vendored_lcm_trainer_is_byte_identical_to_upstream():
    """Our warm start patches the trainer at runtime; the vendored file must stay the pinned upstream source."""
    import hashlib
    p = ROOT / "ai_engine" / "training" / "third_party" / "train_lcm_distill_lora_sd_wds.py"
    assert hashlib.sha256(p.read_bytes()).hexdigest() == "91574a77355539f44cacb229596eeb97e59da20ab969b2fe868132aaeb1047ec"
