"""Multi-model generation engine supporting:
1. Text-to-Image (SD-Turbo, SD 1.5 variants)
2. Inpainting (Mask-guided selective recreation)
3. Image-to-Image (Reference image conditioning)
"""
import logging
import os
import time
from typing import Optional, Tuple
from PIL import Image, ImageOps

log = logging.getLogger("imagineai.multimodel")

_PIPELINES = {}
_INPAINT_PIPELINES = {}
_IMG2IMG_PIPELINES = {}
_CURRENT_MODEL_ON_GPU = None


def _local_files_only() -> bool:
    """Keep local deployments offline; ZeroGPU Spaces can fetch gated weights at runtime."""
    on = {"1", "true", "yes", "on"}
    if os.getenv("IMAGINEAI_ALLOW_DOWNLOAD", "").strip().lower() in on:  # Docker / fresh laptops: fetch missing weights from the Hugging Face Hub once
        return False
    return os.getenv("HF_SPACE_RUNTIME", "").strip().lower() not in on


def _dtype():
    """fp16 on a GPU; fp32 on CPU (fp16 is unsupported or very slow there)."""
    import torch
    return torch.float16 if torch.cuda.is_available() else torch.float32


def _prec() -> str:
    import torch
    return "fp16" if torch.cuda.is_available() else "fp32"


def _offload_current_if_needed(target_key: str):
    global _CURRENT_MODEL_ON_GPU
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda" and _CURRENT_MODEL_ON_GPU and _CURRENT_MODEL_ON_GPU != target_key:
        for registry in (_PIPELINES, _INPAINT_PIPELINES, _IMG2IMG_PIPELINES):
            if _CURRENT_MODEL_ON_GPU in registry:
                log.info("Offloading previous model '%s' to CPU to free VRAM...", _CURRENT_MODEL_ON_GPU)
                try:
                    val = registry[_CURRENT_MODEL_ON_GPU]
                    pipe = val[0] if isinstance(val, tuple) else val
                    pipe.to("cpu")
                except Exception as e:
                    log.warning("Could not offload %s: %s", _CURRENT_MODEL_ON_GPU, e)
        torch.cuda.empty_cache()
        _CURRENT_MODEL_ON_GPU = None


def imagineai_lcm_path():
    """Path of our distilled LCM-LoRA weights, or None when the adapter is not present in this checkout."""
    from pathlib import Path
    p = Path(__file__).resolve().parents[3] / "adapters" / "lcm_coco_warmstart" / "pytorch_lora_weights.safetensors"
    return p if p.is_file() else None


def get_pipeline(model_choice: str, settings=None):
    global _CURRENT_MODEL_ON_GPU
    import torch
    from diffusers import StableDiffusionPipeline, LCMScheduler, AutoPipelineForText2Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    _offload_current_if_needed(model_choice)

    if model_choice == "sd_turbo":
        if "sd_turbo" not in _PIPELINES:
            log.info("Loading SD-Turbo into memory...")
            pipe = AutoPipelineForText2Image.from_pretrained(
                "stabilityai/sd-turbo",
                torch_dtype=_dtype(),
                variant="fp16",
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            _PIPELINES["sd_turbo"] = pipe
        pipe = _PIPELINES["sd_turbo"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd_turbo"
        return pipe, device, _prec(), 1, 0.0

    elif model_choice == "sd15_optimized":
        if "sd15_optimized" not in _PIPELINES:
            log.info("Loading SD 1.5 Final Optimized (LCM-LoRA + fp16)...")
            pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=_dtype(),
                revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
                use_safetensors=True,
                variant="fp16",
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            pipe.load_lora_weights(
                "latent-consistency/lcm-lora-sdv1-5",
                weight_name="pytorch_lora_weights.safetensors",
                local_files_only=_local_files_only(),
            )
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            _PIPELINES["sd15_optimized"] = pipe
        pipe = _PIPELINES["sd15_optimized"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd15_optimized"
        return pipe, device, _prec(), 4, 1.0

    elif model_choice == "imagineai_lcm":
        # Our own warm-started LCM-LoRA (adapters/lcm_coco_warmstart), benchmark variant D4. Same settings as O4.
        path = imagineai_lcm_path()
        if path is None:
            raise RuntimeError("ImagineAI LCM adapter is not installed (adapters/lcm_coco_warmstart).")
        if "imagineai_lcm" not in _PIPELINES:
            log.info("Loading SD 1.5 + ImagineAI LCM-LoRA (ours, fp16)...")
            pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=_dtype(),
                revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
                use_safetensors=True,
                variant="fp16",
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            pipe.load_lora_weights(str(path.parent), weight_name=path.name)
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            _PIPELINES["imagineai_lcm"] = pipe
        pipe = _PIPELINES["imagineai_lcm"].to(device)
        _CURRENT_MODEL_ON_GPU = "imagineai_lcm"
        return pipe, device, _prec(), 4, 1.0

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
                torch_dtype=_dtype(),
                variant="fp16",
                local_files_only=_local_files_only(),
            )
            pipe.load_lora_weights(info["path"], weight_name=LORA_WEIGHT_NAME)
            pipe.set_adapters("default_0", adapter_weights=settings.adapter_weight)
            _PIPELINES[cache_key] = pipe
        pipe = _PIPELINES[cache_key].to(device)
        _CURRENT_MODEL_ON_GPU = cache_key
        return pipe, device, _prec(), 30, 7.5

    else:  # sd15_baseline
        if "sd15_baseline" not in _PIPELINES:
            log.info("Loading SD 1.5 Baseline (fp32)...")
            pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=torch.float32,
                revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14",
                use_safetensors=True,
                variant="fp16",
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            _PIPELINES["sd15_baseline"] = pipe
        pipe = _PIPELINES["sd15_baseline"].to(device)
        _CURRENT_MODEL_ON_GPU = "sd15_baseline"
        return pipe, device, "fp32", 30, 7.5


def get_inpaint_pipeline(model_choice: str = "sd_turbo", settings=None):
    global _CURRENT_MODEL_ON_GPU
    import torch
    from diffusers import AutoPipelineForInpainting

    device = "cuda" if torch.cuda.is_available() else "cpu"
    cache_key = f"inpaint_{model_choice}"
    _offload_current_if_needed(cache_key)

    if cache_key not in _INPAINT_PIPELINES:
        log.info("Loading inpainting pipeline for %s...", model_choice)
        if "sd15" in model_choice:
            pipe = AutoPipelineForInpainting.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                torch_dtype=_dtype() if device == "cuda" else torch.float32,
                variant="fp16" if device == "cuda" else None,
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            default_steps = 15
            guidance = 7.5
        else:
            pipe = AutoPipelineForInpainting.from_pretrained(
                "stabilityai/sd-turbo",
                torch_dtype=_dtype() if device == "cuda" else torch.float32,
                variant="fp16" if device == "cuda" else None,
                local_files_only=_local_files_only(),
                safety_checker=None
            )
            default_steps = 2
            guidance = 0.0

        _INPAINT_PIPELINES[cache_key] = (pipe, default_steps, guidance)

    pipe, default_steps, guidance = _INPAINT_PIPELINES[cache_key]
    pipe = pipe.to(device)
    _CURRENT_MODEL_ON_GPU = cache_key
    precision = "fp16" if device == "cuda" else "fp32"
    return pipe, device, precision, default_steps, guidance


def get_img2img_pipeline(model_choice: str = "sd_turbo", settings=None):
    global _CURRENT_MODEL_ON_GPU
    import torch
    from diffusers import AutoPipelineForImage2Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    cache_key = f"img2img_{model_choice}"
    _offload_current_if_needed(cache_key)

    if cache_key not in _IMG2IMG_PIPELINES:
        log.info("Loading img2img pipeline for %s...", model_choice)
        pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/sd-turbo",
            torch_dtype=_dtype() if device == "cuda" else torch.float32,
            variant="fp16" if device == "cuda" else None,
            local_files_only=_local_files_only(),
            safety_checker=None
        )
        _IMG2IMG_PIPELINES[cache_key] = (pipe, 2, 0.0)

    pipe, default_steps, guidance = _IMG2IMG_PIPELINES[cache_key]
    pipe = pipe.to(device)
    _CURRENT_MODEL_ON_GPU = cache_key
    precision = "fp16" if device == "cuda" else "fp32"
    return pipe, device, precision, default_steps, guidance


def _align_to_multiple(dim: int, multiple: int = 8) -> int:
    """Ensure dimensions are multiples of 8 for diffusion latent VAEs."""
    return max(multiple, (dim // multiple) * multiple)


def generate_with_model(
    prompt: str,
    model_choice: str = "sd_turbo",
    seed: Optional[int] = None,
    resolution: int = 512,
    custom_steps: Optional[int] = None,
    settings=None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    negative_prompt: Optional[str] = None,
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

    w = _align_to_multiple(width or resolution, 8)
    h = _align_to_multiple(height or resolution, 8)

    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()

    t0 = time.perf_counter()
    extra = {"negative_prompt": negative_prompt} if (negative_prompt and guidance > 1.0) else {}  # CFG<=1 ignores negatives
    image = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        guidance_scale=guidance,
        width=w,
        height=h,
        generator=generator,
        **extra,
    ).images[0]

    if device == "cuda":
        torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - t0) * 1000

    peak_vram = 0.0
    if device == "cuda":
        peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)

    return {
        "image": image,
        "model": "stabilityai/sd-turbo" if model_choice == "sd_turbo" else "stable-diffusion-v1-5/stable-diffusion-v1-5",
        "model_choice": model_choice,
        "precision": precision,
        "steps": steps,
        "seed": seed_val,
        "resolution": resolution,
        "width": w,
        "height": h,
        "latency_ms": latency_ms,
        "peak_vram_mb": peak_vram,
        "adapter_weight": settings.adapter_weight if model_choice == "sd15_adapted" else None,
    }


def inpaint_with_model(
    prompt: str,
    image: Image.Image,
    mask_image: Image.Image,
    model_choice: str = "sd_turbo",
    seed: Optional[int] = None,
    custom_steps: Optional[int] = None,
    settings=None,
    negative_prompt: str = "",
    smart_select: bool = False,
    harmonise: bool = True,
) -> dict:
    global _CURRENT_MODEL_ON_GPU
    import torch
    from . import inpaint_cv
    from .inpaint_cv import inpaint_quality, true_inpaint_available

    if true_inpaint_available():
        _offload_current_if_needed("inpaint_true")
        r = inpaint_quality(prompt, image, mask_image, negative_prompt=negative_prompt, seed=seed, steps=custom_steps or 24,
                            smart_select=smart_select, harmonise=harmonise, local_only=_local_files_only())
        _INPAINT_PIPELINES["inpaint_true"] = (inpaint_cv._PIPE, 24, 7.5)   # lets the VRAM manager offload it when another model is used
        _CURRENT_MODEL_ON_GPU = "inpaint_true"
        return {"image": r["image"], "model": "stable-diffusion-v1-5/stable-diffusion-inpainting", "model_choice": model_choice,
                "precision": "fp16", "steps": r["steps"], "seed": r["seed"], "width": image.size[0], "height": image.size[1],
                "latency_ms": r["latency_ms"], "peak_vram_mb": r["peak_vram_mb"], "method": "crop-inpaint + multiband blend"}

    pipe, device, precision, default_steps, guidance = get_inpaint_pipeline(model_choice, settings)
    steps = custom_steps or default_steps
    seed_val = seed if seed is not None and seed >= 0 else int(torch.randint(0, 2**31 - 1, (1,)).item())
    generator = torch.Generator(device).manual_seed(seed_val)

    # Normalize dimensions: align to multiple of 8
    orig_w, orig_h = image.size
    fit_w = _align_to_multiple(orig_w, 8)
    fit_h = _align_to_multiple(orig_h, 8)

    init_img = image.convert("RGB").resize((fit_w, fit_h), Image.LANCZOS)
    # Binary mask: ensure 0 (black = keep) and 255 (white = edit)
    mask_l = mask_image.convert("L").resize((fit_w, fit_h), Image.NEAREST)

    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()

    t0 = time.perf_counter()
    raw_result = pipe(
        prompt=prompt,
        image=init_img,
        mask_image=mask_l,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    ).images[0]

    # Composite: strictly preserve unmasked areas from original image
    # In Image.composite: where mask is 255 (editable), use raw_result; where 0 (preserved), use init_img
    composited = Image.composite(raw_result, init_img, mask_l)

    # Resize back to exact original user dimensions
    if (fit_w, fit_h) != (orig_w, orig_h):
        final_image = composited.resize((orig_w, orig_h), Image.LANCZOS)
    else:
        final_image = composited

    if device == "cuda":
        torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - t0) * 1000

    peak_vram = 0.0
    if device == "cuda":
        peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)

    return {
        "image": final_image,
        "model": "stabilityai/sd-turbo" if "sd_turbo" in model_choice else "runwayml/stable-diffusion-v1-5",
        "model_choice": model_choice,
        "precision": precision,
        "steps": steps,
        "seed": seed_val,
        "width": orig_w,
        "height": orig_h,
        "latency_ms": latency_ms,
        "peak_vram_mb": peak_vram,
    }


def img2img_with_model(
    prompt: str,
    image: Image.Image,
    model_choice: str = "sd_turbo",
    strength: float = 0.75,
    seed: Optional[int] = None,
    custom_steps: Optional[int] = None,
    settings=None,
) -> dict:
    import torch

    pipe, device, precision, default_steps, guidance = get_img2img_pipeline(model_choice, settings)
    steps = custom_steps or default_steps
    seed_val = seed if seed is not None and seed >= 0 else int(torch.randint(0, 2**31 - 1, (1,)).item())
    generator = torch.Generator(device).manual_seed(seed_val)

    orig_w, orig_h = image.size
    fit_w = _align_to_multiple(orig_w, 8)
    fit_h = _align_to_multiple(orig_h, 8)
    init_img = image.convert("RGB").resize((fit_w, fit_h), Image.LANCZOS)

    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()

    t0 = time.perf_counter()
    result = pipe(
        prompt=prompt,
        image=init_img,
        strength=max(0.1, min(1.0, strength)),
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    ).images[0]

    if (fit_w, fit_h) != (orig_w, orig_h):
        final_image = result.resize((orig_w, orig_h), Image.LANCZOS)
    else:
        final_image = result

    if device == "cuda":
        torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - t0) * 1000

    peak_vram = 0.0
    if device == "cuda":
        peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)

    return {
        "image": final_image,
        "model": "stabilityai/sd-turbo",
        "model_choice": model_choice,
        "precision": precision,
        "steps": steps,
        "seed": seed_val,
        "width": orig_w,
        "height": orig_h,
        "latency_ms": latency_ms,
        "peak_vram_mb": peak_vram,
    }
