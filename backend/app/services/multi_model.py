"""Multi-model generation engine supporting:
1. SD-Turbo (ADD Distilled, 2 steps, fp16)
2. SD 1.5 Final Optimized (LCM-LoRA, 8 steps, fp16, LCMScheduler)
3. SD 1.5 Adapted (LCM-LoRA, 30 steps, fp32)
4. SD 1.5 Baseline (Unchanged, 30 steps, fp32)
"""
import time
import uuid
import logging
from typing import Optional
from PIL import Image

log = logging.getLogger("imagineai.multimodel")

_PIPELINES = {}
_CURRENT_MODEL_ON_GPU = None

def get_pipeline(model_choice: str, settings=None):
    global _CURRENT_MODEL_ON_GPU
    import torch
    from diffusers import StableDiffusionPipeline, LCMScheduler, AutoPipelineForText2Image

    device = "cuda" if torch.cuda.is_available() else "cpu"

    if device == "cuda" and _CURRENT_MODEL_ON_GPU and _CURRENT_MODEL_ON_GPU != model_choice:
        if _CURRENT_MODEL_ON_GPU in _PIPELINES:
            log.info("Offloading previous model '%s' to CPU to free VRAM...", _CURRENT_MODEL_ON_GPU)
            _PIPELINES[_CURRENT_MODEL_ON_GPU].to("cpu")
            torch.cuda.empty_cache()
            _CURRENT_MODEL_ON_GPU = None

    if model_choice == "sd_turbo":
        if "sd_turbo" not in _PIPELINES:
            log.info("Loading SD-Turbo into memory...")
            pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sd-turbo",
                torch_dtype=torch.float16,
                variant="fp16",
                local_files_only=True,
                safety_checker=None
            )
            _PIPELINES["sd_turbo"] = pipe
        pipe = _PIPELINES["sd_turbo"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd_turbo"
        return pipe, device, "fp16", 2, 0.0

    elif model_choice == "sd15_optimized":
        if "sd15_optimized" not in _PIPELINES:
            log.info("Loading SD 1.5 Final Optimized (LCM-LoRA + fp16)...")
            pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=torch.float16,
                revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
                use_safetensors=True,
                variant="fp16",
                local_files_only=True,
                safety_checker=None
            )
            pipe.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            _PIPELINES["sd15_optimized"] = pipe
        pipe = _PIPELINES["sd15_optimized"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd15_optimized"
        return pipe, device, "fp16", 8, 1.5

    elif model_choice == "sd15_adapted":
        from ..config import load_settings
        from ai_engine.training.adapter import (AdapterRejected, LORA_WEIGHT_NAME,
                                                load_approved_adapter)

        settings = settings or load_settings()
        try:
            info = load_approved_adapter(settings.adapter_path, settings.model_revision, settings.model_id)
        except AdapterRejected as exc:
            raise RuntimeError("The adapted SD 1.5 model is not approved or configured.") from exc
        cache_key = f"sd15_adapted:{info['sha256']}:{settings.adapter_weight:g}"
        if cache_key not in _PIPELINES:
            log.info("Loading approved SD 1.5 COCO LoRA at weight %s...", settings.adapter_weight)
            pipe = AutoPipelineForText2Image.from_pretrained(
                settings.model_id,
                revision=settings.model_revision,
                torch_dtype=torch.float16,
                variant="fp16",
                local_files_only=True,
            )
            pipe.load_lora_weights(info["path"], weight_name=LORA_WEIGHT_NAME)
            pipe.set_adapters("default_0", adapter_weights=settings.adapter_weight)
            _PIPELINES[cache_key] = pipe
        pipe = _PIPELINES[cache_key].to(device)
        _CURRENT_MODEL_ON_GPU = cache_key
        return pipe, device, "fp16", 30, 7.5

    else:  # sd15_baseline
        if "sd15_baseline" not in _PIPELINES:
            log.info("Loading SD 1.5 Baseline (fp32)...")
            pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=torch.float32,
                revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
                use_safetensors=True,
                variant="fp16",
                local_files_only=True,
                safety_checker=None
            )
            _PIPELINES["sd15_baseline"] = pipe
        pipe = _PIPELINES["sd15_baseline"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd15_baseline"
        return pipe, device, "fp32", 30, 7.5


def generate_with_model(
    prompt: str,
    model_choice: str = "sd_turbo",
    seed: Optional[int] = None,
    resolution: int = 512,
    custom_steps: Optional[int] = None,
    settings=None,
) -> dict:
    import torch

    if model_choice == "sd15_adapted" and settings is None:
        from ..config import load_settings
        settings = load_settings()
    pipe, device, precision, default_steps, guidance = get_pipeline(model_choice, settings)
    steps = custom_steps or default_steps
    seed_val = seed if seed is not None and seed >= 0 else int(torch.randint(0, 2**31 - 1, (1,)).item())
    generator_device = "cpu" if model_choice == "sd15_adapted" else device
    generator = torch.Generator(generator_device).manual_seed(seed_val)

    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()

    t0 = time.perf_counter()
    image = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        guidance_scale=guidance,
        width=resolution,
        height=resolution,
        generator=generator
    ).images[0]

    if device == "cuda":
        torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - t0) * 1000

    peak_vram = 0.0
    if device == "cuda":
        peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)

    return {
        "image": image,
        "model": "stable-diffusion-v1-5/stable-diffusion-v1-5" if "sd15" in model_choice else "stabilityai/sd-turbo",
        "model_choice": model_choice,
        "precision": precision,
        "steps": steps,
        "seed": seed_val,
        "resolution": resolution,
        "latency_ms": latency_ms,
        "peak_vram_mb": peak_vram,
        "adapter_weight": settings.adapter_weight if model_choice == "sd15_adapted" else None,
    }
