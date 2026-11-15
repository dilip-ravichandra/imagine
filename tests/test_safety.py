"""Safety regression tests (task: safety audit). Nothing here needs torch, a GPU or network."""
import pathlib
import re
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from ai_engine.optimization.benchmark import ClipScorer
from backend.app.config import Settings, load_settings
from backend.app.main import create_app
from tests.conftest import GOOD

ROOT = pathlib.Path(__file__).resolve().parents[1]
KEY = "k3y-for-tests-0123456789"


def _repo_files():
    """Files git would track (tracked + untracked-not-ignored); falls back to a walk if git is unavailable."""
    import subprocess
    try:
        out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True,
                             text=True, check=True).stdout.splitlines()
        return [ROOT / f for f in out if (ROOT / f).is_file()]
    except Exception:
        return [p for p in ROOT.rglob("*") if p.is_file()]



# ---- static file route: no traversal, no listing, no leaking --------------------------------------------------
@pytest.mark.parametrize("path", ["/images/../README.md", "/images/%2e%2e/README.md", "/images/..%2f..%2fREADME.md",
                                  "/images/..%5c..%5cREADME.md", "/images/%2e%2e%2f%2e%2e%2fbackend/app/main.py",
                                  "/images/", "/images", "/images/does-not-exist.png",
                                  "/images/README.md", "/images/backend/app/main.py"])  # real repo files must not be served

def test_images_route_is_not_traversable_or_listable(client, path):
    r = client.get(path, follow_redirects=True)
    assert r.status_code == 404
    assert "Imagine AI" not in r.text and "create_app" not in r.text and "<a href" not in r.text


def test_generated_image_is_served_and_ids_are_unguessable(client):
    r = client.post("/api/v1/generate", json=GOOD)
    assert r.status_code == 200
    url = r.json()["image_url"]
    assert re.fullmatch(r".*/images/[0-9a-f]{32}\.png", url)  # uuid4 hex: 122 random bits
    assert client.get("/images/" + url.rsplit("/", 1)[1]).status_code == 200


# ---- errors never leak internals ------------------------------------------------------------------------------
def test_unhandled_error_hides_paths_and_trace(engine, settings):
    engine.gen_error, engine.gen_error_once = RuntimeError(r"C:\Users\secret\cache\model.safetensors missing"), False
    c = TestClient(create_app(engine=engine, settings=settings), raise_server_exceptions=False)
    r = c.post("/api/v1/generate", json=GOOD)
    assert r.status_code == 500
    assert "secret" not in r.text and "Traceback" not in r.text and "safetensors" not in r.text


@pytest.mark.parametrize("body", [{}, {"prompt": ""}, {"prompt": "x" * 501}, {"prompt": "ok", "resolution": 4096},
                                  {"prompt": "ok", "quality_mode": "ultra"}, {"prompt": "ok", "seed": -1},
                                  {"prompt": "ok", "seed": 2 ** 32}, {"prompt": 5}])
def test_bad_input_is_422_with_safe_body(client, body):
    r = client.post("/api/v1/generate", json=body)
    assert r.status_code == 422 and r.json()["error"]["code"] == "INVALID_REQUEST"
    assert "pydantic" not in r.text.lower() and "loc" not in r.json()["error"]


# ---- optional API key -----------------------------------------------------------------------------------------
@pytest.fixture
def secured(engine, settings):
    return TestClient(create_app(engine=engine, settings=replace(settings, api_key=KEY)), raise_server_exceptions=False)


def test_sign_in_required_by_default_and_no_api_key_configured(client):
    assert Settings().api_key is None
    assert client.post("/api/v1/generate", json=GOOD).status_code == 200  # the test user is signed in


@pytest.mark.real_auth
def test_anonymous_requests_are_refused_by_default(client, engine):
    r = client.post("/api/v1/generate", json=GOOD)
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHENTICATED"
    assert engine.calls == []


@pytest.mark.real_auth
@pytest.mark.parametrize("method,path", [("get", "/api/v1/capabilities"), ("get", "/api/v1/model"),
                                         ("post", "/api/v1/generate"), ("post", "/api/v1/prompt/analysis")])
def test_api_routes_require_key_when_configured(secured, method, path):
    body = GOOD if path.endswith("generate") else {"prompt": "a cat"}
    for headers in ({}, {"X-API-Key": "wrong"}, {"X-API-Key": KEY[:-1]}, {"X-API-Key": KEY + "x"}):
        r = getattr(secured, method)(path, headers=headers, **({"json": body} if method == "post" else {}))
        assert r.status_code == 401, (path, headers)
        e = r.json()
        assert e["status"] == "error" and e["error"]["code"] == "UNAUTHENTICATED" and e["error"]["retryable"] is False
        assert KEY not in r.text
    ok = getattr(secured, method)(path, headers={"X-API-Key": KEY}, **({"json": body} if method == "post" else {}))
    assert ok.status_code == 200


@pytest.mark.real_auth
def test_auth_runs_before_validation_and_generation(secured, engine):
    assert secured.post("/api/v1/generate", json={"prompt": ""}).status_code == 401  # no validation oracle for strangers
    assert secured.post("/api/v1/generate", json=GOOD).status_code == 401
    assert engine.calls == []  # an unauthenticated request never reaches the GPU


@pytest.mark.real_auth
def test_health_stays_open_but_images_need_sign_in(secured):
    assert secured.get("/health").status_code == 200
    assert secured.get("/images/anything.png").status_code == 401
    ok = secured.post("/api/v1/generate", json=GOOD, headers={"X-API-Key": KEY})
    assert secured.get("/images/" + ok.json()["image_url"].rsplit("/", 1)[1], headers={"X-API-Key": KEY}).status_code == 200


def test_api_key_never_in_repr_and_validated(monkeypatch):
    assert KEY not in repr(Settings(api_key=KEY)) and KEY not in str(Settings(api_key=KEY))
    monkeypatch.setenv("API_KEY", "short")
    with pytest.raises(ValueError):
        load_settings()
    monkeypatch.setenv("API_KEY", "  " + KEY + "  ")
    assert load_settings().api_key == KEY
    monkeypatch.setenv("API_KEY", "   ")
    assert load_settings().api_key is None


# ---- model downloads must be pinned ---------------------------------------------------------------------------
def test_clip_scorer_refuses_unpinned_download(monkeypatch):
    monkeypatch.delenv("CLIP_REVISION", raising=False)
    with pytest.raises(ValueError, match="CLIP_REVISION"):
        ClipScorer()  # raises before importing torch/transformers


# ---- repo hygiene guards --------------------------------------------------------------------------------------
def test_dockerfile_runs_unprivileged_and_bakes_no_secrets():
    text = (ROOT / "Dockerfile").read_text()
    users = re.findall(r"^USER\s+(\S+)", text, re.M)
    assert users and users[-1] not in {"root", "0"}
    assert not re.search(r"^(ENV|ARG)\s+\S*(KEY|TOKEN|SECRET|PASSWORD)", text, re.M | re.I)


def test_env_example_has_no_real_secret_values():
    for line in (ROOT / ".env.example").read_text().splitlines():
        m = re.match(r"^#?\s*(API_KEY|HF_TOKEN|TOKEN|SECRET)\s*=\s*(\S+)", line)
        assert not m, f"example env must not contain a value: {line}"


def test_no_secrets_or_weights_committed():
    bad_suffix = {".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".onnx", ".apk", ".aab", ".jks", ".keystore", ".pem"}
    pattern = re.compile(r"(hf_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|"
                         r"-----BEGIN [A-Z ]*PRIVATE KEY)")
    for p in _repo_files():
        if any(part in {"__pycache__", ".pytest_cache", ".git", ".venv", ".gradle", "build"} for part in p.parts):
            continue
        assert p.suffix not in bad_suffix, p
        assert p.name != ".env", p
        if p.suffix in {".py", ".md", ".json", ".txt", ".kts", ".xml", ".toml", ".yml", ".yaml", ".example"} \
                and p.stat().st_size < 2_000_000 and "third_party" not in p.parts and p.name != "test_safety.py":
            assert not pattern.search(p.read_text(errors="ignore")), p
