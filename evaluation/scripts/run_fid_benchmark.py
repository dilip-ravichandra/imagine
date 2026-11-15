"""P3 head-to-head benchmark: baseline vs optimized text-to-image variants, with FID / KID / CLIP / latency / VRAM / size.

Everything is measured on the SAME prompts and seeds. Prompts are COCO captions from the held-out *validation* split
(`training_data/coco_sd15_lenbalanced/manifest.json`), which were never used to train any adapter in this repo; the
matching real photos are the FID reference set.

Phases (resumable - existing images are kept):
    python evaluation/scripts/run_fid_benchmark.py --generate --variants B0,B1,O1 --n 300
    python evaluation/scripts/run_fid_benchmark.py --score
    python evaluation/scripts/run_fid_benchmark.py --list

Outputs: evaluation/results/fid/<variant>/*.jpg, <variant>/gen_stats.json, fid_results.json, fid_results.md
"""
from __future__ import annotations

import argparse
import gc
import io
import json
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "evaluation" / "results" / "fid"
MANIFEST = ROOT / "training_data" / "coco_sd15_lenbalanced" / "manifest.json"
VAL_DIR = ROOT / "training_data" / "coco_sd15_lenbalanced" / "validation"
REAL_DIR = OUT / "_real_512"
SD15 = "stable-diffusion-v1-5/stable-diffusion-v1-5"
SD15_FALLBACK = "runwayml/stable-diffusion-v1-5"
LCM_LORA = "latent-consistency/lcm-lora-sdv1-5"
TURBO = "stabilityai/sd-turbo"
RES = 512

# id -> description. Everything except T* is SD 1.5 so each row isolates one change.
VARIANTS = {
    "B0": dict(label="Baseline: SD1.5 fp32, 30 steps (PNDM, CFG 7.5)", base="sd15", dtype="fp32", steps=30, sched="pndm", cfg=7.5),
    "B1": dict(label="+ fp16 (precision only), 30 steps", base="sd15", dtype="fp16", steps=30, sched="pndm", cfg=7.5),
    "O8": dict(label="+ LCM-LoRA, fp16, 8 steps", base="sd15", dtype="fp16", steps=8, sched="lcm", cfg=1.0, lcm=True),
    "O4": dict(label="+ LCM-LoRA, fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True),
    "O2": dict(label="+ LCM-LoRA, fp16, 2 steps", base="sd15", dtype="fp16", steps=2, sched="lcm", cfg=1.0, lcm=True),
    "Q4": dict(label="+ LCM-LoRA, fp16, 4 steps, int8 weight-only UNet", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, int8=True),
    "O4T": dict(label="+ LCM-LoRA, fp16, 4 steps, TAESD tiny VAE decoder", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, taesd=True),
    "T1": dict(label="SD-Turbo fp16, 1 step", base="turbo", dtype="fp16", steps=1, sched="turbo", cfg=0.0),
    "T2": dict(label="SD-Turbo fp16, 2 steps", base="turbo", dtype="fp16", steps=2, sched="turbo", cfg=0.0),
    "D4": dict(label="ImagineAI-Distilled: SD1.5 + OUR COCO-warm-started LCM-LoRA, fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_coco_warmstart"),
    "D2": dict(label="ImagineAI-Distilled, fp16, 2 steps", base="sd15", dtype="fp16", steps=2, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_coco_warmstart"),
    "E500": dict(label="ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 500 steps), fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_curated_500"),
    "E1000": dict(label="ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 1000 steps), fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_curated_1000"),
    "E1500": dict(label="ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 1500 steps), fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_curated_1500"),
    "E2000": dict(label="ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 2000 steps), fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_curated_2000"),
    "E2": dict(label="ImagineAI-Curated (best checkpoint), fp16, 2 steps", base="sd15", dtype="fp16", steps=2, sched="lcm", cfg=1.0, lcm=True, lcm_path="adapters/lcm_curated_best"),
    "A4": dict(label="ImagineAI-Adapted: SD1.5 + LCM-LoRA + COCO adapter, fp16, 4 steps", base="sd15", dtype="fp16", steps=4, sched="lcm", cfg=1.0, lcm=True, adapter=True),
}


def prompts(n: int) -> list[dict]:
    """n validation captions, stratified (every k-th) so short and complex captions are both represented."""
    val = json.loads(MANIFEST.read_text(encoding="utf-8"))["validation"]
    k = max(1, len(val) // n)
    return [dict(i=i, caption=r["caption"], file=r["file"], level=r.get("level")) for i, r in enumerate(val[::k][:n])]


def prepare_real(max_n: int = 1000) -> int:
    from PIL import Image
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    val = json.loads(MANIFEST.read_text(encoding="utf-8"))["validation"][:max_n]
    done = 0
    for r in val:
        dst = REAL_DIR / (Path(r["file"]).stem + ".jpg")
        if not dst.exists():
            im = Image.open(VAL_DIR / r["file"]).convert("RGB")
            w, h = im.size
            s = min(w, h)
            im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((RES, RES), Image.LANCZOS)
            im.save(dst, quality=95)
        done += 1
    return done


def _state_bytes(module) -> int:
    import torch
    buf = io.BytesIO()
    torch.save(module.state_dict(), buf)
    return buf.getbuffer().nbytes


def build_pipe(v: dict):
    import torch
    from diffusers import AutoPipelineForText2Image, LCMScheduler, StableDiffusionPipeline
    dt = torch.float16 if v["dtype"] == "fp16" else torch.float32
    if v["base"] == "turbo":
        pipe = AutoPipelineForText2Image.from_pretrained(TURBO, torch_dtype=dt, variant="fp16" if dt == torch.float16 else None)
    else:
        try:
            pipe = StableDiffusionPipeline.from_pretrained(SD15, torch_dtype=dt, safety_checker=None, local_files_only=True)
        except Exception:
            pipe = StableDiffusionPipeline.from_pretrained(SD15_FALLBACK, torch_dtype=dt, safety_checker=None, local_files_only=True)
        if v.get("lcm"):
            if v.get("lcm_path"):
                pipe.load_lora_weights(str(ROOT / v["lcm_path"]), weight_name="pytorch_lora_weights.safetensors")
            else:
                pipe.load_lora_weights(LCM_LORA, weight_name="pytorch_lora_weights.safetensors")
            if v.get("adapter"):
                _load_project_adapter(pipe)
            pipe.fuse_lora()
            pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe.set_progress_bar_config(disable=True)
    if v.get("taesd"):
        from diffusers import AutoencoderTiny
        pipe.vae = AutoencoderTiny.from_pretrained("madebyollin/taesd", torch_dtype=dt)
    if v.get("int8"):
        from torchao.quantization import Int8WeightOnlyConfig, quantize_
        quantize_(pipe.unet, Int8WeightOnlyConfig())
    return pipe.to("cuda")


def _load_project_adapter(pipe) -> None:
    """Stack the project's approved COCO-adapted LoRA (adapters/coco_sd15_lenbalanced_step2500) on top of LCM-LoRA."""
    ad = ROOT / "adapters" / "coco_sd15_lenbalanced_step2500"
    pipe.load_lora_weights(str(ad), weight_name="pytorch_lora_weights.safetensors", adapter_name="coco")
    pipe.set_adapters(["default_0", "coco"], adapter_weights=[1.0, 0.5])


def generate(variant: str, n: int) -> None:
    import torch
    v = VARIANTS[variant]
    d = OUT / variant
    d.mkdir(parents=True, exist_ok=True)
    ps = prompts(n)
    todo = [p for p in ps if not (d / f"{p['i']:04d}.jpg").exists()]
    stats_f = d / "gen_stats.json"
    old = json.loads(stats_f.read_text()) if stats_f.exists() else {"latency_ms": {}}
    if not todo and stats_f.exists():
        print(f"[{variant}] complete ({len(ps)} images)")
        return
    print(f"[{variant}] {v['label']}: generating {len(todo)}/{len(ps)}", flush=True)
    torch.cuda.empty_cache(); torch.cuda.reset_peak_memory_stats()
    t_load = time.perf_counter()
    pipe = build_pipe(v)
    torch.cuda.synchronize()
    load_s = time.perf_counter() - t_load
    kw = dict(num_inference_steps=v["steps"], guidance_scale=v["cfg"], height=RES, width=RES)
    gen = lambda p, s: pipe(p, generator=torch.Generator("cuda").manual_seed(s), **kw).images[0]
    for _ in range(2):  # warm-up: kernels, allocator, cudnn autotune
        gen("a warm up image of a cat", 0)
    torch.cuda.reset_peak_memory_stats()
    lat = {}
    for j, p in enumerate(todo):
        torch.cuda.synchronize(); t0 = time.perf_counter()
        img = gen(p["caption"], 1000 + p["i"])
        torch.cuda.synchronize(); lat[str(p["i"])] = (time.perf_counter() - t0) * 1000
        img.save(d / f"{p['i']:04d}.jpg", quality=95)
        if j % 25 == 0:
            print(f"  {variant} {j + 1}/{len(todo)}  {lat[str(p['i'])]:.0f} ms", flush=True)
    peak = torch.cuda.max_memory_allocated() / 2**20
    sizes = {k: _state_bytes(getattr(pipe, k)) / 2**20 for k in ("unet", "text_encoder", "vae")}
    old["latency_ms"].update(lat)
    all_lat = list(old["latency_ms"].values())
    stats = dict(variant=variant, label=v["label"], config=v, n_generated=len(all_lat), resolution=RES,
                 latency_median_ms=statistics.median(all_lat), latency_p95_ms=sorted(all_lat)[int(0.95 * (len(all_lat) - 1))],
                 latency_mean_ms=statistics.fmean(all_lat), peak_vram_mb=max(peak, old.get("peak_vram_mb", 0)),
                 model_size_mb=sizes, model_size_total_mb=sum(sizes.values()), load_seconds=load_s,
                 gpu=torch.cuda.get_device_name(0), latency_ms=old["latency_ms"])
    stats_f.write_text(json.dumps(stats, indent=1))
    del pipe; gc.collect(); torch.cuda.empty_cache()
    print(f"[{variant}] median {stats['latency_median_ms']:.0f} ms, peak {stats['peak_vram_mb']:.0f} MB", flush=True)


def _gpu_temp() -> int:
    import subprocess
    try:
        return int(subprocess.run(["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader"],
                                  capture_output=True, text=True).stdout.split()[0])
    except Exception:
        return 0


def latency(variant: str, runs: int = 40, cool_to: int = 62, warmup: int = 6) -> None:
    """Thermally controlled latency: wait for the GPU to cool, then time `runs` generations back-to-back.

    Long image-generation runs throttle a laptop GPU (87C, SW thermal slowdown), which would penalise whichever variant
    ran last. This phase is short, starts cool, and its result REPLACES the latency fields used in the report; the
    long-run numbers are kept as `latency_sustained_median_ms`.
    """
    import torch
    v = VARIANTS[variant]
    sf = OUT / variant / "gen_stats.json"
    if not sf.exists():
        return
    t = time.time()
    while _gpu_temp() > cool_to and time.time() - t < 600:
        time.sleep(10)
    start_temp = _gpu_temp()
    torch.cuda.empty_cache(); torch.cuda.reset_peak_memory_stats()
    pipe = build_pipe(v)
    kw = dict(num_inference_steps=v["steps"], guidance_scale=v["cfg"], height=RES, width=RES)
    ps = prompts(runs + warmup)
    for p in ps[:warmup]:  # long warm-up: lets the GPU leave its idle P-state and the allocator/cuDNN settle
        pipe(p["caption"], generator=torch.Generator("cuda").manual_seed(1), **kw)
    torch.cuda.reset_peak_memory_stats()
    ts = []
    for j, p in enumerate(ps[warmup:]):
        torch.cuda.synchronize(); t0 = time.perf_counter()
        pipe(p["caption"], generator=torch.Generator("cuda").manual_seed(2000 + j), **kw)
        torch.cuda.synchronize(); ts.append((time.perf_counter() - t0) * 1000)
    st = json.loads(sf.read_text())
    st.setdefault("latency_sustained_median_ms", st["latency_median_ms"])
    st.update(latency_median_ms=statistics.median(ts), latency_p95_ms=sorted(ts)[int(0.95 * (len(ts) - 1))],
              latency_mean_ms=statistics.fmean(ts), latency_std_ms=statistics.pstdev(ts), latency_all_ms=ts, latency_runs=runs, latency_start_temp_c=start_temp,
              latency_peak_vram_mb=torch.cuda.max_memory_allocated() / 2**20)
    sf.write_text(json.dumps(st, indent=1))
    print(f"[latency] {variant}: median {st['latency_median_ms']:.0f} ms (sustained {st['latency_sustained_median_ms']:.0f}), start {start_temp}C", flush=True)
    del pipe; gc.collect(); torch.cuda.empty_cache()


def clip_scores(folder: Path, ps: list[dict]) -> list[float]:
    import torch
    from PIL import Image
    from transformers import CLIPModel, CLIPProcessor
    m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to("cuda").eval()
    proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    out = []
    for p in ps:
        f = folder / f"{p['i']:04d}.jpg"
        if not f.exists():
            continue
        with torch.no_grad():
            x = proc(text=[p["caption"]], images=Image.open(f).convert("RGB"), return_tensors="pt", padding=True, truncation=True).to("cuda")
            o = m(**x)
            a, b = o.image_embeds, o.text_embeds
            out.append(float((a / a.norm(dim=-1, keepdim=True) * (b / b.norm(dim=-1, keepdim=True))).sum()))
    del m
    torch.cuda.empty_cache()
    return out


def score(n: int, only: list[str] | None = None) -> dict:
    import torch_fidelity
    prepare_real()
    ps = prompts(n)
    results = {}
    prev = json.loads((OUT / "fid_results.json").read_text()) if (OUT / "fid_results.json").exists() else {}
    for v in VARIANTS:
        d = OUT / v
        sf = d / "gen_stats.json"
        if not sf.exists():
            continue
        st = json.loads(sf.read_text())
        if only and v not in only and v in prev:  # keep earlier FID/KID/CLIP, refresh only the cost fields
            results[v] = dict(prev[v], latency_median_ms=st["latency_median_ms"], latency_p95_ms=st["latency_p95_ms"],
                              peak_vram_mb=st["peak_vram_mb"], model_size_mb=st["model_size_total_mb"])
            continue
        count = len(list(d.glob("*.jpg")))
        print(f"[score] {v}: {count} images", flush=True)
        m = torch_fidelity.calculate_metrics(input1=str(d), input2=str(REAL_DIR), cuda=True, isc=False, fid=True, kid=True,
                                             kid_subset_size=min(100, count - 1), kid_subsets=100, verbose=False)
        cs = clip_scores(d, ps)
        results[v] = dict(label=st["label"], n=count, fid=m["frechet_inception_distance"],
                          kid_mean=m["kernel_inception_distance_mean"], kid_std=m["kernel_inception_distance_std"],
                          clip_mean=statistics.fmean(cs), clip_std=statistics.pstdev(cs),
                          latency_median_ms=st["latency_median_ms"], latency_p95_ms=st["latency_p95_ms"],
                          latency_sustained_median_ms=st.get("latency_sustained_median_ms"),
                          peak_vram_mb=st["peak_vram_mb"], model_size_mb=st["model_size_total_mb"],
                          steps=st["config"]["steps"], dtype=st["config"]["dtype"], gpu=st["gpu"])
    (OUT / "fid_results.json").write_text(json.dumps(results, indent=1))
    write_md(results)
    return results


def write_md(r: dict) -> None:
    base = r.get("B0")
    lines = ["# FID / KID / CLIP benchmark (measured)", "",
             "Prompts: held-out COCO validation captions (never used for training). Reference: the matching real photos "
             "(center-cropped 512). **FID is computed on a small sample (n shown) and is biased upward; use it to RANK variants "
             "under identical conditions, not as an absolute leaderboard number.** KID is the less biased small-sample counterpart.", "",
             "| ID | Variant | n | FID ↓ | KID×1e3 ↓ | CLIP ↑ | Median ms ↓ | p95 ms | Peak VRAM MB ↓ | Size MB ↓ | Speed-up | VRAM saved |",
             "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for k, x in r.items():
        sp = f"{base['latency_median_ms'] / x['latency_median_ms']:.1f}×" if base else ""
        vs = f"{100 * (1 - x['peak_vram_mb'] / base['peak_vram_mb']):.0f}%" if base else ""
        lines.append(f"| {k} | {x['label']} | {x['n']} | {x['fid']:.1f} | {x['kid_mean'] * 1000:.1f} | {x['clip_mean']:.3f} | "
                     f"{x['latency_median_ms']:.0f} | {x['latency_p95_ms']:.0f} | {x['peak_vram_mb']:.0f} | {x['model_size_mb']:.0f} | {sp} | {vs} |")
    gpu = next(iter(r.values()))["gpu"] if r else "?"
    lines += ["", f"GPU: {gpu}. Latency = end-to-end `pipe()` incl. VAE decode, 512×512, batch 1, 2 warm-up runs discarded."]
    (OUT / "fid_results.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--generate", action="store_true")
    ap.add_argument("--score", action="store_true")
    ap.add_argument("--latency", action="store_true", help="thermally controlled latency pass (run after --generate)")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--variants", default="B0,B1,O4,Q4,T1,T2")
    ap.add_argument("--n", type=int, default=300)
    a = ap.parse_args()
    if a.list:
        for k, v in VARIANTS.items():
            print(k, "-", v["label"])
        return 0
    if a.generate:
        for k in a.variants.split(","):
            generate(k.strip(), a.n)
    if a.latency:
        for k in a.variants.split(","):
            latency(k.strip())
    if a.score:
        score(a.n, [x.strip() for x in a.variants.split(",")] if a.variants else None)
    return 0


if __name__ == "__main__":
    sys.exit(main())
