"""Region selection for local editing, built on classical computer vision.

* ``grabcut_mask``  - GrabCut (iterated graph-cut over a Gaussian-mixture colour model) turns a rough box or brush stroke
                      into an object-accurate mask, so "change only the dog" does not need a pixel-perfect selection.
* ``refine_mask``   - morphological close/open (remove speckle, fill pinholes), dilation (cover the object's halo and
                      shadow) and Gaussian feathering (soft edge for blending).
* ``mask_bbox``     - tight bounding box of the selection (drives the crop-and-inpaint strategy).
"""
from __future__ import annotations

import cv2
import numpy as np


def _ensure_u8(mask: np.ndarray) -> np.ndarray:
    m = mask if mask.ndim == 2 else cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    return (m > 127).astype(np.uint8) * 255


def grabcut_mask(
    image_bgr: np.ndarray,
    rect: tuple[int, int, int, int] | None = None,
    stroke_mask: np.ndarray | None = None,
    iterations: int = 5,
    max_side: int = 640,
) -> np.ndarray:
    """Return a uint8 mask (255 = selected object).

    ``rect`` is (x, y, w, h) around the object. ``stroke_mask`` is a rough painted region: its pixels are treated as probable
    foreground and a margin around it as probable background, so the cut snaps to the object boundary inside the stroke.
    GrabCut runs on a downscaled copy (it is O(pixels)) and the mask is upsampled back.
    """
    h, w = image_bgr.shape[:2]
    scale = min(1.0, max_side / max(h, w))
    small = cv2.resize(image_bgr, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA) if scale < 1 else image_bgr
    sh, sw = small.shape[:2]
    gc = np.full((sh, sw), cv2.GC_BGD, np.uint8)
    if stroke_mask is not None:
        st = cv2.resize(_ensure_u8(stroke_mask), (sw, sh), interpolation=cv2.INTER_NEAREST)
        k = max(3, int(0.06 * max(sh, sw)))
        near = cv2.dilate(st, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
        gc[near > 0] = cv2.GC_PR_BGD
        gc[st > 0] = cv2.GC_PR_FGD
        core = cv2.erode(st, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        gc[core > 0] = cv2.GC_FGD
    elif rect is not None:
        x, y, rw, rh = [int(v * scale) for v in rect]
        x, y = max(0, x), max(0, y)
        rw, rh = max(8, min(rw, sw - x)), max(8, min(rh, sh - y))
        gc[y:y + rh, x:x + rw] = cv2.GC_PR_FGD
        # the inner core is very likely object: anchors the foreground model
        cx0, cy0 = x + rw // 4, y + rh // 4
        gc[cy0:y + rh - rh // 4, cx0:x + rw - rw // 4] = cv2.GC_FGD
    else:
        raise ValueError("grabcut_mask needs a rect or a stroke_mask")
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(small, gc, None, bgd, fgd, iterations, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        out = np.zeros((sh, sw), np.uint8)
        out[gc != cv2.GC_BGD] = 255
        return cv2.resize(out, (w, h), interpolation=cv2.INTER_NEAREST)
    out = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    out = _largest_components(out)
    return cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR if scale < 1 else cv2.INTER_NEAREST) if scale < 1 else out


def _largest_components(mask: np.ndarray, keep_frac: float = 0.15) -> np.ndarray:
    """Drop specks: keep connected components at least ``keep_frac`` as large as the biggest one."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), connectivity=8)
    if n <= 1:
        return mask
    areas = stats[1:, cv2.CC_STAT_AREA]
    big = areas.max()
    keep = np.zeros_like(mask)
    for i, a in enumerate(areas, start=1):
        if a >= keep_frac * big:
            keep[lab == i] = 255
    return keep


def refine_mask(mask: np.ndarray, dilate_px: int = 8, feather_px: int = 10, close_px: int = 7) -> np.ndarray:
    """Binary mask -> clean, slightly grown mask. Returns (hard, soft): hard is 0/255 for the diffusion model, soft is the
    feathered alpha (0..255) used to blend the result back."""
    m = _ensure_u8(mask)
    if close_px > 0:
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px, close_px)))
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    if dilate_px > 0:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate_px + 1, 2 * dilate_px + 1)))
    return m


def feather(mask_hard: np.ndarray, feather_px: int = 10) -> np.ndarray:
    if feather_px <= 0:
        return mask_hard
    k = feather_px * 2 + 1
    return cv2.GaussianBlur(mask_hard, (k, k), feather_px / 2.0)


def mask_bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(mask > 127)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1  # x0, y0, x1, y1
