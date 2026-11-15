"""Manga / comic page composition with classical computer vision.

* ``saliency_map``     - gradient-energy + centre-bias saliency; decides where to crop a panel and where NOT to put text.
* ``cover_crop``       - crop an image to a panel's aspect ratio around the salient centroid (not blindly the centre).
* ``halftone``         - amplitude-modulated screentone: gray level -> dot size on a 45 degree grid (the classic manga tone).
* ``manga_tone``       - B/W manga look (CLAHE -> inked lines + screentone + solid blacks) or inked colour.
* ``place_bubble``     - speech/thought/shout/narration balloons placed in the least-salient free spot with a tail aimed at the
                         speaker side; text is wrapped to the balloon width with real font metrics.
* ``compose_page``     - panel layout, gutters, borders, title block and page number -> one finished page.
"""
from __future__ import annotations

import io
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAGE_W, PAGE_H = 1240, 1754  # A-series ratio at 150 dpi
MARGIN, GUTTER = 48, 16

_FONT_CANDIDATES = ["C:/Windows/Fonts/comic.ttf", "C:/Windows/Fonts/comicbd.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans.ttf"]
_BOLD_CANDIDATES = ["C:/Windows/Fonts/comicbd.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in (_BOLD_CANDIDATES if bold else _FONT_CANDIDATES):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


# ------------------------------------------------------------------------------------------------ saliency / crop
def saliency_map(img_bgr: np.ndarray) -> np.ndarray:
    """Float map in [0, 1]. Edge energy (where detail/subjects are) smoothed, with a mild centre prior."""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(g, (0, 0), 1.5)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
    e = cv2.GaussianBlur(cv2.magnitude(gx, gy), (0, 0), max(img_bgr.shape[:2]) / 40)
    h, w = g.shape
    yy, xx = np.mgrid[:h, :w].astype(np.float32)
    centre = np.exp(-(((xx - w / 2) / (0.45 * w)) ** 2 + ((yy - h / 2) / (0.45 * h)) ** 2))
    s = e / (e.max() + 1e-6) * 0.75 + centre * 0.25
    return s / (s.max() + 1e-6)


def cover_crop(img_bgr: np.ndarray, out_w: int, out_h: int) -> np.ndarray:
    h, w = img_bgr.shape[:2]
    target = out_w / out_h
    if w / h > target:                      # too wide: crop columns around the salient x
        cw = int(round(h * target)); ch = h
    else:
        cw = w; ch = int(round(w / target))
    s = saliency_map(img_bgr)
    ys, xs = np.mgrid[:h, :w]
    cx = float((s * xs).sum() / (s.sum() + 1e-6)); cy = float((s * ys).sum() / (s.sum() + 1e-6))
    x0 = int(np.clip(cx - cw / 2, 0, w - cw)); y0 = int(np.clip(cy - ch / 2, 0, h - ch))
    return cv2.resize(img_bgr[y0:y0 + ch, x0:x0 + cw], (out_w, out_h), interpolation=cv2.INTER_AREA if cw > out_w else cv2.INTER_CUBIC)


# ------------------------------------------------------------------------------------------------ manga tone
def halftone(gray: np.ndarray, cell: int = 6, angle_deg: float = 45.0) -> np.ndarray:
    """Return 255 (paper) / 0 (ink) screentone. Dot radius grows as the tone darkens."""
    h, w = gray.shape
    th = math.radians(angle_deg)
    yy, xx = np.mgrid[:h, :w].astype(np.float32)
    u = (xx * math.cos(th) + yy * math.sin(th)) * (2 * math.pi / cell)
    v = (-xx * math.sin(th) + yy * math.cos(th)) * (2 * math.pi / cell)
    pattern = (np.cos(u) + np.cos(v)) / 4.0 + 0.5            # 0..1 periodic threshold, peak at dot centres
    darkness = 1.0 - gray.astype(np.float32) / 255.0
    return np.where(darkness > (1.0 - pattern) * 0.92, 0, 255).astype(np.uint8)


def manga_tone(img_bgr: np.ndarray, mode: str = "bw", cell: int = 6) -> np.ndarray:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    g = cv2.bilateralFilter(gray, 7, 60, 7)
    lines = cv2.adaptiveThreshold(cv2.medianBlur(g, 5), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 7)
    lines = cv2.erode(lines, np.ones((2, 2), np.uint8))
    if mode == "colour":
        q = cv2.bilateralFilter(img_bgr, 9, 75, 9)
        out = cv2.bitwise_and(q, cv2.cvtColor(lines, cv2.COLOR_GRAY2BGR))
        return out
    mid = cv2.min(halftone(cv2.add(g, 20), cell), halftone(cv2.add(g, 60), cell * 2, 15.0))   # two screen densities: lights/mids
    tone = np.where(g < 55, 0, np.where(g > 215, 255, mid)).astype(np.uint8)                   # solid blacks and clean paper whites
    out = cv2.bitwise_and(tone, lines)
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


# ------------------------------------------------------------------------------------------------ text + balloons
def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int) -> list[str]:
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if draw.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur); cur = wd
    if cur:
        lines.append(cur)
    return lines


def _free_spot(sal: np.ndarray, bw: int, bh: int, taken: list[tuple[int, int, int, int]], prefer_top: bool = True):
    """Top-left (x, y) of a bw x bh box with minimum saliency, away from earlier balloons."""
    h, w = sal.shape
    if bw >= w - 32 or bh >= h - 70:
        return 12, 30
    ii = cv2.integral(sal.astype(np.float32))
    best, pos = 1e18, (6, 6)
    for y in range(34, max(35, h - bh - 40), max(8, h // 40)):
        for x in range(16, max(17, w - bw - 16), max(8, w // 40)):
            cost = ii[y + bh, x + bw] - ii[y, x + bw] - ii[y + bh, x] + ii[y, x]
            cost += (y / h) * (0.15 if prefer_top else -0.15) * bw * bh * 0.02
            if any(not (x + bw < tx or tx + tw < x or y + bh < ty or ty + th < y) for tx, ty, tw, th in taken):
                cost += 1e9
            if cost < best:
                best, pos = cost, (x, y)
    return pos


def place_bubble(panel_rgb: Image.Image, sal: np.ndarray, text: str, kind: str = "speech", speaker_side: str = "left",
                 taken: list | None = None, speaker: str | None = None) -> tuple[int, int, int, int]:
    """Draw a balloon onto the panel (PIL RGB, modified in place). Returns its box."""
    taken = taken if taken is not None else []
    if not (text or "").strip():
        return (0, 0, 0, 0)
    d = ImageDraw.Draw(panel_rgb)
    pw, ph = panel_rgb.size
    fs = max(15, int(pw * (0.033 if kind != "narration" else 0.030)))
    f = font(fs, bold=(kind == "shout"))
    max_w = int(pw * (0.46 if kind != "narration" else 0.86))
    lines = wrap(d, text, f, max_w - 28)
    lh = int(fs * 1.22)
    tw = max(d.textlength(l, font=f) for l in lines)
    if kind == "narration":
        bw, bh = int(tw + 30), int(lh * len(lines) + 22)
    else:                      # ovals/stars are narrower than their bounding box at the corners: oversize so text stays inside
        bw, bh = int(tw * 1.32 + 34), int(lh * len(lines) * 1.4 + 28)
    x, y = _free_spot(sal, bw, bh, taken, prefer_top=(kind != "narration" or True))
    if kind == "narration":                                   # caption box anchored at the top/bottom edge
        y = 6 if not any(t[1] < ph * 0.5 for t in taken) else ph - bh - 6
        x = 6
    box = (x, y, bw, bh)
    tag_h = int(fs * 0.9) if speaker else 0
    taken.append((x - 10, y - tag_h - 10, bw + 20, bh + tag_h + 56))   # reserve tag above and tail below
    cx, cy = x + bw / 2, y + bh / 2
    if kind == "narration":
        d.rectangle([x, y, x + bw, y + bh], fill=(255, 247, 214), outline=(20, 20, 20), width=3)
    else:
        if kind == "thought":
            d.ellipse([x, y, x + bw, y + bh], fill="white", outline=(20, 20, 20), width=3)
            for i, r in enumerate((9, 6, 4)):
                tx = cx + (-1 if speaker_side == "left" else 1) * (bw * 0.28 + i * 14)
                ty = y + bh + 6 + i * 12
                d.ellipse([tx - r, ty - r, tx + r, ty + r], fill="white", outline=(20, 20, 20), width=2)
        else:
            if kind == "shout":
                pts, n = [], 18
                for i in range(n * 2):
                    ang = math.pi * i / n
                    rx, ry = (bw / 2 + (10 if i % 2 == 0 else -2)), (bh / 2 + (10 if i % 2 == 0 else -2))
                    pts.append((cx + rx * 1.08 * math.cos(ang), cy + ry * 1.2 * math.sin(ang)))
                d.polygon(pts, fill="white", outline=(20, 20, 20))
            else:
                d.ellipse([x - 6, y - 4, x + bw + 6, y + bh + 4], fill="white", outline=(20, 20, 20), width=3)
            # tail toward the speaker side, towards the lower part of the panel
            sx = cx + (-1 if speaker_side == "left" else 1) * bw * 0.22
            tail = [(sx - 12, y + bh - 2), (sx + 12, y + bh - 2),
                    (sx + (-1 if speaker_side == "left" else 1) * 8, min(ph - 8, y + bh + 34))]
            d.polygon(tail, fill="white", outline=(20, 20, 20))
            d.line([tail[0], tail[1]], fill="white", width=4)
    ty0 = y + (bh - lh * len(lines)) / 2
    for i, l in enumerate(lines):
        d.text((cx - d.textlength(l, font=f) / 2, ty0 + i * lh), l, font=f, fill=(15, 15, 15))
    if speaker and kind in ("speech", "thought", "shout"):
        sf = font(max(11, int(fs * 0.6)), bold=True)
        d.text((x + 8, y - int(fs * 0.7)), speaker.upper(), font=sf, fill=(255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0))
    return box


# ------------------------------------------------------------------------------------------------ layout + page
def layout(n: int, w: int = PAGE_W, h: int = PAGE_H, top: int = 0) -> list[tuple[int, int, int, int]]:
    """Panel rectangles (x, y, w, h) for n panels, with varied manga-style row structures."""
    x0, y0 = MARGIN, MARGIN + top
    aw, ah = w - 2 * MARGIN, h - 2 * MARGIN - top
    rows_by_n = {1: [[1]], 2: [[1], [1]], 3: [[1], [1, 1]], 4: [[1], [1, 1], [1]], 5: [[1, 1], [1], [1, 1]], 6: [[1, 1], [1, 1], [1, 1]],
                 7: [[1, 1], [1], [1, 1], [1, 1]], 8: [[1, 1], [1, 1], [1, 1], [1, 1]]}
    rows = rows_by_n.get(n) or [[1]] * n
    row_weight = {1: 1.0}
    hs = [(1.25 if len(r) == 1 else 1.0) for r in rows]
    total = sum(hs)
    rects, y = [], y0
    two_row = 0
    for r, wt in zip(rows, hs):
        rh = int((ah - GUTTER * (len(rows) - 1)) * wt / total)
        if len(r) == 1:
            rects.append((x0, y, aw, rh))
        else:
            # wide/narrow split, alternating per two-panel row (computed ONCE per row so the cells never overlap)
            share = 0.58 if two_row % 2 == 0 else 0.42
            two_row += 1
            avail = aw - GUTTER * (len(r) - 1)
            if len(r) == 2:
                w0 = int(avail * share)
                rects.append((x0, y, w0, rh))
                rects.append((x0 + w0 + GUTTER, y, avail - w0, rh))
            else:
                cw = avail // len(r)
                for j in range(len(r)):
                    rects.append((x0 + j * (cw + GUTTER), y, cw, rh))
        y += rh + GUTTER
    return rects[:n]


def compose_page(panels: list[dict], title: str = "", page_no: int = 1, mode: str = "colour", seed: int = 0) -> Image.Image:
    """panels: [{image: PIL RGB, narration: str|None, dialogue: [{speaker, text, kind}], sfx: str|None}]"""
    page = Image.new("RGB", (PAGE_W, PAGE_H), (252, 250, 245))
    d = ImageDraw.Draw(page)
    top = 0
    if title:
        tf = font(54, bold=True)
        tw = d.textlength(title, font=tf)
        d.text(((PAGE_W - tw) / 2, MARGIN - 6), title, font=tf, fill=(20, 20, 20))
        top = 70
    for i, (rect, p) in enumerate(zip(layout(len(panels), top=top), panels)):
        x, y, w, h = rect
        bgr = cv2.cvtColor(np.array(p["image"].convert("RGB")), cv2.COLOR_RGB2BGR)
        crop = cover_crop(bgr, w, h)
        sal = saliency_map(crop)
        if mode in ("bw", "manga"):
            crop = manga_tone(crop, "bw")
        elif mode == "ink":
            crop = manga_tone(crop, "colour")
        tile = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        taken: list = []
        if p.get("narration"):
            place_bubble(tile, sal, p["narration"], "narration", taken=taken)
        for k, dl in enumerate(p.get("dialogue") or []):
            place_bubble(tile, sal, dl["text"], dl.get("kind", "speech"), speaker_side="left" if k % 2 == 0 else "right",
                         taken=taken, speaker=dl.get("speaker"))
        if p.get("sfx"):
            sd = ImageDraw.Draw(tile)
            size = int(w * 0.11)
            sf = font(size, bold=True)
            while sd.textlength(p["sfx"], font=sf) > w * 0.6 and size > 18:   # keep the effect inside its panel
                size -= 4; sf = font(size, bold=True)
            # place it where saliency is lowest in the bottom half so it never covers the subject
            sw, sh_ = int(sd.textlength(p["sfx"], font=sf)), size
            sx, sy = _free_spot(sal[int(h * 0.45):], sw, sh_, [(t[0], t[1] - int(h * 0.45), t[2], t[3]) for t in taken], prefer_top=False)
            sd.text((sx, sy + int(h * 0.45)), p["sfx"], font=sf, fill=((255, 255, 255) if mode in ("bw", "manga") else (255, 235, 60)), stroke_width=6, stroke_fill=(10, 10, 10))
        page.paste(tile, (x, y))
        d.rectangle([x, y, x + w, y + h], outline=(15, 15, 15), width=5)
    pf = font(22)
    d.text((PAGE_W / 2 - 8, PAGE_H - MARGIN + 6), str(page_no), font=pf, fill=(60, 60, 60))
    return page


def page_to_png(page: Image.Image) -> bytes:
    b = io.BytesIO()
    page.save(b, format="PNG", optimize=True)
    return b.getvalue()
