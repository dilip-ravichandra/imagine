"""Measured, explainable image statistics (classical CV) shown to users instead of canned captions.

* sharpness    variance of the Laplacian (low = soft/blurred)
* brightness   mean luma; contrast = luma standard deviation
* colourfulness  Hasler & Suesstrunk (2003) metric on the opponent channels rg and yb
* noise        Immerkaer fast noise estimate
* palette      k-means (k=5) dominant colours with their share of the image
"""
from __future__ import annotations

import cv2
import numpy as np


def _label(v: float, cuts: list[float], names: list[str]) -> str:
    for c, n in zip(cuts, names):
        if v < c:
            return n
    return names[-1]


def analyze(img_bgr: np.ndarray) -> dict:
    h, w = img_bgr.shape[:2]
    small = cv2.resize(img_bgr, (256, int(256 * h / w)) if w >= h else (int(256 * w / h), 256), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    bright = float(gray.mean())
    contrast = float(gray.std())
    b, g, r = [c.astype(np.float32) for c in cv2.split(small)]
    rg, yb = r - g, 0.5 * (r + g) - b
    colourful = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float64)
    gh, gw = gray.shape
    noise = float(np.sqrt(np.pi / 2) * np.abs(cv2.filter2D(gray.astype(np.float64), -1, k)[1:-1, 1:-1]).sum() / (6 * (gw - 2) * (gh - 2)))
    data = small.reshape(-1, 3).astype(np.float32)
    cv2.setRNGSeed(0)
    _, lab, centers = cv2.kmeans(data, 5, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0), 2, cv2.KMEANS_PP_CENTERS)
    shares = np.bincount(lab.flatten(), minlength=5) / len(lab)
    order = np.argsort(-shares)
    palette = [{"hex": "#%02X%02X%02X" % tuple(int(x) for x in centers[i][::-1]), "share": round(float(shares[i]), 3)} for i in order]
    return {
        "width": w, "height": h,
        "sharpness": {"value": round(sharp, 1), "label": _label(sharp, [30, 150, 600], ["Soft", "Fairly sharp", "Sharp", "Very crisp"])},
        "brightness": {"value": round(bright, 1), "label": _label(bright, [70, 115, 175], ["Dark", "Moody", "Balanced", "Bright"])},
        "contrast": {"value": round(contrast, 1), "label": _label(contrast, [35, 65], ["Flat", "Good", "Punchy"])},
        "colourfulness": {"value": round(colourful, 1), "label": _label(colourful, [20, 45, 75], ["Muted", "Natural", "Vivid", "Very vivid"])},
        "noise": {"value": round(noise, 2), "label": _label(noise, [2.0, 5.0], ["Clean", "Slightly grainy", "Grainy"])},
        "palette": palette,
    }
