import threading
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.services.engine import DiffusionEngine, EngineResult
from backend.app.services.errors import ServiceError, model_load_failed, out_of_memory


class FakeEngine(DiffusionEngine):
    """Stand-in engine: no torch, no weights. Behaviour is scripted per test."""

    def __init__(self):
        self.available, self.reason = True, ""
        self.loaded = False
        self.load_delay = 0.0
        self.load_error = None  # ServiceError raised on load
        self.gen_error = None  # Exception raised by generate (once if gen_error_once)
        self.gen_error_once = True
        self.gen_delay = 0.0
        self.calls = []
        self.entered = threading.Event()
        self.release = threading.Event()
        self.block = False

    def availability(self):
        return self.available, self.reason

    def ensure_loaded(self):
        if self.loaded:
            return None
        if self.load_error:
            err, self.load_error = self.load_error, None
            raise err
        t0 = time.perf_counter()
        time.sleep(self.load_delay)
        self.loaded = True
        return (time.perf_counter() - t0) * 1000.0

    def generate(self, prompt, seed, width, height, steps):
        self.calls.append(dict(prompt=prompt, seed=seed, width=width, height=height, steps=steps))
        self.entered.set()
        if self.block:
            assert self.release.wait(10)
        time.sleep(self.gen_delay)
        if self.gen_error is not None:
            err = self.gen_error
            if self.gen_error_once:
                self.gen_error = None
            raise err
        return EngineResult(image=Image.new("RGB", (width, height), (200, 30, 30)),
                            model="fake/model", model_revision="rev-test", precision="fp32",
                            scheduler="FakeScheduler", steps=steps, width=width, height=height,
                            seed=seed, peak_gpu_mb=None)


@pytest.fixture
def engine():
    return FakeEngine()


@pytest.fixture
def settings(tmp_path):
    return Settings(output_dir=tmp_path / "out", supported_resolutions=(256, 384, 512), max_stored_images=50)


@pytest.fixture
def client(engine, settings):
    return TestClient(create_app(engine=engine, settings=settings), raise_server_exceptions=False)


GOOD = {"prompt": "A red robot beside a blue submarine underwater",
        "quality_mode": "balanced", "resolution": 512, "seed": 42}


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Tests must not depend on the developer's local .env-style overrides."""
    for k in ("CV_MODE", "ADAPTER_PATH", "ADAPTER_WEIGHT", "ADAPTIVE_PROFILE", "PRECISION", "ATTENTION_SLICING",
              "VAE_SLICING", "OFFLOAD", "MODEL_ID", "MODEL_REVISION"):
        monkeypatch.delenv(k, raising=False)


@pytest.fixture(autouse=True)
def _signed_in(request, monkeypatch):
    """Every /api/v1 route now needs a signed-in user. Tests act as one by default; mark a test
    @pytest.mark.real_auth to exercise the genuine sign-in gate instead."""
    if request.node.get_closest_marker("real_auth"):
        return
    from backend.app import security
    real = security.UserStore.user_for_token
    monkeypatch.setattr(security.UserStore, "user_for_token",
                        lambda self, token: real(self, token) or security.User(1, "test@example.com", "Test", "user"))
