"""Deploy all Imagine AI clients behind one Modal GPU backed API.

Routes: / (launched React site), /research-dashboard, /download/android.apk,
and the FastAPI /api/v1 endpoints. See MODAL_DEPLOY_GUIDE.md before deploying.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parent
ADAPTER_DIR = "adapters/coco_sd15_lenbalanced_step2500"
APK = "android/app/build/outputs/apk/debug/app-debug.apk"
MODEL_ID = "stable-diffusion-v1-5/stable-diffusion-v1-5"
MODEL_REVISION = "451f4fe16113bff5a5d2269ed5ad43b0592e9a14"


def _read_dotenv() -> dict[str, str]:
    path = ROOT / ".env"
    values: dict[str, str] = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip("\"'")
    return values


def _host_api_key() -> str:
    key_file = ROOT / ".modal-api-key"
    if key_file.is_file():
        return key_file.read_text(encoding="utf-8").strip()
    key = secrets.token_urlsafe(36)
    key_file.write_text(key, encoding="utf-8")
    return key


def _admin_password() -> str:
    f = ROOT / ".modal-admin-password"
    if f.is_file():
        return f.read_text(encoding="utf-8").strip()
    pw = secrets.token_urlsafe(18)
    f.write_text(pw, encoding="utf-8")
    return pw


env_values = _read_dotenv()
secret_values = {
    "API_KEY": _host_api_key(),
    "MODEL_ID": MODEL_ID,
    "MODEL_REVISION": MODEL_REVISION,
    "DEVICE": "cuda",
    "PRECISION": "fp16",
    "WEIGHTS_VARIANT": "fp16",
    "PRELOAD_MODEL": "false",
    "ADAPTER_PATH": f"/app/{ADAPTER_DIR}",
    "ADAPTER_WEIGHT": "0.25",
    "OUTPUT_DIR": "/vol/images",
    "DATA_DIR": "/tmp/imagineai/data",  # local disk; synced to the persistent volume (SQLite does not belong on a network volume)
    "IMAGINEAI_HOSTED_VARIANTS": "true",
    "IMAGINEAI_ALLOW_DOWNLOAD": "1",  # fetch any model not yet in the cache (e.g. the photo-editing model) on first use
    "COOKIE_SECURE": "1",
    "TRUST_PROXY": "1",
    "ALLOW_SIGNUP": "1",
    "ADMIN_EMAIL": "admin@imagineai.example",
    "ADMIN_PASSWORD": _admin_password(),
}
for name in ("GROQ_API_KEY", "GROQ_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL", "HF_TOKEN"):
    value = os.environ.get(name) or env_values.get(name)
    if value:
        secret_values[name] = value
if not secret_values.get("HF_TOKEN"):
    try:
        from huggingface_hub.constants import HF_TOKEN_PATH

        token_path = Path(HF_TOKEN_PATH)
        if token_path.is_file():
            secret_values["HF_TOKEN"] = token_path.read_text(encoding="utf-8").strip()
    except ImportError:
        pass
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.12"
    )
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install(
        "fastapi>=0.110",
        "pydantic>=2.5",
        "uvicorn>=0.27",
        "httpx>=0.27",
        "pillow>=10",
        "psutil>=5.9",
        "numpy>=1.26",
        "opencv-python-headless>=4.9",
        "torch==2.5.1",
        "torchvision==0.20.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "diffusers==0.35.1",
        "transformers>=4.44,<5",
        "accelerate>=0.30",
        "safetensors>=0.4",
        "peft>=0.11",
        "huggingface_hub>=0.25",
        "google-genai>=1.0",
        "groq>=0.11",
    )
    .add_local_dir(str(ROOT / "backend"), remote_path="/app/backend")
    .add_local_dir(str(ROOT / "ai_engine"), remote_path="/app/ai_engine")
    .add_local_dir(str(ROOT / "computer_vision"), remote_path="/app/computer_vision")
    .add_local_dir(str(ROOT / "frontend" / "dist"), remote_path="/app/frontend/dist")
    .add_local_dir(str(ROOT / ADAPTER_DIR), remote_path=f"/app/{ADAPTER_DIR}")
    .add_local_dir(
        str(ROOT / "evaluation"), remote_path="/app/evaluation",
        ignore=modal.FilePatternMatcher("**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp", "**/*.pt", "**/*.safetensors", "**/__pycache__/**", "**/*.log"),
    )
    .add_local_dir(  # the catalogue pictures the research dashboard shows
        str(ROOT / "evaluation" / "results" / "p7" / "images"), remote_path="/app/evaluation/results/p7/images",
    )
    .add_local_dir(str(ROOT / "adapters" / "lcm_coco_warmstart"), remote_path="/app/adapters/lcm_coco_warmstart")
)
if (ROOT / APK).is_file():
    image = image.add_local_file(str(ROOT / APK), remote_path="/app/android/app-debug.apk")

# Update the existing app in place so its current CPU-only deployment is replaced.
app = modal.App("imagineai-p3")
model_volume = modal.Volume.from_name("imagineai-model-cache", create_if_missing=True)
data_volume = modal.Volume.from_name("imagineai-data", create_if_missing=True)  # accounts, gallery records, generated pictures
MODEL_CACHE_DIR = "/root/.cache/huggingface"
download_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("huggingface_hub>=0.25")
)


@app.function(
    image=download_image,
    volumes={MODEL_CACHE_DIR: model_volume},
    secrets=[modal.Secret.from_dict(secret_values)],
    cpu=4,
    memory=8192,
    timeout=3600,
)
def download_models():
    """Fetch exactly the three checkpoints used by the four model choices."""
    from huggingface_hub import snapshot_download

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError(
            "HF_TOKEN is not configured. The project can still deploy from the "
            "model cache already uploaded to the Modal volume; this helper only "
            "downloads fresh checkpoints from Hugging Face."
        )
    os.environ["HF_HOME"] = MODEL_CACHE_DIR
    snapshot_download("stabilityai/sd-turbo", token=token)
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, token=token)
    snapshot_download("latent-consistency/lcm-lora-sdv1-5", token=token)
    model_volume.commit()


SYNC_SECONDS = 15


def _snapshot(path: Path) -> tuple:
    return tuple(sorted((str(p), p.stat().st_mtime_ns, p.stat().st_size) for p in path.rglob("*") if p.is_file())) if path.exists() else ()


def _push_data(local: Path, remote: Path) -> None:
    """Copy accounts/gallery records to the volume; SQLite files go through the backup API so they are never torn."""
    import shutil
    import sqlite3

    remote.mkdir(parents=True, exist_ok=True)
    for f in local.rglob("*"):
        if not f.is_file() or f.name.endswith(("-wal", "-shm", "-journal")):
            continue
        dest = remote / f.relative_to(local)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if f.suffix == ".db":
            src, dst = sqlite3.connect(f), sqlite3.connect(dest)
            with dst:
                src.backup(dst)
            src.close(); dst.close()
        else:
            shutil.copy2(f, dest)


@app.cls(
    image=image,
    gpu="A10G",
    volumes={MODEL_CACHE_DIR: model_volume, "/vol": data_volume},
    secrets=[modal.Secret.from_dict(secret_values)],
    timeout=900,
    scaledown_window=300,  # stays warm 5 minutes after the last visitor
    max_containers=1,  # one writer for the accounts database
)
@modal.concurrent(max_inputs=16)
class Web:
    @modal.enter()
    def start(self):
        import shutil
        import threading
        import time

        os.chdir("/app")
        os.environ.setdefault("HF_HOME", MODEL_CACHE_DIR)
        sys_path = __import__("sys").path
        if "/app" not in sys_path:
            sys_path.insert(0, "/app")
        self.local = Path(os.environ["DATA_DIR"])
        self.remote = Path("/vol/data")
        data_volume.reload()
        self.local.mkdir(parents=True, exist_ok=True)
        Path("/vol/images").mkdir(parents=True, exist_ok=True)
        if self.remote.is_dir():
            shutil.copytree(self.remote, self.local, dirs_exist_ok=True)  # restore accounts + gallery after a cold start
        self._stop = threading.Event()

        def loop():
            last = _snapshot(self.local), len(list(Path("/vol/images").glob("*")))
            while not self._stop.wait(SYNC_SECONDS):
                now = _snapshot(self.local), len(list(Path("/vol/images").glob("*")))
                if now != last:
                    self.sync()
                    last = now

        self._thread = threading.Thread(target=loop, daemon=True)
        self._thread.start()

    def sync(self):
        try:
            _push_data(self.local, self.remote)
            data_volume.commit()
        except Exception as exc:  # noqa: BLE001
            print("data sync failed:", type(exc).__name__, exc)

    @modal.exit()
    def stop(self):
        self._stop.set()
        self.sync()  # last write on shutdown

    @modal.asgi_app(label="imagineai")
    def web(self):
        from backend.app.main import create_app

        return create_app()
