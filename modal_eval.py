"""Cloud evaluation on a Modal A10G (keeps the laptop GPU free).

  modal volume put imagineai-lcm evaluation/results/fid/_real_512 /real
  modal run modal_eval.py --job turbo      # SD-Turbo vs SD-Turbo+TAESD: FID/KID/CLIP/latency/VRAM on ONE GPU
  modal run modal_eval.py --job bestofn    # best-of-N prompt-faithfulness with an INDEPENDENT verifier

Results are written to evaluation/results/cloud/*.json. All numbers from this file are labelled A10G: compare rows
to each other, not to the laptop (RTX 5050) table.

Best-of-N protocol (no self-grading): candidates are SELECTED with facebook/detr-resnet-50 (counts, boxes) plus a classical
HSV hue test for colour, and EVALUATED with the benchmark's OWL-ViT + CLIP checker. Different detectors, so the accuracy
gain cannot come from the selector grading itself. N=1 is the plain single-sample baseline.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parent
vol = modal.Volume.from_name("imagineai-lcm", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install("torch==2.6.0", "torchvision==0.21.0")
    .pip_install("diffusers==0.35.1", "transformers>=4.44,<5", "accelerate>=0.30", "safetensors", "pillow", "numpy<2",
                 "scipy", "torch-fidelity", "opencv-python-headless", "huggingface_hub", "timm")
    .add_local_file(ROOT / "evaluation/scripts/run_fid_benchmark.py", "/code/evaluation/scripts/run_fid_benchmark.py")
    .add_local_file(ROOT / "evaluation/scripts/run_compositional_eval.py", "/code/evaluation/scripts/run_compositional_eval.py")
)
app = modal.App("imagineai-eval", image=image)
TURBO = "stabilityai/sd-turbo"

# variant -> (steps, taesd)
TURBO_VARIANTS = {"T1": (1, False), "T1T": (1, True), "T2": (2, False), "T2T": (2, True)}


def _pipe(taesd: bool):
    import torch
    from diffusers import AutoencoderTiny, AutoPipelineForText2Image
    p = AutoPipelineForText2Image.from_pretrained(TURBO, torch_dtype=torch.float16, variant="fp16")
    p.set_progress_bar_config(disable=True)
    if taesd:
        p.vae = AutoencoderTiny.from_pretrained("madebyollin/taesd", torch_dtype=torch.float16)
    return p.to("cuda")


def _bytes(m) -> float:
    import io
    import torch
    b = io.BytesIO()
    torch.save(m.state_dict(), b)
    return b.getbuffer().nbytes / 2**20


@app.function(gpu="A10G", timeout=2 * 3600, volumes={"/data": vol})
def turbo_eval(items: list[dict]) -> dict:
    import statistics
    import torch
    import torch_fidelity
    from PIL import Image
    from transformers import CLIPModel, CLIPProcessor

    real = "/data/real"
    out = {}
    for name, (steps, taesd) in TURBO_VARIANTS.items():
        d = Path(f"/data/gen/{name}")
        d.mkdir(parents=True, exist_ok=True)
        import gc
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        pipe = _pipe(taesd)
        kw = dict(num_inference_steps=steps, guidance_scale=0.0, height=512, width=512)
        for _ in range(6):
            pipe("a warm up image of a cat", generator=torch.Generator("cuda").manual_seed(0), **kw)
        torch.cuda.reset_peak_memory_stats()
        lat = []
        for it in items:
            torch.cuda.synchronize(); t = time.perf_counter()
            img = pipe(it["caption"], generator=torch.Generator("cuda").manual_seed(1000 + it["i"]), **kw).images[0]
            torch.cuda.synchronize(); lat.append((time.perf_counter() - t) * 1000)
            img.save(d / f"{it['i']:04d}.jpg", quality=95)
        peak = torch.cuda.max_memory_allocated() / 2**20
        size = sum(_bytes(getattr(pipe, k)) for k in ("unet", "text_encoder", "vae"))
        del pipe
        import gc
        gc.collect()          # free this variant completely so the next variant's peak-VRAM is not contaminated
        torch.cuda.empty_cache()
        m = torch_fidelity.calculate_metrics(input1=str(d), input2=real, cuda=True, isc=False, fid=True, kid=True,
                                             kid_subset_size=100, kid_subsets=100, verbose=False)
        cm = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to("cuda").eval()
        cp = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        cs = []
        for it in items:
            with torch.no_grad():
                x = cp(text=[it["caption"]], images=Image.open(d / f"{it['i']:04d}.jpg").convert("RGB"),
                       return_tensors="pt", padding=True, truncation=True).to("cuda")
                o = cm(**x)
                cs.append(float(torch.nn.functional.cosine_similarity(o.image_embeds, o.text_embeds)))
        out[name] = dict(steps=steps, tiny_vae=taesd, n=len(items), fid=m["frechet_inception_distance"],
                         kid_mean=m["kernel_inception_distance_mean"], clip_mean=statistics.fmean(cs),
                         latency_median_ms=statistics.median(lat), latency_p95_ms=sorted(lat)[int(0.95 * (len(lat) - 1))],
                         peak_vram_mb=peak, model_size_mb=size, gpu=torch.cuda.get_device_name(0))
        print(name, {k: (round(v, 3) if isinstance(v, float) else v) for k, v in out[name].items()}, flush=True)
    vol.commit()
    return out


# ------------------------------------------------------------------------------------ best-of-N
HUES = {"red": (0, 10), "orange": (10, 22), "yellow": (22, 36), "green": (36, 85), "blue": (95, 130), "purple": (130, 160)}


def hsv_colour(img_bgr_crop) -> str:
    """Classical colour naming of a box: median hue of saturated pixels, plus black/white from value/saturation."""
    import cv2
    import numpy as np
    hsv = cv2.cvtColor(img_bgr_crop, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(np.float32)
    h, s, v = hsv[:, 0], hsv[:, 1], hsv[:, 2]
    if (v < 60).mean() > 0.5:
        return "black"
    if ((s < 40) & (v > 170)).mean() > 0.5:
        return "white"
    m = (s > 70) & (v > 60)
    if m.sum() < 20:
        return "none"
    hue = float(np.median(h[m]))
    if hue >= 160 or hue < 10:
        return "red"
    for name, (a, b) in HUES.items():
        if a <= hue < b:
            return name
    return "none"


class Verifier:
    """DETR-based prompt-satisfaction score in [0, 1+] used ONLY to choose among candidates."""

    def __init__(self):
        from transformers import DetrForObjectDetection, DetrImageProcessor
        self.p = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50")
        self.m = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50").to("cuda").eval()
        self.names = self.m.config.id2label
        self.alias = {"television": "tv", "bicycle": "bicycle", "laptop": "laptop"}

    def detect(self, img, thr=0.7):
        import torch
        x = self.p(images=img, return_tensors="pt").to("cuda")
        with torch.no_grad():
            o = self.m(**x)
        r = self.p.post_process_object_detection(o, threshold=thr, target_sizes=torch.tensor([img.size[::-1]]))[0]
        det = []
        for sc, lb, bx in zip(r["scores"], r["labels"], r["boxes"]):
            det.append((self.names[int(lb)], float(sc), [float(t) for t in bx]))
        return det

    def score(self, img, it) -> float:
        import cv2
        import numpy as np
        det = self.detect(img)
        by = lambda o: sorted([d for d in det if d[0] == self.alias.get(o, o)], key=lambda d: -d[1])
        cat = it["cat"]
        if cat == "single":
            hit = by(it["objs"][0])
            return 1.0 + hit[0][1] if hit else 0.0
        if cat == "two_objects":
            conf = [by(o)[0][1] if by(o) else 0.0 for o in it["objs"]]
            return (1.0 if all(c > 0 for c in conf) else 0.0) + 0.1 * min(conf)
        if cat == "counting":
            n = len(by(it["objs"][0]))
            return 1.0 if n == it["n"] else max(0.0, 0.5 - 0.25 * abs(n - it["n"]))
        if cat == "colour":
            b = by(it["objs"][0])
            if not b:
                return 0.0
            x0, y0, x1, y1 = [int(t) for t in b[0][2]]
            crop = cv2.cvtColor(np.array(img.crop((max(0, x0), max(0, y0), max(x0 + 8, x1), max(y0 + 8, y1)))), cv2.COLOR_RGB2BGR)
            return 0.5 + (1.0 if hsv_colour(crop) == it["color"] else 0.0)
        if cat == "position":
            a, b = by(it["objs"][0]), by(it["objs"][1])
            if not a or not b:
                return 0.0
            ca = ((a[0][2][0] + a[0][2][2]) / 2, (a[0][2][1] + a[0][2][3]) / 2)
            cb = ((b[0][2][0] + b[0][2][2]) / 2, (b[0][2][1] + b[0][2][3]) / 2)
            axis, sign = {"left of": (0, -1), "right of": (0, 1), "above": (1, -1), "below": (1, 1)}[it["rel"]]
            return 0.5 + (1.0 if (ca[axis] - cb[axis]) * sign > 0.05 * 512 else 0.0)
        return 0.0


@app.function(gpu="A10G", timeout=3 * 3600, volumes={"/data": vol})
def bestofn(items: list[dict], ns: list[int], steps: int = 1, per_cat_seed: int = 5000) -> dict:
    import sys
    sys.path.insert(0, "/code/evaluation/scripts")
    import torch
    import run_compositional_eval as rc
    nmax = max(ns)
    pipe = _pipe(False)
    kw = dict(num_inference_steps=steps, guidance_scale=0.0, height=512, width=512)
    for _ in range(4):
        pipe("warm up", generator=torch.Generator("cuda").manual_seed(0), **kw)
    cands, t_gen = {}, []
    for it in items:
        cs = []
        for k in range(nmax):
            torch.cuda.synchronize(); t = time.perf_counter()
            cs.append(pipe(it["prompt"], generator=torch.Generator("cuda").manual_seed(per_cat_seed + it["i"] * 100 + k), **kw).images[0])
            torch.cuda.synchronize(); t_gen.append((time.perf_counter() - t) * 1000)
        cands[it["i"]] = cs
    del pipe
    torch.cuda.empty_cache()
    ver = Verifier()
    t0 = time.perf_counter()
    vs = {i: [ver.score(im, it) for im in cands[i]] for it, i in ((it, it["i"]) for it in items)}
    t_ver = (time.perf_counter() - t0) * 1000 / (len(items) * nmax)
    del ver
    torch.cuda.empty_cache()
    ck = rc.Checker()
    # evaluate EVERY candidate once with the independent checker, then derive each N's choice without re-running it
    ok = {i: [bool(ck.check(im, it)) for im in cands[i]] for it, i in ((it, it["i"]) for it in items)}
    res = {}
    for n in ns:
        per = {c: [] for c in rc.CATS}
        for it in items:
            i = it["i"]
            pick = max(range(n), key=lambda k: (vs[i][k], -k))  # first best-scoring candidate
            per[it["cat"]].append(ok[i][pick])
        acc = {c: (sum(v) / len(v) if v else None) for c, v in per.items()}
        res[str(n)] = dict(per_category=acc, overall=sum(x for x in acc.values() if x is not None) / len([x for x in acc.values() if x is not None]))
    # oracle ceiling: some candidate among the first n passes the independent checker (upper bound for any selector)
    for n in ns:
        res[str(n)]["oracle_any_pass"] = sum(any(ok[it["i"]][:n]) for it in items) / len(items)
    out = dict(steps=steps, ns=ns, n_prompts=len(items), results=res, gen_ms_per_image_a10g=sum(t_gen) / len(t_gen),
               verifier_ms_per_image_a10g=t_ver, gpu="A10G", protocol="select: DETR + HSV colour; evaluate: OWL-ViT + CLIP colour")
    print(json.dumps(res, indent=1), flush=True)
    return out


@app.local_entrypoint()
def main(job: str = "turbo", per_category: int = 20, n_max: int = 8):
    import sys
    sys.path.insert(0, str(ROOT / "evaluation" / "scripts"))
    out_dir = ROOT / "evaluation" / "results" / "cloud"
    out_dir.mkdir(parents=True, exist_ok=True)
    if job == "turbo":
        import run_fid_benchmark as fb
        items = [dict(i=p["i"], caption=p["caption"]) for p in fb.prompts(300)]
        r = turbo_eval.remote(items)
        (out_dir / "turbo_tinyvae_a10g.json").write_text(json.dumps(r, indent=1))
    else:
        import run_compositional_eval as rc
        items = rc.make_prompts(per_category)
        r = bestofn.remote(items, [1, 2, 4, 8][: [1, 2, 4, 8].index(n_max) + 1] if n_max in (1, 2, 4, 8) else [1, 2, 4, 8])
        (out_dir / "bestofn_a10g.json").write_text(json.dumps(r, indent=1))
    print("saved to", out_dir)
