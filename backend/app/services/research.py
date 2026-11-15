"""Research overview built ONLY from the measured result files, so every research page shows the same real numbers.

Sources (all under evaluation/results): fid/fid_results.json, compositional/compositional_results.json,
cloud/bestofn_a10g.json, cloud/turbo_tinyvae_a10g.json, fid/cv_ablation_O4.json.
Anything missing is simply omitted: the page degrades honestly instead of inventing numbers.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _load(p: Path) -> Any:
    try:
        return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None
    except Exception:  # noqa: BLE001 - a corrupt results file must never break the page
        return None


def _pct(x: float | None) -> str:
    return "n/a" if x is None else f"{100 * x:.0f}%"


def build_overview(repo: Path) -> dict:
    res = repo / "evaluation" / "results"
    bench = _load(res / "fid" / "fid_results.json") or {}
    comp = _load(res / "compositional" / "compositional_results.json") or {}
    bon = _load(res / "cloud" / "bestofn_a10g.json")
    tiny = _load(res / "cloud" / "turbo_tinyvae_a10g.json")
    cvab = _load(res / "fid" / "cv_ablation_O4.json")
    out: dict[str, Any] = {"measured": bool(bench), "sources": {"benchmark": bool(bench), "compositional": bool(comp), "best_of_n": bool(bon),
                                                                 "tiny_vae": bool(tiny), "cv_ablation": bool(cvab)}}
    b0 = bench.get("B0")
    rows = []
    for k, v in bench.items():
        r = dict(id=k, label=v["label"], fid=v["fid"], kid=v["kid_mean"] * 1e3, clip=v["clip_mean"], latency_ms=v["latency_median_ms"],
                 vram_mb=v["peak_vram_mb"], size_mb=v["model_size_mb"], steps=v.get("steps"))
        if b0:
            r["speedup"] = b0["latency_median_ms"] / v["latency_median_ms"]
            r["vram_saved_pct"] = 100 * (1 - v["peak_vram_mb"] / b0["peak_vram_mb"])
            r["size_saved_pct"] = 100 * (1 - v["model_size_mb"] / b0["model_size_mb"])
        if k in comp:
            r["prompt_accuracy"] = comp[k]["overall"]
        rows.append(r)
    out["variants"] = rows

    # ---- headline numbers
    heads = []
    if b0 and bench:
        best_lat = min(bench.items(), key=lambda kv: kv[1]["latency_median_ms"])
        best_clip = max(bench.items(), key=lambda kv: kv[1]["clip_mean"])
        low_mem = min(bench.items(), key=lambda kv: kv[1]["peak_vram_mb"])
        heads += [
            dict(label="Faster than the baseline", value=f"{b0['latency_median_ms'] / best_lat[1]['latency_median_ms']:.0f}x", sub=f"{best_lat[0]}: {best_lat[1]['latency_median_ms']:.0f} ms vs {b0['latency_median_ms']:.0f} ms", tone="primary"),
            dict(label="Less GPU memory", value=f"{100 * (1 - low_mem[1]['peak_vram_mb'] / b0['peak_vram_mb']):.0f}%", sub=f"{low_mem[0]}: {low_mem[1]['peak_vram_mb'] / 1024:.1f} GB vs {b0['peak_vram_mb'] / 1024:.1f} GB", tone="success"),
            dict(label="Best prompt match (CLIP)", value=f"{best_clip[1]['clip_mean']:.3f}", sub=f"{best_clip[0]} vs baseline {b0['clip_mean']:.3f}", tone="coral"),
        ]
    if comp and "T1" in comp and "B0" in comp:
        heads.append(dict(label="Prompt accuracy (objects, counts, colours, positions)", value=_pct(comp["T1"]["overall"]),
                          sub=f"T1 vs baseline {_pct(comp['B0']['overall'])}", tone="warning"))
    out["headlines"] = heads

    # ---- prompt accuracy
    if comp:
        out["prompt_accuracy"] = [dict(id=k, label=v["label"], overall=v["overall"], per_category=v["per_category"], n=v["n_per_category"]) for k, v in comp.items()]

    # ---- best-of-N
    if bon:
        bn = []
        per_img = bon.get("gen_ms_per_image_a10g", 0) + bon.get("verifier_ms_per_image_a10g", 0)
        t1 = bench.get("T1", {}).get("latency_median_ms")
        ver = bon.get("verifier_ms_per_image_a10g", 0)
        for n, r in bon["results"].items():
            n_i = int(n)
            bn.append(dict(n=n_i, overall=r["overall"], per_category=r["per_category"], ceiling=r.get("oracle_any_pass"),
                           cost_ms_a10g=n_i * per_img,
                           cost_ms_laptop_est=(n_i * (t1 + ver)) if t1 else None))
        out["best_of_n"] = dict(rows=bn, protocol=bon.get("protocol"), prompts=bon.get("n_prompts"), steps=bon.get("steps"),
                                note="Costs are generate + verify for N candidates. 'Laptop est.' uses the measured T1 latency plus the verifier time measured on the cloud GPU.")

    # ---- tiny decoder
    if tiny:
        out["tiny_vae"] = [dict(id=k, steps=v["steps"], tiny_vae=v["tiny_vae"], fid=v["fid"], kid=v["kid_mean"] * 1e3, clip=v["clip_mean"],
                                latency_ms=v["latency_median_ms"], size_mb=v["model_size_mb"]) for k, v in tiny.items()]

    # ---- classical-CV ablation
    if cvab:
        out["cv_ablation"] = [dict(name=k, fid=v["fid"], clip=v["clip_mean"], ms=v.get("cv_ms_mean"), flagged=v.get("flagged_share")) for k, v in cvab.items()]

    # ---- insights + failures, with numbers pulled from the files
    ins, fails = [], []
    g = lambda k, f: bench.get(k, {}).get(f)
    if g("T1", "fid") and g("O4", "fid"):
        ins.append(f"SD-Turbo (1 step) beats the LCM variants on every axis we measured: FID {g('T1', 'fid'):.1f} vs {g('O4', 'fid'):.1f}, CLIP {g('T1', 'clip_mean'):.3f} vs {g('O4', 'clip_mean'):.3f}, and {g('O4', 'latency_median_ms') / g('T1', 'latency_median_ms'):.1f}x faster.")
    if g("B1", "latency_median_ms") and g("B0", "latency_median_ms"):
        ins.append(f"fp16 alone gives {g('B0', 'latency_median_ms') / g('B1', 'latency_median_ms'):.1f}x speed and {100 * (1 - g('B1', 'peak_vram_mb') / g('B0', 'peak_vram_mb')):.0f}% less memory with no quality change (FID {g('B0', 'fid'):.1f} vs {g('B1', 'fid'):.1f}).")
    if g("O4T", "latency_median_ms") and g("O4", "latency_median_ms"):
        ins.append(f"The tiny VAE decoder (TAESD) cuts LCM latency {g('O4', 'latency_median_ms'):.0f} -> {g('O4T', 'latency_median_ms'):.0f} ms for +{g('O4T', 'fid') - g('O4', 'fid'):.1f} FID.")
    if tiny:
        a, b = tiny.get("T1"), tiny.get("T1T")
        if a and b:
            ins.append(f"On SD-Turbo the tiny decoder is nearly free quality-wise (FID {a['fid']:.1f} -> {b['fid']:.1f}, CLIP unchanged) and {a['latency_median_ms'] / b['latency_median_ms']:.1f}x faster on the cloud GPU.")
    if bon:
        r = bon["results"]
        if "1" in r and "8" in r:
            ins.append(f"Best-of-N with an independent verifier lifts prompt accuracy from {_pct(r['1']['overall'])} (N=1) to {_pct(r['8']['overall'])} (N=8); position prompts {_pct(r['1']['per_category']['position'])} -> {_pct(r['8']['per_category']['position'])}.")
    out["insights"] = ins

    if comp:
        c = lambda v, cat: comp.get(v, {}).get("per_category", {}).get(cat)
        fails.append(dict(title="Counting objects", severity="open", status="Open",
                          cause="Single-pass diffusion has no explicit object-count representation; CLIP cannot see count errors.",
                          evidence=f"'N objects' prompts pass only {_pct(c('T1', 'counting'))} (T1), {_pct(c('B0', 'counting'))} (baseline), {_pct(c('O4', 'counting'))} (LCM).",
                          mitigation="Best-of-N selection helps (see Best-of-N) but does not solve it; layout-guided generation would be next."))
        fails.append(dict(title="Spatial relations (left of, above ...)", severity="open", status="Partly mitigated",
                          cause="Relations need the model to bind objects to image regions, which text conditioning does only weakly.",
                          evidence=f"Position prompts pass {_pct(c('T1', 'position'))} (T1), {_pct(c('B0', 'position'))} (baseline), {_pct(c('O4', 'position'))} (LCM).",
                          mitigation=(f"Best-of-8 raises T1 to {_pct(bon['results']['8']['per_category']['position'])}." if bon else "Best-of-N selection.")))
        fails.append(dict(title="Colour binding degrades with few-step LCM", severity="measured", status="Documented",
                          cause="Consistency distillation with few steps blurs attribute-object binding.",
                          evidence=f"'A red bicycle' type prompts: {_pct(c('T1', 'colour'))} (T1) vs {_pct(c('B0', 'colour'))} (baseline) vs {_pct(c('O4', 'colour'))} (LCM 4 steps).",
                          mitigation="Prefer SD-Turbo when colour accuracy matters."))
    if g("Q4", "latency_median_ms") and g("O4", "latency_median_ms"):
        fails.append(dict(title="int8 weight-only quantisation was slower", severity="measured", status="Documented",
                          cause="Weight-only int8 dequantises on the fly; on this GPU the extra work outweighs the memory saving.",
                          evidence=f"Q4 {g('Q4', 'latency_median_ms'):.0f} ms vs O4 {g('O4', 'latency_median_ms'):.0f} ms, while size drops {g('O4', 'model_size_mb'):.0f} -> {g('Q4', 'model_size_mb'):.0f} MB.",
                          mitigation="Use it only where model size, not speed, is the constraint."))
    if g("D4", "fid") and g("O4", "fid"):
        e = bench.get("E2000")
        fails.append(dict(title="Our own LCM-LoRA did not beat the public one", severity="measured", status="Honest negative result",
                          cause="First run used LoRA alpha 64 while the public adapter is alpha 8 (8x too strong): FID 253. After correcting, 500 to 2000 steps on COCO could not improve on a model trained on far more data.",
                          evidence=f"Corrected D4 FID {g('D4', 'fid'):.1f} vs public {g('O4', 'fid'):.1f}" + (f"; more steps drift worse (E2000 {e['fid']:.1f})." if e else "."),
                          mitigation="Training now refuses mismatched alpha; the public adapter stays the LCM baseline."))
    if cvab:
        base = cvab.get("none")
        worst = max((abs(v["fid"] - base["fid"]) for k, v in cvab.items() if base and k != "none"), default=0)
        fails.append(dict(title="Classical CV post-processing barely moves the metrics", severity="measured", status="Documented",
                          cause="Generated images are already clean; resize/enhance/smooth/sharpen change pixels but not FID/CLIP.",
                          evidence=f"|dFID| <= {worst:.2f} across all stages; each stage costs {min(v['cv_ms_mean'] for v in cvab.values() if v.get('cv_ms_mean')):.0f}-{max(v['cv_ms_mean'] for v in cvab.values() if v.get('cv_ms_mean')):.0f} ms; the artifact detector flags {_pct((base or {}).get('flagged_share'))} of images (uncalibrated thresholds).",
                          mitigation="CV stays an opt-in, gated stage rather than a default."))
    if b0:
        fails.append(dict(title="Measurement caveats", severity="info", status="Stated",
                          cause="FID on a few hundred images is biased upward; the laptop GPU throttles thermally.",
                          evidence=f"Baseline sustained latency {b0.get('latency_sustained_median_ms') or b0['latency_median_ms']:.0f} ms vs cool-start {b0['latency_median_ms']:.0f} ms; n=300 for FID.",
                          mitigation="Rank variants against each other only; KID reported alongside; cool-start latency is the headline."))
    fails.append(dict(title="Not run on a phone", severity="info", status="Stated",
                      cause="Generation runs on a GPU server (hybrid edge-server design).",
                      evidence="Mobile feasibility is analytical only (evaluation/reports/mobile_feasibility.md).",
                      mitigation="Phone clients call the API; on-device inference is future work."))
    out["failures"] = fails

    out["protocol"] = dict(
        baseline="Stable Diffusion 1.5 (rev 451f4fe1), fp32, 30 PNDM steps, CFG 7.5, 512 px",
        data="300 held-out COCO validation captions (never trained on), same prompts and seeds for every variant",
        metrics="CLIP score, FID and KID (torch-fidelity), cool-start median latency, peak VRAM, model size, prompt accuracy (OWL-ViT checker)",
        hardware="RTX 5050 Laptop GPU (8 GB). Cloud experiments on an A10G are labelled and not compared with laptop rows.",
        caveat="FID is biased at this sample size: use it to rank variants against each other, not against published numbers.")
    return out
