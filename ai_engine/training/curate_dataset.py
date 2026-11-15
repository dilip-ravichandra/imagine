"""Curate the COCO training split with classical computer vision + CLIP before distillation.

Per image we measure:
  sharpness   variance of the Laplacian on luma            (blur)
  noise       Immerkaer fast noise-sigma estimate          (sensor / compression noise)
  contrast    std of luma                                  (flat / foggy images)
  exposure    share of crushed (<5) or blown (>250) luma   (clipping)
  alignment   CLIP ViT-B/32 image-text cosine similarity   (caption does not describe the image)
  duplicate   64-bit DCT perceptual hash, Hamming <= 4     (near-duplicates over-weight a scene)
Images failing hard thresholds are dropped; the remainder is ranked by a composite z-score and the top `--keep` share is kept.
Writes a new dataset directory with the same layout as the source (train/metadata.jsonl, manifest.json, wds tar) and a
per-image score table, so the effect of curation is auditable and can be ablated against the unfiltered split.

    python -m ai_engine.training.curate_dataset --keep 0.7
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
from pathlib import Path

import cv2
import numpy as np

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "training_data" / "coco_sd15_lenbalanced"
DST = REPO / "training_data" / "coco_sd15_curated"


def sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def noise_sigma(gray: np.ndarray) -> float:
    """Immerkaer (1996): convolve with a Laplacian-difference mask, mean absolute response -> sigma."""
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], dtype=np.float64)
    h, w = gray.shape
    r = cv2.filter2D(gray.astype(np.float64), -1, k)[1:-1, 1:-1]
    return float(np.sqrt(np.pi / 2) * np.abs(r).sum() / (6 * (w - 2) * (h - 2)))


def exposure_clip(gray: np.ndarray) -> float:
    return float(((gray < 5) | (gray > 250)).mean())


def phash(gray: np.ndarray) -> int:
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    d = cv2.dct(small)[:8, :8]
    med = np.median(d[1:].ravel())
    bits = (d > med).ravel()
    return int("".join("1" if b else "0" for b in bits), 2)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def measure(rows: list[dict], images: Path) -> list[dict]:
    out = []
    for r in rows:
        img = cv2.imread(str(images / r["file_name"]))
        if img is None:
            continue
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        g = cv2.resize(g, (512, int(512 * g.shape[0] / g.shape[1]))) if g.shape[1] > 512 else g
        out.append(dict(**r, sharp=sharpness(g), noise=noise_sigma(g), contrast=float(g.std()), clip=exposure_clip(g),
                        hash=phash(g)))
    return out


def clip_alignment(rows: list[dict], images: Path) -> None:
    import torch
    from PIL import Image
    from transformers import CLIPModel, CLIPProcessor
    m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to("cuda").eval()
    p = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    for i in range(0, len(rows), 32):
        b = rows[i:i + 32]
        x = p(text=[r["text"] for r in b], images=[Image.open(images / r["file_name"]).convert("RGB") for r in b],
              return_tensors="pt", padding=True, truncation=True).to("cuda")
        with torch.no_grad():
            o = m(**x)
            sim = torch.nn.functional.cosine_similarity(o.image_embeds, o.text_embeds)
        for r, s in zip(b, sim.tolist()):
            r["align"] = float(s)


def select(rows: list[dict], keep: float) -> tuple[list[dict], dict]:
    reasons = {"blurry": 0, "noisy": 0, "flat": 0, "clipped": 0, "misaligned": 0, "duplicate": 0, "ranked_out": 0}
    sharp_lo = np.percentile([r["sharp"] for r in rows], 10)
    noise_hi = np.percentile([r["noise"] for r in rows], 95)
    align_lo = np.percentile([r["align"] for r in rows], 10)
    ok = []
    for r in rows:
        if r["sharp"] < sharp_lo: reasons["blurry"] += 1; continue
        if r["noise"] > noise_hi: reasons["noisy"] += 1; continue
        if r["contrast"] < 20: reasons["flat"] += 1; continue
        if r["clip"] > 0.25: reasons["clipped"] += 1; continue
        if r["align"] < align_lo: reasons["misaligned"] += 1; continue
        ok.append(r)
    seen, uniq = [], []
    for r in ok:
        if any(hamming(r["hash"], h) <= 4 for h in seen):
            reasons["duplicate"] += 1
            continue
        seen.append(r["hash"]); uniq.append(r)
    z = lambda k: (np.array([r[k] for r in uniq]) - np.mean([r[k] for r in uniq])) / (np.std([r[k] for r in uniq]) + 1e-9)
    score = 1.0 * z("align") + 0.4 * np.log1p(z("sharp") - z("sharp").min()) - 0.4 * z("noise")
    order = np.argsort(-score)
    n = int(round(keep * len(rows)))
    chosen = [uniq[i] for i in order[:n]]
    reasons["ranked_out"] = len(uniq) - len(chosen)
    return chosen, reasons


def package(rows: list[dict], images: Path, out_dir: Path) -> None:
    (out_dir / "train").mkdir(parents=True, exist_ok=True)
    meta = []
    for i, r in enumerate(rows):
        name = f"{i:06d}.jpg"
        shutil.copy2(images / r["file_name"], out_dir / "train" / name)
        meta.append({"file_name": name, "text": r["text"]})
    (out_dir / "train" / "metadata.jsonl").write_text("\n".join(json.dumps(m) for m in meta) + "\n", encoding="utf-8")
    (out_dir / "wds").mkdir(exist_ok=True)
    with tarfile.open(out_dir / "wds" / "coco_train.tar", "w") as tf:
        for m in meta:
            key = m["file_name"][:-4]
            tf.add(out_dir / "train" / m["file_name"], arcname=f"{key}.jpg")
            tb = out_dir / "train" / f"{key}.txt"
            tb.write_text(m["text"], encoding="utf-8")
            tf.add(tb, arcname=f"{key}.txt"); tb.unlink()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", type=float, default=0.7, help="share of the source images to keep")
    a = ap.parse_args()
    images = SRC / "train"
    rows = [json.loads(l) for l in (images / "metadata.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"measuring {len(rows)} images (classical CV)…", flush=True)
    rows = measure(rows, images)
    print("CLIP image-text alignment…", flush=True)
    clip_alignment(rows, images)
    chosen, reasons = select(rows, a.keep)
    if DST.exists():
        shutil.rmtree(DST)
    package(chosen, images, DST)
    src_m = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    src_m.update(dataset="COCO 2014 captions, CV-curated derivative", derived_from=str(SRC.name))
    src_m["counts"] = dict(src_m["counts"], train=len(chosen))
    src_m["curation"] = dict(keep=a.keep, measured=len(rows), kept=len(chosen), dropped=reasons,
                             filters="Laplacian-variance sharpness, Immerkaer noise sigma, luma contrast, exposure clipping, "
                                     "CLIP ViT-B/32 alignment, DCT pHash dedupe (Hamming<=4), composite-score ranking")
    (DST / "manifest.json").write_text(json.dumps(src_m, indent=1), encoding="utf-8")
    (DST / "curation_scores.json").write_text(json.dumps(
        [{k: v for k, v in r.items() if k != "hash"} for r in rows], indent=0), encoding="utf-8")
    if (SRC / "validation").is_dir():
        shutil.copytree(SRC / "validation", DST / "validation")
    print(json.dumps(src_m["curation"], indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
