"""Region-local image editing: change ONLY the selected area, leave every other pixel untouched.

Pipeline (each step is a classical-CV or diffusion stage):
  1. mask clean-up        morphology (close/open) + dilation so the edit covers the object's halo and shadow
  2. crop-and-inpaint     take a padded square window around the selection and inpaint it at full 512px resolution
                          ("inpaint only masked"), so a small selection is not blurred by a whole-image downscale
  3. diffusion inpainting the dedicated 9-channel stable-diffusion-inpainting UNet (trained for masks, unlike text2img UNets)
  4. colour harmonisation LAB mean/std transfer from the untouched ring around the mask to the new pixels
  5. multiband blend      Laplacian-pyramid composite so there is no visible seam
  6. exact restore        pixels outside the feathered mask are copied back bit-exact from the original

``true_inpaint_available()`` is False until the model weights are downloaded; the caller then falls back to the legacy path.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

log = logging.getLogger(__name__)
REPO_ID = "stable-diffusion-v1-5/stable-diffusion-inpainting"
_PIPE = None


def true_inpaint_available() -> bool:
    """The inpainting UNet weights are present in the local Hugging Face cache (fp16)."""
    import os
    root = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface")) / "hub" / "models--stable-diffusion-v1-5--stable-diffusion-inpainting" / "snapshots"
    if not root.is_dir():
        return False
    return any((s / "unet" / "diffusion_pytorch_model.fp16.safetensors").is_file() and
               (s / "text_encoder").is_dir() and (s / "vae" / "diffusion_pytorch_model.fp16.safetensors").is_file()
               for s in root.iterdir())


def _get_pipe(local_only: bool):
    global _PIPE
    import torch
    from diffusers import DPMSolverMultistepScheduler, StableDiffusionInpaintPipeline
    if _PIPE is None:
        log.info("Loading %s (fp16)...", REPO_ID)
        p = StableDiffusionInpaintPipeline.from_pretrained(REPO_ID, torch_dtype=(torch.float16 if torch.cuda.is_available() else torch.float32), variant="fp16", safety_checker=None,
                                                           local_files_only=local_only)
        p.scheduler = DPMSolverMultistepScheduler.from_config(p.scheduler.config, use_karras_sigmas=True)
        p.set_progress_bar_config(disable=True)
        _PIPE = p
    return _PIPE.to("cuda" if torch.cuda.is_available() else "cpu")


def inpaint_quality(
    prompt: str,
    image: Image.Image,
    mask_image: Image.Image,
    negative_prompt: str = "",
    seed: Optional[int] = None,
    steps: int = 24,
    guidance: float = 7.5,
    smart_select: bool = False,
    feather_px: Optional[int] = None,
    harmonise: bool = True,
    local_only: bool = True,
    offload_hook=None,
) -> dict:
    import cv2
    import torch
    from computer_vision.creative.blend import crop_window, seamless_paste
    from computer_vision.creative.selection import grabcut_mask, mask_bbox, refine_mask

    if offload_hook:
        offload_hook("inpaint_true")
    rgb = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    H, W = bgr.shape[:2]
    user = np.array(mask_image.convert("L").resize((W, H), Image.NEAREST))
    user = (user > 127).astype(np.uint8) * 255
    if user.sum() == 0:
        raise ValueError("The selection is empty. Paint or draw over the part you want to change.")
    if smart_select:  # snap the rough stroke to the object boundary with GrabCut
        snapped = grabcut_mask(bgr, stroke_mask=user)
        if (snapped > 0).sum() > 0.2 * (user > 0).sum():
            user = snapped
    side = max(H, W)
    hard = refine_mask(user, dilate_px=max(3, int(0.010 * side)), close_px=7)
    bbox = mask_bbox(hard)
    wx0, wy0, wx1, wy1 = crop_window(bbox, (W, H), pad_frac=0.55, min_side=256)
    win_bgr, win_mask = bgr[wy0:wy1, wx0:wx1], hard[wy0:wy1, wx0:wx1]
    ww, wh = win_bgr.shape[1], win_bgr.shape[0]

    pipe = _get_pipe(local_only)
    dev = pipe.device.type
    seed_val = seed if seed is not None and seed >= 0 else int(torch.randint(0, 2**31 - 1, (1,)).item())
    gen = torch.Generator(dev).manual_seed(seed_val)
    work = 512
    win_in = Image.fromarray(cv2.cvtColor(cv2.resize(win_bgr, (work, work), interpolation=cv2.INTER_AREA if min(ww, wh) > work else cv2.INTER_CUBIC), cv2.COLOR_BGR2RGB))
    mask_in = Image.fromarray(cv2.resize(win_mask, (work, work), interpolation=cv2.INTER_NEAREST))
    if dev == "cuda":
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.synchronize()
    t0 = time.perf_counter()
    out = pipe(prompt=prompt, negative_prompt=negative_prompt or None, image=win_in, mask_image=mask_in, height=work, width=work,
               num_inference_steps=steps, guidance_scale=guidance, strength=1.0, generator=gen).images[0]
    if dev == "cuda":
        torch.cuda.synchronize()
    latency_ms = (time.perf_counter() - t0) * 1000
    peak = torch.cuda.max_memory_allocated() / 2**20 if dev == "cuda" else 0.0

    out_bgr = cv2.cvtColor(np.array(out), cv2.COLOR_RGB2BGR)
    out_bgr = cv2.resize(out_bgr, (ww, wh), interpolation=cv2.INTER_CUBIC if min(ww, wh) > work else cv2.INTER_AREA)
    fpx = feather_px if feather_px is not None else max(6, int(0.014 * max(ww, wh)))
    merged_win = seamless_paste(win_bgr, out_bgr, win_mask, feather_px=fpx, harmonise=harmonise)
    final = bgr.copy()
    final[wy0:wy1, wx0:wx1] = merged_win
    return dict(image=Image.fromarray(cv2.cvtColor(final, cv2.COLOR_BGR2RGB)), seed=seed_val, steps=steps, latency_ms=latency_ms,
                peak_vram_mb=peak, window=(wx0, wy0, wx1, wy1), mask_area_frac=float((hard > 0).mean()))
