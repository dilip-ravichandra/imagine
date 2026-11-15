"""ZeroGPU model initialization and inference functions shared with the API."""

from __future__ import annotations

import threading
import logging

import spaces
import torch
from diffusers import AutoPipelineForText2Image, LCMScheduler, StableDiffusionPipeline

from ai_engine.training.adapter import AdapterRejected, LORA_WEIGHT_NAME, load_approved_adapter
from backend.app.config import Settings, load_settings
from backend.app.services.engine import DiffusionEngine, EngineResult

log = logging.getLogger("imagineai.zerogpu")
settings = load_settings()

# ZeroGPU's CUDA emulation allows supported PyTorch models to be initialized on
# CUDA at module load. This keeps weight download/model transfer out of each
# visitor's short GPU lease, per the Spaces ZeroGPU loading guidance.
_sd_turbo = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo", torch_dtype=torch.float16, variant="fp16"
).to("cuda")
_sd15_fp16 = AutoPipelineForText2Image.from_pretrained(
    settings.model_id,
    revision=settings.model_revision,
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")
_sd15_base_scheduler = _sd15_fp16.scheduler
_sd15_fp16.load_lora_weights("latent-consistency/lcm-lora-sdv1-5", adapter_name="lcm")
_approved = load_approved_adapter(settings.adapter_path, settings.model_revision, settings.model_id)
_sd15_fp16.load_lora_weights(
    str(settings.adapter_path), weight_name=LORA_WEIGHT_NAME, adapter_name="coco"
)
_sd15_fp32 = StableDiffusionPipeline.from_pretrained(
    settings.model_id,
    revision=settings.model_revision,
    torch_dtype=torch.float32,
    variant="fp16",
    use_safetensors=True,
).to("cuda")

_generation_lock = threading.Lock()
_ACTIVE_MODEL = ""


def _generate(prompt: str, model_choice: str, resolution: int, seed: int | None, steps: int | None) -> dict:
    global _ACTIVE_MODEL

    models = {
        "sd_turbo": (1, 4),
        "sd15_optimized": (1, 8),
        "sd15_adapted": (1, 30),
        "sd15_baseline": (1, 30),
    }
    if model_choice not in models:
        raise ValueError("Unknown model choice.")
    if resolution not in {256, 384, 512, 640, 768}:
        raise ValueError("Unsupported resolution.")
    low_steps, high_steps = models[model_choice]
    actual_steps = steps or {"sd_turbo": 2, "sd15_optimized": 8,
                             "sd15_adapted": 30, "sd15_baseline": 30}[model_choice]
    if not low_steps <= actual_steps <= high_steps:
        raise ValueError(f"{model_choice} supports {low_steps}–{high_steps} steps.")

    if seed is None or seed < 0:
        seed = int(torch.randint(0, 2**31 - 1, (1,)).item())
    generator = torch.Generator("cpu").manual_seed(int(seed))
    if model_choice == "sd_turbo":
        pipe, guidance, precision = _sd_turbo, 0.0, "fp16"
    elif model_choice == "sd15_optimized":
        pipe = _sd15_fp16
        pipe.set_adapters("lcm", adapter_weights=1.0)
        pipe.scheduler = LCMScheduler.from_config(_sd15_base_scheduler.config)
        guidance, precision = 1.5, "fp16"
    elif model_choice == "sd15_adapted":
        pipe = _sd15_fp16
        pipe.set_adapters("coco", adapter_weights=settings.adapter_weight)
        pipe.scheduler = _sd15_base_scheduler
        guidance, precision = 7.5, "fp16"
    else:
        pipe = _sd15_fp32
        guidance, precision = 7.5, "fp32"

    torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        image = pipe(
            prompt=prompt,
            num_inference_steps=actual_steps,
            guidance_scale=guidance,
            width=int(resolution),
            height=int(resolution),
            generator=generator,
        ).images[0]
    torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - started) * 1000
    _ACTIVE_MODEL = model_choice
    return {
        "image": image,
        "model": ("stabilityai/sd-turbo" if model_choice == "sd_turbo" else settings.model_id),
        "model_choice": model_choice,
        "precision": precision,
        "steps": actual_steps,
        "seed": int(seed),
        "resolution": int(resolution),
        "latency_ms": latency_ms,
        "peak_vram_mb": torch.cuda.max_memory_allocated() / (1024 * 1024),
        "adapter_weight": settings.adapter_weight if model_choice == "sd15_adapted" else None,
        "adapter_sha256": _approved["sha256"] if model_choice == "sd15_adapted" else None,
    }


@spaces.GPU(duration=300)
def generate_on_zerogpu(
    prompt: str,
    model_choice: str = "sd_turbo",
    resolution: int = 512,
    seed: int | None = None,
    steps: int | None = None,
) -> dict:
    """Run a validated model variant on a shared, dynamically allocated GPU."""
    if not prompt or not prompt.strip() or len(prompt) > 500:
        raise ValueError("Prompt must contain between 1 and 500 characters.")
    with _generation_lock:
        return _generate(prompt.strip(), model_choice, int(resolution), seed, steps)


class ZeroGPUEngine(DiffusionEngine):
    """Keep the Imagine AI v1 API contract while leasing ZeroGPU for inference."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def availability(self) -> tuple[bool, str]:
        return True, ""

    def ensure_loaded(self):
        # The module-level ZeroGPU-compatible model initialization is already done.
        return None

    def is_loaded(self) -> bool:
        return bool(_ACTIVE_MODEL)

    def adapter_status(self) -> dict:
        try:
            info = load_approved_adapter(
                self.settings.adapter_path, self.settings.model_revision, self.settings.model_id
            )
            return dict(configured=True, active=_ACTIVE_MODEL == "sd15_adapted",
                        reason="Approved adapter ready for ZeroGPU at weight "
                        f"{self.settings.adapter_weight:g}.",
                        adapter_sha256=info["sha256"], adapter_bytes=info["bytes"],
                        base_revision=info["base_revision"], weight=self.settings.adapter_weight)
        except AdapterRejected as exc:
            return dict(configured=False, active=False, reason=f"Adapter unavailable: {exc}",
                        adapter_sha256=None, adapter_bytes=None, base_revision=None, weight=None)

    def generate(self, prompt: str, seed: int, width: int, height: int, steps: int) -> EngineResult:
        result = generate_on_zerogpu(
            prompt=prompt, model_choice="sd_turbo", resolution=width, seed=seed, steps=steps
        )
        return EngineResult(
            image=result["image"], model=result["model"], model_revision="hub-default",
            precision=result["precision"], scheduler="ZeroGPU Diffusers pipeline",
            steps=result["steps"], width=width, height=height, seed=result["seed"],
            peak_gpu_mb=result["peak_vram_mb"],
        )

