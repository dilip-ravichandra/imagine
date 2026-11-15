"""Style system: a diffusion prompt recipe PLUS a classical-CV finisher per style.

A text suffix alone gives weak, inconsistent styles. Each style here has
  * ``positive`` / ``negative`` prompt text (negatives only act on models that use guidance),
  * a CV ``finisher`` that imposes the look deterministically: edge-preserving smoothing + paper texture (watercolour),
    colour quantisation + stroke smoothing (oil), edge/tone separation (ink, comic), LUT grading + grain + vignette (film),
    bloom (neon), CLAHE + unsharp (photoreal).
Finishers take and return BGR uint8 images and are deterministic given a seed (grain/paper noise).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import cv2
import numpy as np


# ------------------------------------------------------------------------------------------------ helpers
def _vignette(img: np.ndarray, strength: float = 0.35) -> np.ndarray:
    h, w = img.shape[:2]
    y, x = np.ogrid[:h, :w]
    d = ((x - w / 2) ** 2 / (w / 2) ** 2 + (y - h / 2) ** 2 / (h / 2) ** 2)
    m = 1 - strength * np.clip(d, 0, 1.4)
    return np.clip(img.astype(np.float32) * m[..., None], 0, 255).astype(np.uint8)


def _grain(img: np.ndarray, amount: float = 8.0, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amount, img.shape[:2]).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), 0.8)
    return np.clip(img.astype(np.float32) + n[..., None], 0, 255).astype(np.uint8)


def _unsharp(img: np.ndarray, amount: float = 0.6, sigma: float = 1.2) -> np.ndarray:
    blur = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blur, -amount, 0)


def _quantise(img: np.ndarray, k: int = 12, seed: int = 0) -> np.ndarray:
    small = cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    data = small.reshape(-1, 3).astype(np.float32)
    cv2.setRNGSeed(seed)
    _, lab, centers = cv2.kmeans(data, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 12, 1.0), 1, cv2.KMEANS_PP_CENTERS)
    q = centers[lab.flatten()].reshape(small.shape).astype(np.uint8)
    return cv2.resize(q, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)


def _paper(shape, seed: int = 0, strength: float = 0.07) -> np.ndarray:
    """Cold-press paper: multi-scale noise used as a height map and multiplied in."""
    rng = np.random.default_rng(seed)
    h, w = shape[:2]
    acc = np.zeros((h, w), np.float32)
    for s, wgt in ((1.0, 0.5), (3.0, 0.3), (9.0, 0.2)):
        n = rng.normal(0, 1, (h, w)).astype(np.float32)
        acc += wgt * cv2.GaussianBlur(n, (0, 0), s)
    acc = (acc - acc.mean()) / (acc.std() + 1e-6)
    return 1.0 + strength * acc


def _lut_grade(img: np.ndarray, shadows_bgr, highlights_bgr, amount: float = 0.35) -> np.ndarray:
    """Split-toning: tint shadows and highlights (e.g. teal / orange)."""
    f = img.astype(np.float32) / 255.0
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None] / 255.0
    sh = np.array(shadows_bgr, np.float32) / 255.0
    hi = np.array(highlights_bgr, np.float32) / 255.0
    tint = (1 - lum) * sh + lum * hi
    out = f * (1 - amount) + (f * 0.5 + tint * 0.5) * amount * 2 * 0.5 + f * amount * 0.5
    return np.clip(out * 255, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------------------------------------ finishers
def photoreal(img: np.ndarray, seed: int = 0) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(l)
    out = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return _grain(_unsharp(out, 0.5), 2.0, seed)


def watercolour(img: np.ndarray, seed: int = 0) -> np.ndarray:
    base = cv2.edgePreservingFilter(img, flags=1, sigma_s=45, sigma_r=0.35)         # flatten washes, keep edges
    base = cv2.bilateralFilter(base, 9, 60, 9)
    hsv = cv2.cvtColor(base, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] *= 0.85                                                               # pigment is lighter than ink
    hsv[..., 2] = np.clip(hsv[..., 2] * 0.9 + 255 * 0.1, 0, 255)                      # wash lifts the darks toward paper white
    wash = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (0, 0), 1.2), 40, 110)
    edges = cv2.GaussianBlur(edges, (0, 0), 0.8)
    dark = (255 - edges).astype(np.float32) / 255.0
    out = wash.astype(np.float32) * (0.82 + 0.18 * dark[..., None])                   # faint pencil/pigment pooling at edges
    out *= _paper(img.shape, seed)[..., None]
    pigment_bleed = cv2.GaussianBlur(out, (0, 0), 2.0) * 0.25 + out * 0.75
    return np.clip(pigment_bleed, 0, 255).astype(np.uint8)


def oil_painting(img: np.ndarray, seed: int = 0) -> np.ndarray:
    sm = cv2.stylization(img, sigma_s=40, sigma_r=0.35)
    q = _quantise(cv2.bilateralFilter(sm, 9, 75, 9), k=16, seed=seed)
    mixed = cv2.addWeighted(sm, 0.55, q, 0.45, 0)
    # impasto: directional brush texture from a blurred noise field used as a relief map
    rng = np.random.default_rng(seed)
    n = cv2.GaussianBlur(rng.normal(0, 1, img.shape[:2]).astype(np.float32), (0, 0), 2.2)
    relief = cv2.Sobel(n, cv2.CV_32F, 1, 1, ksize=3)
    relief = relief / (np.abs(relief).max() + 1e-6)
    out = mixed.astype(np.float32) * (1.0 + 0.10 * relief[..., None])
    return _unsharp(np.clip(out, 0, 255).astype(np.uint8), 0.3)


def pencil_sketch(img: np.ndarray, seed: int = 0) -> np.ndarray:
    """Colour-dodge pencil: gray / (255 - blur(255 - gray)) keeps contours, plus soft graphite shading from the tone map."""
    gray = cv2.cvtColor(cv2.bilateralFilter(img, 7, 50, 7), cv2.COLOR_BGR2GRAY)
    inv_blur = cv2.GaussianBlur(255 - gray, (0, 0), 7)
    line = cv2.divide(gray, 255 - inv_blur, scale=256).astype(np.float32)
    shade = 255 - (255 - gray.astype(np.float32)) * 0.45                                  # light tonal shading under the lines
    out = np.minimum(line, shade) * 0.8 + line * 0.2
    out = np.clip((out - 40) * 1.18, 0, 255)                                              # contrast curve: strong pencil darks
    out = np.clip(out * _paper(img.shape, seed, 0.05), 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def ink_comic(img: np.ndarray, seed: int = 0) -> np.ndarray:
    smooth = cv2.bilateralFilter(img, 9, 80, 9)
    flat = _quantise(smooth, k=9, seed=seed)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.medianBlur(gray, 5)
    lines = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 6)
    lines = cv2.erode(lines, np.ones((2, 2), np.uint8))
    hsv = cv2.cvtColor(flat, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.25, 0, 255)
    col = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return cv2.bitwise_and(col, cv2.cvtColor(lines, cv2.COLOR_GRAY2BGR))


def anime_cel(img: np.ndarray, seed: int = 0) -> np.ndarray:
    smooth = cv2.edgePreservingFilter(img, flags=1, sigma_s=30, sigma_r=0.3)
    q = _quantise(smooth, k=14, seed=seed)
    gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (0, 0), 1.0), 50, 130)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8))
    out = q.copy()
    out[edges > 0] = (out[edges > 0] * 0.25).astype(np.uint8)
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.2, 0, 255); hsv[..., 2] = np.clip(hsv[..., 2] * 1.05, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def vintage_film(img: np.ndarray, seed: int = 0) -> np.ndarray:
    f = img.astype(np.float32) / 255.0
    f = np.clip((f - 0.5) * 0.88 + 0.5 + 0.04, 0, 1)                                   # faded blacks
    b, g, r = cv2.split(f)
    r = np.clip(r * 1.06 + 0.02, 0, 1); b = np.clip(b * 0.9, 0, 1)                      # warm cast
    out = cv2.merge([b, g, r])
    out = _vignette((out * 255).astype(np.uint8), 0.45)
    return _grain(out, 9.0, seed)


def cinematic(img: np.ndarray, seed: int = 0) -> np.ndarray:
    out = _lut_grade(img, shadows_bgr=(150, 120, 20), highlights_bgr=(60, 140, 235), amount=0.45)  # teal shadows / orange lights
    out = _vignette(out, 0.3)
    glow = cv2.GaussianBlur(out, (0, 0), 14)
    out = cv2.addWeighted(out, 0.88, glow, 0.2, 0)
    h = out.shape[0]
    bar = int(h * 0.07)
    out[:bar] = 0; out[-bar:] = 0                                                       # letterbox
    return _grain(out, 3.0, seed)


def neon_cyberpunk(img: np.ndarray, seed: int = 0) -> np.ndarray:
    f = img.astype(np.float32)
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None] / 255.0
    magenta, cyan = np.array([200, 40, 255], np.float32), np.array([255, 220, 30], np.float32)   # BGR
    tint = (1 - lum) * magenta * 0.35 + lum * cyan * 0.30                                           # magenta shadows, cyan highs
    out = np.clip(f * 0.75 + tint, 0, 255).astype(np.uint8)
    hsv = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.5, 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    bright = np.where(cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)[..., None] > 150, out, 0).astype(np.float32)
    bloom = cv2.GaussianBlur(bright, (0, 0), 14)
    out = np.clip(out.astype(np.float32) * 0.9 + 1.1 * bloom, 0, 255).astype(np.uint8)
    return _vignette(out, 0.35)


def pixel_art(img: np.ndarray, seed: int = 0, block: int = 8) -> np.ndarray:
    """Downsample with area averaging, quantise to a small palette (k-means), upscale with nearest neighbour."""
    h, w = img.shape[:2]
    small = cv2.resize(cv2.bilateralFilter(img, 7, 60, 7), (max(8, w // block), max(8, h // block)), interpolation=cv2.INTER_AREA)
    data = small.reshape(-1, 3).astype(np.float32)
    cv2.setRNGSeed(seed)
    _, lab, centers = cv2.kmeans(data, 20, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 1.0), 2, cv2.KMEANS_PP_CENTERS)
    q = centers[lab.flatten()].reshape(small.shape).astype(np.uint8)
    hsv = cv2.cvtColor(q, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.15, 0, 255)
    q = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    return cv2.resize(q, (w, h), interpolation=cv2.INTER_NEAREST)


def identity(img: np.ndarray, seed: int = 0) -> np.ndarray:
    return img


# ------------------------------------------------------------------------------------------------ registry
@dataclass(frozen=True)
class Style:
    id: str
    label: str
    positive: str
    negative: str
    finisher: Callable[[np.ndarray, int], np.ndarray]
    finisher_strength: float = 1.0       # 0 = diffusion only, 1 = full CV finisher
    description: str = ""


COMMON_NEG = "lowres, blurry, deformed, disfigured, bad anatomy, extra limbs, watermark, text, signature, jpeg artifacts"

STYLES: dict[str, Style] = {s.id: s for s in [
    Style("photorealistic", "Photorealistic", "photorealistic, 85mm lens, natural lighting, high detail, sharp focus, realistic textures",
          COMMON_NEG + ", cartoon, painting, illustration", photoreal, 1.0, "Natural photo look with local contrast and fine grain."),
    Style("watercolor", "Watercolor", "watercolor painting, soft translucent washes, wet-on-wet bleeding pigment, visible paper texture, delicate brush strokes, white paper margins",
          COMMON_NEG + ", photo, 3d render, harsh black outlines", watercolour, 0.9, "Pigment washes with paper grain and edge pooling."),
    Style("oil", "Oil painting", "oil painting on canvas, thick impasto brush strokes, rich color, painterly, museum quality",
          COMMON_NEG + ", photo, flat shading", oil_painting, 0.85, "Colour-quantised brushwork with relief texture."),
    Style("pencil", "Pencil sketch", "detailed graphite pencil sketch, cross hatching, soft shading, sketchbook paper",
          COMMON_NEG + ", color, photo, painting", pencil_sketch, 1.0, "Graphite line and shade on paper."),
    Style("ink", "Ink & comic", "comic book illustration, bold ink outlines, flat colors, dramatic composition",
          COMMON_NEG + ", photo, blurry", ink_comic, 0.9, "Posterised colour with inked outlines."),
    Style("anime", "Anime", "anime style illustration, clean line art, cel shading, vibrant colors, studio quality",
          COMMON_NEG + ", photo, 3d, realistic", anime_cel, 0.8, "Cel-shaded colour with outlines."),
    Style("cinematic", "Cinematic", "cinematic film still, dramatic lighting, shallow depth of field, anamorphic, color graded",
          COMMON_NEG + ", flat lighting, cartoon", cinematic, 1.0, "Teal/orange grade, bloom and letterbox."),
    Style("vintage", "Vintage film", "vintage 1970s film photograph, faded colors, soft focus, film grain",
          COMMON_NEG + ", digital, oversharpened", vintage_film, 1.0, "Faded blacks, warm cast, vignette and grain."),
    Style("neon", "Neon cyberpunk", "cyberpunk neon city, glowing lights, wet streets, vivid magenta and cyan, futuristic",
          COMMON_NEG + ", daylight, muted", neon_cyberpunk, 1.0, "Saturated bloom with magenta/cyan split-tone."),
    Style("pixel", "Retro pixel", "retro pixel art, 16-bit video game sprite, crisp pixels, limited color palette, readable silhouette",
          COMMON_NEG + ", photo, smooth gradients, blurry", pixel_art, 1.0, "Palette-quantised pixel blocks."),
    Style("fantasy", "Fantasy art", "epic fantasy concept art, magical atmosphere, intricate detail, volumetric light, painterly",
          COMMON_NEG + ", photo, modern", identity, 0.0, "Diffusion-only look."),
]}
ALIASES = {"cinematic 3d": "cinematic", "anime & manga": "anime", "manga": "anime", "comic book": "ink", "retro pixel": "pixel", "pixel art": "pixel", "photo realistic": "photorealistic", "realistic": "photorealistic", "water color": "watercolor", "watercolour": "watercolor",
           "oil painting": "oil", "pencil sketch": "pencil", "comic": "ink", "ink & comic": "ink", "cyberpunk": "neon",
           "vintage film": "vintage", "fantasy art": "fantasy", "3d": "fantasy", "3d render": "fantasy"}


def resolve_style(name: str | None) -> Style:
    key = (name or "photorealistic").strip().lower()
    key = ALIASES.get(key, key)
    return STYLES.get(key) or STYLES["photorealistic"]


def apply_style(img_bgr: np.ndarray, name: str | None, seed: int = 0) -> np.ndarray:
    st = resolve_style(name)
    if st.finisher_strength <= 0:
        return img_bgr
    out = st.finisher(img_bgr, seed)
    if st.finisher_strength >= 1.0:
        return out
    return cv2.addWeighted(img_bgr, 1 - st.finisher_strength, out, st.finisher_strength, 0)


def compose_prompt(prompt: str, name: str | None, max_len: int = 450) -> tuple[str, str]:
    st = resolve_style(name)
    pos = f"{prompt.strip().rstrip(',')}, {st.positive}"
    if len(pos) > max_len:
        keep = max_len - len(st.positive) - 2
        pos = f"{prompt.strip()[:max(10, keep)].rstrip(', ')}, {st.positive}"
    return pos, st.negative
