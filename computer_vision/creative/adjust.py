"""Photo adjustments with classical computer vision (all deterministic, BGR uint8 in/out).

* auto_enhance - gray-world white balance, CLAHE on the L channel, gentle gamma toward mid-grey, mild unsharp mask.
* adjust       - brightness / contrast / saturation / warmth / sharpness / denoise (non-local means), each independent.
* upscale      - Lanczos resampling followed by a detail-layer boost (original - bilateral) limited to avoid halos.
"""
from __future__ import annotations

import cv2
import numpy as np


def _gray_world(img: np.ndarray) -> np.ndarray:
    f = img.astype(np.float32)
    m = f.reshape(-1, 3).mean(0)
    gain = m.mean() / (m + 1e-6)
    return np.clip(f * np.clip(gain, 0.75, 1.35), 0, 255).astype(np.uint8)


def auto_enhance(img: np.ndarray) -> np.ndarray:
    out = _gray_world(img)
    lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8)).apply(l)
    out = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    mean = float(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).mean()) / 255.0
    gamma = float(np.clip(np.log(0.5) / np.log(max(mean, 0.05)), 0.7, 1.4))            # pull the mean toward mid-grey
    lut = np.clip(((np.arange(256) / 255.0) ** (1.0 / gamma)) * 255, 0, 255).astype(np.uint8)
    out = cv2.LUT(out, lut)
    return cv2.addWeighted(out, 1.35, cv2.GaussianBlur(out, (0, 0), 1.4), -0.35, 0)


def adjust(img: np.ndarray, brightness: float = 0, contrast: float = 0, saturation: float = 0, warmth: float = 0,
           sharpness: float = 0, denoise: float = 0, auto: bool = False) -> np.ndarray:
    """All sliders are -100..100 (denoise/sharpness 0..100)."""
    out = auto_enhance(img) if auto else img.copy()
    if denoise > 0:
        h = 2 + 0.12 * float(denoise)
        out = cv2.fastNlMeansDenoisingColored(out, None, h, h, 5, 15)
    f = out.astype(np.float32)
    f = (f - 127.5) * (1.0 + contrast / 100.0) + 127.5 + brightness * 1.6
    if warmth:
        f[..., 2] += warmth * 0.45
        f[..., 0] -= warmth * 0.45
    out = np.clip(f, 0, 255).astype(np.uint8)
    if saturation:
        hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[..., 1] = np.clip(hsv[..., 1] * (1.0 + saturation / 100.0), 0, 255)
        out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    if sharpness > 0:
        amount = 0.9 * float(sharpness) / 100.0
        base = cv2.bilateralFilter(out, 7, 40, 7)                                        # edge-aware base layer: no halos at strong edges
        detail = out.astype(np.float32) - base.astype(np.float32)
        out = np.clip(out.astype(np.float32) + amount * 1.6 * detail, 0, 255).astype(np.uint8)
    return out


def upscale(img: np.ndarray, scale: float = 2.0, max_side: int = 4096) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max(1.0, min(float(scale), max_side / max(h, w)))
    if scale <= 1.0:
        return img
    up = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)
    base = cv2.bilateralFilter(up, 7, 30, 7)
    detail = up.astype(np.float32) - base.astype(np.float32)
    return np.clip(up.astype(np.float32) + 0.8 * detail, 0, 255).astype(np.uint8)
