"""Seamless compositing of an edited region back into the original photo.

Diffusion inpainting alone leaves visible seams: a slight colour/brightness shift and a hard edge at the mask border. We
fix that with classical CV:

* ``crop_window``     - choose a padded square window around the selection so the model works at full resolution on a small
                        region ("inpaint only masked") instead of a 512px downscale of the whole picture.
* ``match_colour``    - LAB mean/std transfer (Reinhard et al.) from the untouched ring around the mask to the new pixels.
* ``blend_laplacian`` - multiband (Laplacian-pyramid) blend: low frequencies cross-fade over a wide band, fine detail over a
                        narrow band, which hides seams without ghosting.
* ``seamless_paste``  - the full recipe (colour match -> multiband blend), guaranteeing pixels outside the mask are bit-exact.
"""
from __future__ import annotations

import cv2
import numpy as np


def crop_window(bbox: tuple[int, int, int, int], img_wh: tuple[int, int], pad_frac: float = 0.5, min_side: int = 192) -> tuple[int, int, int, int]:
    """Square window (x0, y0, x1, y1) around ``bbox`` with context padding, clamped to the image."""
    x0, y0, x1, y1 = bbox
    W, H = img_wh
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0)
    side = int(max(min_side, side * (1 + 2 * pad_frac)))
    side = min(side, max(W, H))
    side = min(side, min(W, H)) if min(W, H) >= min_side else side
    x0n = int(round(cx - side / 2)); y0n = int(round(cy - side / 2))
    x0n = max(0, min(x0n, W - side)); y0n = max(0, min(y0n, H - side))
    return x0n, y0n, min(W, x0n + side), min(H, y0n + side)


def match_colour(edit_bgr: np.ndarray, ref_bgr: np.ndarray, mask_soft: np.ndarray, ring_px: int = 24) -> np.ndarray:
    """Shift the edited pixels' LAB statistics toward the ring of original pixels just outside the mask (Reinhard transfer)."""
    m = (mask_soft > 127).astype(np.uint8)
    if m.sum() < 16:
        return edit_bgr
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ring_px + 1, 2 * ring_px + 1))
    ring = cv2.dilate(m, k) - m
    if ring.sum() < 64:
        return edit_bgr
    e = cv2.cvtColor(edit_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    out = e.copy()
    for c in range(3):
        em, es = e[..., c][m > 0].mean(), e[..., c][m > 0].std() + 1e-6
        rm, rs = r[..., c][ring > 0].mean(), r[..., c][ring > 0].std() + 1e-6
        # moderate the transfer: keep the edit's own contrast (the new object may legitimately differ from the surroundings)
        gain = np.clip(rs / es, 0.75, 1.33) if c == 0 else 1.0
        out[..., c] = np.where(m > 0, (e[..., c] - em) * gain + (0.6 * rm + 0.4 * em), e[..., c])
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def _gauss_pyr(img: np.ndarray, levels: int) -> list[np.ndarray]:
    p = [img]
    for _ in range(levels):
        p.append(cv2.pyrDown(p[-1]))
    return p


def blend_laplacian(a_bgr: np.ndarray, b_bgr: np.ndarray, alpha: np.ndarray, levels: int = 4) -> np.ndarray:
    """Multiband blend of ``b`` over ``a`` with per-pixel ``alpha`` in [0, 1]."""
    h, w = a_bgr.shape[:2]
    levels = int(min(levels, np.floor(np.log2(min(h, w))) - 2))
    if levels < 1:
        al = alpha[..., None]
        return np.clip(a_bgr * (1 - al) + b_bgr * al, 0, 255).astype(np.uint8)
    ga, gb = _gauss_pyr(a_bgr.astype(np.float32), levels), _gauss_pyr(b_bgr.astype(np.float32), levels)
    gm = _gauss_pyr(alpha.astype(np.float32), levels)
    out = None
    for i in range(levels, -1, -1):
        if i == levels:
            cur = ga[i] * (1 - gm[i][..., None]) + gb[i] * gm[i][..., None]
            out = cur
        else:
            la = ga[i] - cv2.pyrUp(ga[i + 1], dstsize=(ga[i].shape[1], ga[i].shape[0]))
            lb = gb[i] - cv2.pyrUp(gb[i + 1], dstsize=(gb[i].shape[1], gb[i].shape[0]))
            lap = la * (1 - gm[i][..., None]) + lb * gm[i][..., None]
            out = cv2.pyrUp(out, dstsize=(gb[i].shape[1], gb[i].shape[0])) + lap
    return np.clip(out, 0, 255).astype(np.uint8)


def seamless_paste(original_bgr: np.ndarray, edited_bgr: np.ndarray, mask_hard: np.ndarray, feather_px: int = 12, harmonise: bool = True) -> np.ndarray:
    """Composite ``edited`` into ``original`` inside ``mask``. Outside the (feathered) mask the original is returned unchanged."""
    from .selection import feather
    soft = feather(mask_hard, feather_px)
    edit = match_colour(edited_bgr, original_bgr, mask_hard) if harmonise else edited_bgr
    alpha = (soft.astype(np.float32) / 255.0)
    out = blend_laplacian(original_bgr, edit, alpha)
    # hard guarantee: untouched region is exactly the original
    outside = soft == 0
    out[outside] = original_bgr[outside]
    return out
