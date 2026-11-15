"""SDTurboEngine adapter behaviour with FAKE torch/diffusers (tests OUR logic, not the real libraries)."""
import types

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from ai_engine.training.adapter import APPROVAL_FILE, LORA_WEIGHT_NAME
from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.services import engine as eng
from backend.app.services.errors import ServiceError
from tests.adapter_fixture import REV, make_adapter, make_approved


class FakeOOM(RuntimeError):
    pass


def install(monkeypatch, lora_error=None):
    """Fake ML stack. state records every from_pretrained and load_lora_weights call."""
    state = dict(loads=0, lora_calls=[], pipes=[])
    torch = types.SimpleNamespace(float16="f16", float32="f32")
    torch.cuda = types.SimpleNamespace(is_available=lambda: False, OutOfMemoryError=FakeOOM, empty_cache=lambda: None)

    class Ctx:
        def __enter__(self): return None
        def __exit__(self, *a): return False

    torch.inference_mode = lambda: Ctx()
    torch.Generator = lambda device: types.SimpleNamespace(manual_seed=lambda s: ("gen", device, s))

    class Pipe:
        scheduler = types.SimpleNamespace(config={"timestep_spacing": "trailing"})
        def __init__(self): self.lora = False
        def to(self, d): return self
        def set_adapters(self, *a, **kw): pass
        def set_progress_bar_config(self, **kw): pass
        def load_lora_weights(self, path, weight_name=None):
            state["lora_calls"].append((path, weight_name))
            if lora_error is not None:
                self.lora = "broken"
                raise lora_error
            self.lora = True
        def __call__(self, **kw):
            return types.SimpleNamespace(images=[Image.new("RGB", (kw["width"], kw["height"]))])

    class Auto:
        @staticmethod
        def from_pretrained(model_id, **kw):
            state["loads"] += 1
            p = Pipe()
            state["pipes"].append(p)
            return p

    monkeypatch.setattr(eng, "_import_ml", lambda: (torch, Auto))
    monkeypatch.setattr(eng.SDTurboEngine, "availability", lambda self: (True, ""))
    return state


def settings(tmp_path, adapter=None, rev=REV):
    return Settings(output_dir=tmp_path / "out", supported_resolutions=(256, 384, 512), model_revision=rev,
                    adapter_path=adapter, device="cpu")


def run_engine(tmp_path, adapter, rev=REV):
    e = eng.SDTurboEngine(settings(tmp_path, adapter, rev))
    e.ensure_loaded()
    return e, e.generate("a red cup beside a blue plate", 1, 256, 256, 1)


def test_no_adapter_means_base_only(tmp_path, monkeypatch):
    st = install(monkeypatch)
    e, res = run_engine(tmp_path, None)
    assert st["lora_calls"] == [] and not e.adapter_status()["configured"] and not e.adapter_status()["active"]
    assert res.model_revision == REV and res.adapter_sha256 is None


def test_approved_adapter_is_loaded_once_with_the_reviewed_call(tmp_path, monkeypatch):
    st = install(monkeypatch)
    d = make_approved(tmp_path)
    e, res = run_engine(tmp_path, d)
    assert st["lora_calls"] == [(str(d), LORA_WEIGHT_NAME)]  # same weight_name compare.py used when it was reviewed
    s = e.adapter_status()
    assert s["active"] and s["configured"] and len(s["adapter_sha256"]) == 64 and s["adapter_bytes"] > 0
    assert res.model_revision == f"{REV}+lora-{s['adapter_sha256'][:12]}"  # response says which weights made the image
    assert res.adapter_sha256 == s["adapter_sha256"]
    e.generate("again", 2, 256, 256, 1)
    assert len(st["lora_calls"]) == 1 and st["loads"] == 1  # loaded once, not per request


def test_unapproved_adapter_is_never_loaded(tmp_path, monkeypatch):
    st = install(monkeypatch)
    e, res = run_engine(tmp_path, make_adapter(tmp_path))
    assert st["lora_calls"] == [] and not e.adapter_status()["active"]
    assert "not been approved" in e.adapter_status()["reason"] and res.model_revision == REV


@pytest.mark.parametrize("rev", [None, "main", "d" * 40])
def test_unpinned_or_wrong_server_revision_rejects_adapter(tmp_path, monkeypatch, rev):
    st = install(monkeypatch)
    e, _ = run_engine(tmp_path, make_approved(tmp_path), rev=rev)
    assert st["lora_calls"] == [] and not e.adapter_status()["active"]


def test_tampered_or_missing_adapter_falls_back_without_crashing(tmp_path, monkeypatch):
    st = install(monkeypatch)
    d = make_approved(tmp_path)
    (d / LORA_WEIGHT_NAME).write_bytes(b"changed")
    e, res = run_engine(tmp_path, d)
    assert not e.adapter_status()["active"] and res.image.size == (256, 256) and st["lora_calls"] == []
    e2, _ = run_engine(tmp_path / "x", tmp_path / "does_not_exist")
    assert not e2.adapter_status()["active"]


def test_failed_lora_load_rebuilds_a_clean_base_pipeline(tmp_path, monkeypatch):
    st = install(monkeypatch, lora_error=ValueError("bad tensor shapes at /secret/path"))
    e, res = run_engine(tmp_path, make_approved(tmp_path))
    s = e.adapter_status()
    assert not s["active"] and "failed to load" in s["reason"] and "/secret/path" not in s["reason"]
    assert st["loads"] == 2 and len(st["lora_calls"]) == 1  # rebuilt, did not reuse the half-modified pipeline
    assert e._pipe is st["pipes"][1] and e._pipe.lora is False  # serving the CLEAN pipe, not the one that failed
    assert res.model_revision == REV and res.image.size == (256, 256)


def test_oom_while_loading_adapter_is_reported_not_swallowed(tmp_path, monkeypatch):
    install(monkeypatch, lora_error=FakeOOM("CUDA out of memory"))
    e = eng.SDTurboEngine(settings(tmp_path, make_approved(tmp_path)))
    with pytest.raises(ServiceError) as exc:
        e.ensure_loaded()
    assert exc.value.code == "RESOURCE_EXHAUSTED" and not e.is_loaded()


def test_status_before_load_reports_the_real_verdict_not_a_placeholder(tmp_path, monkeypatch):
    st = install(monkeypatch)
    good = eng.SDTurboEngine(settings(tmp_path, make_approved(tmp_path)))
    s = good.adapter_status()
    assert s["configured"] and not s["active"] and "will be applied" in s["reason"] and not good.is_loaded()
    cases = {"unapproved": (make_adapter(tmp_path, name="u"), REV, "not been approved"),
             "unpinned": (make_approved(tmp_path, name="p"), None, "pinned"),
             "missing": (tmp_path / "nope", REV, "needs")}
    for label, (path, rev, word) in cases.items():
        e = eng.SDTurboEngine(settings(tmp_path / label, path, rev))
        r = e.adapter_status()["reason"]
        assert "will not be used" in r and word in r and str(tmp_path) not in r, (label, r)
    assert st["loads"] == 0 and st["lora_calls"] == []  # pre-check never loads the model


def test_precheck_is_cached_but_the_real_load_revalidates(tmp_path, monkeypatch):
    install(monkeypatch)
    d = make_approved(tmp_path)
    e = eng.SDTurboEngine(settings(tmp_path, d))
    assert "will be applied" in e.adapter_status()["reason"]
    (d / LORA_WEIGHT_NAME).write_bytes(b"tampered after the pre-check")  # changes between status call and load
    e.ensure_loaded()
    s = e.adapter_status()
    assert not s["active"] and "hash" in s["reason"]  # load-time validation wins over the cached advisory


# ---- API
def client_for(tmp_path, monkeypatch, adapter, rev=REV, **kw):
    install(monkeypatch, **kw)
    st = settings(tmp_path, adapter, rev)
    return TestClient(create_app(engine=eng.SDTurboEngine(st), settings=st), raise_server_exceptions=False)


BODY = {"prompt": "A red robot beside a blue submarine underwater", "quality_mode": "quick", "resolution": 256, "seed": 3}


def test_model_endpoint_default_and_exact_keys(tmp_path, monkeypatch):
    c = client_for(tmp_path, monkeypatch, None)
    j = c.get("/api/v1/model").json()
    assert set(j) == {"api_version", "model", "model_revision", "loaded", "adapter"}
    assert set(j["adapter"]) >= {"configured", "active", "reason", "adapter_sha256", "adapter_bytes", "base_revision"}
    assert j["adapter"]["configured"] is False and j["loaded"] is False and j["model"] == "stabilityai/sd-turbo"


def test_existing_contracts_are_unchanged(tmp_path, monkeypatch):
    c = client_for(tmp_path, monkeypatch, make_approved(tmp_path))
    assert set(c.get("/api/v1/capabilities").json()) >= {"api_version", "quality_modes", "min_resolution",
                                                          "max_resolution", "generation_available", "deployment_mode"}
    j = c.post("/api/v1/generate", json=BODY).json()
    assert set(j) == {"status", "request_id", "image_url", "generation", "performance", "quality", "resource_decision"}
    assert set(j["generation"]) == {"model", "model_revision", "precision", "scheduler", "steps", "width", "height", "seed"}


def test_generate_reports_adapter_in_revision_and_model_endpoint_agrees(tmp_path, monkeypatch):
    c = client_for(tmp_path, monkeypatch, make_approved(tmp_path))
    j = c.post("/api/v1/generate", json=BODY).json()
    m = c.get("/api/v1/model").json()
    assert m["loaded"] and m["adapter"]["active"]
    assert j["generation"]["model_revision"] == f"{REV}+lora-{m['adapter']['adapter_sha256'][:12]}"


def test_rejected_adapter_still_generates_and_says_why(tmp_path, monkeypatch):
    c = client_for(tmp_path, monkeypatch, make_adapter(tmp_path))  # trained but never approved
    r = c.post("/api/v1/generate", json=BODY)
    assert r.status_code == 200 and r.json()["generation"]["model_revision"] == REV
    a = c.get("/api/v1/model").json()["adapter"]
    assert a["configured"] and not a["active"] and "approved" in a["reason"]


def test_model_endpoint_never_leaks_paths(tmp_path, monkeypatch):
    c = client_for(tmp_path, monkeypatch, make_adapter(tmp_path))
    c.post("/api/v1/generate", json=BODY)
    assert str(tmp_path) not in c.get("/api/v1/model").text


def test_env_adapter_path_is_read(monkeypatch, tmp_path):
    from backend.app.config import load_settings
    monkeypatch.setenv("ADAPTER_PATH", str(tmp_path))
    assert load_settings().adapter_path == tmp_path
    monkeypatch.setenv("ADAPTER_PATH", "  ")
    assert load_settings().adapter_path is None
    monkeypatch.delenv("ADAPTER_PATH")
    assert load_settings().adapter_path is None
