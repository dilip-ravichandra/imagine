"""Compositional prompt-following benchmark (GenEval-style, automatic).

CLIP score cannot tell "four candles" from "five candles" or "red cube left of blue ball". This script generates images
for template prompts in five categories and CHECKS each image with an open-vocabulary detector (OWL-ViT) plus CLIP
zero-shot colour classification on the detected box:

    single      "a photo of a dog"                         -> object present
    two_objects "a photo of a cat and a chair"              -> both present
    counting    "a photo of 3 cups"                         -> exactly 3 detected
    colour      "a photo of a red bicycle"                  -> object present AND box colour == red
    position    "a photo of a dog left of a chair"          -> both present AND centre-x/centre-y relation holds

Limitations (stated in the report): the checker itself is imperfect (small/occluded objects, detector confusions), so
treat accuracies as RELATIVE between variants evaluated by the same checker, not absolute truth.

Usage:
    python evaluation/scripts/run_compositional_eval.py --variants T1,O4,B0 --per-category 20
"""
from __future__ import annotations

import argparse
import gc
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_fid_benchmark as fb  # noqa: E402

ROOT = fb.ROOT
OUT = ROOT / "evaluation" / "results" / "compositional"
OBJECTS = ["dog", "cat", "car", "bicycle", "chair", "bottle", "cup", "laptop", "clock", "umbrella", "bench", "bird",
           "horse", "apple", "banana", "pizza", "vase", "book", "backpack", "television"]
PLURAL = {"bench": "benches", "television": "televisions"}
COLORS = ["red", "blue", "green", "yellow", "black", "white", "orange", "purple"]
RELATIONS = {"left of": ("x", -1), "right of": ("x", 1), "above": ("y", -1), "below": ("y", 1)}
CATS = ["single", "two_objects", "counting", "colour", "position"]


def art(w: str) -> str:
    return ("an " if w[0] in "aeiou" else "a ") + w


def plural(o: str, n: int) -> str:
    return o if n == 1 else PLURAL.get(o, o + "s")


def make_prompts(per_cat: int, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    items = []
    for _ in range(per_cat):
        o = rng.choice(OBJECTS)
        items.append(dict(cat="single", prompt=f"a photo of {art(o)}", objs=[o]))
    for _ in range(per_cat):
        a, b = rng.sample(OBJECTS, 2)
        items.append(dict(cat="two_objects", prompt=f"a photo of {art(a)} and {art(b)}", objs=[a, b]))
    for _ in range(per_cat):
        o, n = rng.choice(OBJECTS), rng.choice([2, 3, 4])
        items.append(dict(cat="counting", prompt=f"a photo of {n} {plural(o, n)}", objs=[o], n=n))
    for _ in range(per_cat):
        o, c = rng.choice(OBJECTS), rng.choice(COLORS)
        items.append(dict(cat="colour", prompt=f"a photo of {art(c + chr(32) + o)}", objs=[o], color=c))
    for _ in range(per_cat):
        a, b = rng.sample(OBJECTS, 2)
        rel = rng.choice(list(RELATIONS))
        items.append(dict(cat="position", prompt=f"a photo of {art(a)} {rel} {art(b)}", objs=[a, b], rel=rel))
    for i, it in enumerate(items):
        it["i"] = i
    return items


def generate(variant: str, items: list[dict]) -> None:
    import torch
    v = fb.VARIANTS[variant]
    d = OUT / variant
    d.mkdir(parents=True, exist_ok=True)
    todo = [it for it in items if not (d / f"{it['i']:04d}.jpg").exists()]
    if not todo:
        return
    print(f"[comp {variant}] generating {len(todo)} images", flush=True)
    pipe = fb.build_pipe(v)
    kw = dict(num_inference_steps=v["steps"], guidance_scale=v["cfg"], height=fb.RES, width=fb.RES)
    for it in todo:
        img = pipe(it["prompt"], generator=torch.Generator("cuda").manual_seed(5000 + it["i"]), **kw).images[0]
        img.save(d / f"{it['i']:04d}.jpg", quality=95)
    del pipe
    gc.collect()
    torch.cuda.empty_cache()


class Checker:
    def __init__(self):
        import torch
        from transformers import CLIPModel, CLIPProcessor, OwlViTForObjectDetection, OwlViTProcessor
        self.torch = torch
        self.dev = "cuda"
        self.owl_p = OwlViTProcessor.from_pretrained("google/owlvit-base-patch32")
        self.owl = OwlViTForObjectDetection.from_pretrained("google/owlvit-base-patch32").to(self.dev).eval()
        self.clip_p = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        self.clip = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(self.dev).eval()

    def detect(self, img, names: list[str], thr: float = 0.12):
        """-> {name: [(score, (x0,y0,x1,y1)), ...]} after per-class NMS."""
        import torch
        from torchvision.ops import nms
        queries = [[f"a photo of {art(n)}" for n in names]]
        x = self.owl_p(text=queries, images=img, return_tensors="pt").to(self.dev)
        with torch.no_grad():
            out = self.owl(**x)
        res = self.owl_p.image_processor.post_process_object_detection(out, threshold=thr, target_sizes=torch.tensor([img.size[::-1]]).to(self.dev))[0]
        found = {n: [] for n in names}
        for lab in range(len(names)):
            m = res["labels"] == lab
            if m.any():
                boxes, scores = res["boxes"][m], res["scores"][m]
                keep = nms(boxes, scores, 0.3)
                found[names[lab]] = [(float(scores[k]), tuple(float(t) for t in boxes[k])) for k in keep]
        return found

    def box_color(self, img, box, obj: str) -> str:
        import torch
        x0, y0, x1, y1 = [int(t) for t in box]
        crop = img.crop((max(0, x0), max(0, y0), max(x0 + 8, x1), max(y0 + 8, y1)))
        texts = [f"a photo of {art(c + chr(32) + obj)}" for c in COLORS]
        x = self.clip_p(text=texts, images=crop, return_tensors="pt", padding=True).to(self.dev)
        with torch.no_grad():
            logits = self.clip(**x).logits_per_image[0]
        return COLORS[int(logits.argmax())]

    def check(self, img, it: dict) -> bool:
        names = list(dict.fromkeys(it["objs"]))
        found = self.detect(img, names)
        best = {n: (max(found[n], key=lambda t: t[0]) if found[n] else None) for n in names}
        cat = it["cat"]
        if cat == "single":
            return best[names[0]] is not None
        if cat == "two_objects":
            return all(best[n] is not None for n in names)
        if cat == "counting":
            # confident detections only, so faint false positives don't inflate counts
            conf = [t for t in found[names[0]] if t[0] >= 0.2]
            return len(conf) == it["n"]
        if cat == "colour":
            b = best[names[0]]
            return b is not None and self.box_color(img, b[1], names[0]) == it["color"]
        if cat == "position":
            a, b = best[it["objs"][0]], best[it["objs"][1]]
            if a is None or b is None:
                return False
            ax, ay = (a[1][0] + a[1][2]) / 2, (a[1][1] + a[1][3]) / 2
            bx, by = (b[1][0] + b[1][2]) / 2, (b[1][1] + b[1][3]) / 2
            axis, sign = RELATIONS[it["rel"]]
            d = (ax - bx) if axis == "x" else (ay - by)
            return d * sign > 0.1 * fb.RES * 0.5
        return False


def score(variants: list[str], items: list[dict]) -> dict:
    from PIL import Image
    ck = Checker()
    res = {}
    failures = {}
    for v in variants:
        d = OUT / v
        per = {c: [] for c in CATS}
        failures[v] = []
        for it in items:
            f = d / f"{it['i']:04d}.jpg"
            if f.exists():
                ok = bool(ck.check(Image.open(f).convert("RGB"), it))
                per[it["cat"]].append(ok)
                if not ok:
                    failures[v].append(it)
        acc = {c: (sum(x) / len(x) if x else None) for c, x in per.items()}
        vals = [a for a in acc.values() if a is not None]
        res[v] = dict(label=fb.VARIANTS[v]["label"], per_category=acc, n_per_category={c: len(x) for c, x in per.items()},
                      overall=sum(vals) / len(vals) if vals else None)
        print(f"[comp score] {v}: overall {res[v]['overall']:.3f}  {acc}", flush=True)
    (OUT / "compositional_results.json").write_text(json.dumps(res, indent=1))
    fl = ["# Compositional failures (auto-extracted)", "",
          "Prompts whose generated image failed the automatic check. The checker is imperfect: open the image to confirm before citing a case.", ""]
    for v, fs in failures.items():
        fl += [f"## {v}: {fb.VARIANTS[v]['label']} ({len(fs)} failures)", ""]
        for c in CATS:
            ex = [x for x in fs if x["cat"] == c][:4]
            for x in ex:
                fl.append(f"- **{c}**: \"{x['prompt']}\" -> `{v}/{x['i']:04d}.jpg`")
        fl.append("")
    (OUT / "failures.md").write_text("\n".join(fl), encoding="utf-8")
    lines = ["# Compositional accuracy (automatic, GenEval-style)", "",
             "Checker: OWL-ViT detector + CLIP zero-shot colour on the detected box. Accuracy = share of prompts whose image passes the check. "
             "Relative comparison between variants only; the checker is imperfect.", "",
             "| ID | Variant | single | two objects | counting | colour | position | overall |", "|---|---|---:|---:|---:|---:|---:|---:|"]
    for k, r in res.items():
        pc = r["per_category"]
        cell = lambda c: "-" if pc[c] is None else f"{100 * pc[c]:.0f}%"
        lines.append(f"| {k} | {r['label']} | {cell('single')} | {cell('two_objects')} | {cell('counting')} | {cell('colour')} | {cell('position')} | {100 * r['overall']:.0f}% |")
    (OUT / "compositional_results.md").write_text("\n".join(lines), encoding="utf-8")
    return res


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", default="T1,T2,O4,B0")
    ap.add_argument("--per-category", type=int, default=20)
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--score", action="store_true")
    a = ap.parse_args()
    items = make_prompts(a.per_category)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "prompts.json").write_text(json.dumps(items, indent=1))
    vs = [x.strip() for x in a.variants.split(",")]
    if a.generate:
        for v in vs:
            generate(v, items)
    if a.score:
        score(vs, items)
    return 0


if __name__ == "__main__":
    sys.exit(main())
