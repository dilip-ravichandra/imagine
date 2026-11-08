"""
ImagineAI — Modal Labs Deployment Script
=========================================
Deploys the full FastAPI backend with SD‑Turbo on a Modal A10G GPU.

Setup (run once):
    pip install "modal==0.71.0"
    modal token new          # authenticate with your Modal account

Deploy:
    modal deploy modal_deploy_fixed.py

The public URL printed after deploy is the base URL for:
  - Web Dashboard : https://<your-app>.modal.run/
  - API Docs      : https://<your-app>.modal.run/docs
  - Android Client: set SERVER_URL = "https://<your-app>.modal.run"
"""

import modal

# ---------------------------------------------------------------------------
# 1. Container Image
#    Build a CUDA‑based image with all required system and Python deps.
# ---------------------------------------------------------------------------
cuda_version = "12.4.0"
flavor = "devel"
os_ver = "ubuntu22.04"
tag = f"{cuda_version}-{flavor}-{os_ver}"

imagine_image = (
    modal.Image.from_registry(f"nvidia/cuda:{tag}", add_python="3.12")
    # System packages
    .apt_install("git", "libgl1", "libglib2.0-0")
    # Base Python deps
    .pip_install(
        "fastapi>0.110",
        "pydantic>2.5",
        "uvicorn>0.27",
        "httpx>0.27",
        "pillow>10.0",
        "psutil>5.9",
        "numpy>1.26",
        "opencv-python-headless>4.9",
        "matplotlib>3.8",
    )
    # GPU‑related deps
    .pip_install(
        "torch>2.3",
        "torchvision>0.18",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "diffusers>0.30",
        "transformers>4.40",
        "accelerate>0.30",
        "safetensors>0.4",
        "peft>0.11",
    )
    # Add the project source (exclude large local artifacts)
    .add_local_dir(
        ".",
        remote_path="/app",
        ignore=[
            ".venv",
            "__pycache__",
            ".git",
            ".pytest_cache",
            "*.pyc",
        ],
    )
)

# ---------------------------------------------------------------------------
# 2. Modal App & GPU Config
# ---------------------------------------------------------------------------
app = modal.App("imagineai-p3", image=imagine_image)

# Persistent volume for HuggingFace model cache (~7 GB)
model_volume = modal.Volume.from_name(
    "imagineai-model-cache", create_if_missing=True
)
MODEL_CACHE_DIR = "/root/.cache/huggingface"

# ---------------------------------------------------------------------------
# 3. Model pre‑download (runs once, stored in the volume)
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    volumes={MODEL_CACHE_DIR: model_volume},
    timeout=1800,                     # 30 min for first‑time downloads
    secrets=[modal.Secret.from_name("imagineai-secrets")],
)
def download_models():
    """Cache SD‑Turbo, SD‑1.5 and LCM‑LoRA weights in the persistent volume."""
    from diffusers import (
        AutoPipelineForText2Image,
        StableDiffusionPipeline,
        DiffusionPipeline,
    )
    import torch

    print("Downloading SD‑Turbo (fp16)…")
    AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sd-turbo", torch_dtype=torch.float16, variant="fp16"
    )

    print("Downloading SD 1.5 (fp32)…")
    StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float32
    )

    print("Downloading LCM‑LoRA weights…")
    StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16
    )
    pipe = DiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16
    )
    pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")

    model_volume.commit()
    print("All model weights cached to volume.")

# ---------------------------------------------------------------------------
# 4. ASGI FastAPI app (served as a Modal web endpoint)
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    volumes={MODEL_CACHE_DIR: model_volume},
    timeout=300,
    secrets=[modal.Secret.from_name("imagineai-secrets")],
)
@modal.asgi_app()
def fastapi_app():
    """Entry point that returns the ImagineAI FastAPI application."""
    import sys
    import os

    # Ensure the repository root is on the Python path
    sys.path.insert(0, "/app")

    # Point HuggingFace caches to the persistent volume
    os.environ.setdefault("HF_HOME", MODEL_CACHE_DIR)
    os.environ.setdefault("HF_DATASETS_CACHE", MODEL_CACHE_DIR)
    os.environ.setdefault(
        "MODEL_REVISION", "b261bac6fd2cf515557d5d0707481eafa0485ec2"
    )
    os.environ.setdefault("PRELOAD_MODEL", "true")

    from backend.app.main import create_app

    return create_app()

# ---------------------------------------------------------------------------
# 5. Local entrypoint — run with: modal run modal_deploy_fixed.py
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    """Pre‑download models then instruct the user to deploy the endpoint."""
    print("Pre‑downloading models into Modal volume…")
    download_models.remote()
    print("\nDone! Deploy the service with:\n  modal deploy modal_deploy_fixed.py")
