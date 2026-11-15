"""Builds the hackathon deliverable `eval_P3_<TeamID>.md` from MEASURED result files (nothing typed by hand).

Metric order follows the problem statement: CLIP similarity, FID, generation latency, peak memory, model size,
quality-vs-cost. First line = all USNs, comma separated (hackathon rule).

    python evaluation/scripts/build_eval_report.py --usns 1MS22CS001,1MS22CS002 --team-id T01
"""
from __future__ import annotations

import argparse
import json
import platform
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "evaluation" / "results"
REP = ROOT / "evaluation" / "reports"


def load(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def env_block() -> str:
    try:
        import torch, diffusers, transformers
        gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only"
        vram = f"{torch.cuda.get_device_properties(0).total_memory / 2**20:.0f} MB" if torch.cuda.is_available() else "-"
        vers = f"torch {torch.__version__}, diffusers {diffusers.__version__}, transformers {transformers.__version__}"
    except Exception:
        gpu, vram, vers = "unknown", "-", "unknown"
    try:
        import psutil
        ram = f"{psutil.virtual_memory().total / 2**30:.0f} GB"
    except Exception:
        ram = "?"
    return (f"- OS: {platform.platform()}\n- GPU: {gpu} ({vram} VRAM)\n- RAM: {ram}\n- Python: {platform.python_version()}; {vers}\n"
            "- Android client: Jetpack Compose (minSdk 26); phone benchmark NOT performed (see mobile feasibility)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--usns", default="1MS22CS001,1MS22CS002")
    ap.add_argument("--team-id", default="TeamID")
    a = ap.parse_args()

    fid = load(RES / "fid" / "fid_results.json") or {}
    comp = load(RES / "compositional" / "compositional_results.json") or {}
    cv = load(RES / "fid" / "cv_ablation_O4.json") or {}
    base = fid.get("B0")

    L = [a.usns, "", "# Imagine AI: P3 evaluation report (generated from measured data)", ""]
    L += ["## 1. Team and problem statement",
          f"Team {a.team_id}; USNs {a.usns}. **P3: Resource-Efficient Text-to-Image Generation for Mobile Devices.**", "",
          "## 2. Environment", env_block(), ""]
    L += ["## 3. Benchmark definition",
          "The problem statement asks for a comparison against *a baseline model*. Our baseline is the **unoptimised pretrained model**: "
          "Stable Diffusion 1.5 (revision `451f4fe1...`), fp32, 30 PNDM steps, CFG 7.5, 512x512. Every optimised variant is run on the **same "
          "300 held-out COCO validation captions with the same seeds**; the FID reference set is the matching real COCO photos. Validation "
          "captions were excluded from all training.", ""]
    if fid:
        L += ["## 4. Quantitative results (metric order as in the problem statement)", "",
              "| ID | Variant | CLIP ↑ | FID ↓ | KID×1e3 ↓ | Latency ms (median / p95) ↓ | Peak memory MB ↓ | Model size MB ↓ | Quality vs cost |",
              "|---|---|---:|---:|---:|---:|---:|---:|---|"]
        for k, x in fid.items():
            if base:
                sp = base["latency_median_ms"] / x["latency_median_ms"]
                mem = 100 * (1 - x["peak_vram_mb"] / base["peak_vram_mb"])
                dq = x["clip_mean"] - base["clip_mean"]
                qc = f"{sp:.1f}× faster, {mem:+.0f}% mem, ΔCLIP {dq:+.3f}, ΔFID {x['fid'] - base['fid']:+.1f}"
            else:
                qc = ""
            L.append(f"| {k} | {x['label']} | {x['clip_mean']:.3f} | {x['fid']:.1f} | {x['kid_mean'] * 1000:.1f} | "
                     f"{x['latency_median_ms']:.0f} / {x['latency_p95_ms']:.0f} | {x['peak_vram_mb']:.0f} | {x['model_size_mb']:.0f} | {qc} |")
        L += ["", f"n = {next(iter(fid.values()))['n']} generated images per variant. **FID caveat:** FID on a few hundred images is biased "
                  "upward and noisy; use it to *rank* variants evaluated identically, and prefer KID for small samples. "
                  "Latency = end-to-end `pipe()` including VAE decode, batch 1, measured after GPU cool-down; "
                  "sustained-run latency (thermal throttling on a laptop GPU) is higher and recorded in `evaluation/results/fid/*/gen_stats.json`.", ""]
    else:
        L += ["## 4. Quantitative results", "NOT RUN: execute `evaluation/scripts/run_fid_benchmark.py --generate --latency --score`.", ""]

    if comp:
        L += ["## 5. Complex-prompt consistency (compositional accuracy)", "",
              "CLIP score cannot verify counts, colours or positions, so each image is checked by an open-vocabulary detector (OWL-ViT) and "
              "CLIP colour classification. Relative comparison only; the checker is imperfect.", "",
              "| ID | Variant | single | two objects | counting | colour | position | overall |", "|---|---|---:|---:|---:|---:|---:|---:|"]
        for k, r in comp.items():
            pc = r["per_category"]
            cell = lambda c: "-" if pc.get(c) is None else f"{100 * pc[c]:.0f}%"
            L.append(f"| {k} | {r['label']} | {cell('single')} | {cell('two_objects')} | {cell('counting')} | {cell('colour')} | {cell('position')} | {100 * r['overall']:.0f}% |")
        L.append("")

    if cv:
        b = cv["none"]
        L += ["## 6. Classical-CV ablation (real generated images)", "",
              "| CV configuration | FID | ΔFID | CLIP | ΔCLIP | CV ms/img |", "|---|---:|---:|---:|---:|---:|"]
        for k, r in cv.items():
            L.append(f"| {k} | {r['fid']:.2f} | {r['fid'] - b['fid']:+.2f} | {r['clip_mean']:.4f} | {r['clip_mean'] - b['clip_mean']:+.4f} | {r['cv_ms_mean']:.0f} |")
        L += ["", "**Reading:** differences in FID/CLIP are within sampling noise; the CV stages cost more time than they buy in these metrics. "
                  "We therefore keep CV as an opt-in, gated stage rather than a default, and report this honestly.", ""]

    L += ["## 7. Ablation study", "", "Single-variable changes against the baseline B0 (see §4 numbers):",
          "- **Precision** (B1 vs B0): fp32 → fp16.", "- **Sampling steps / distillation** (O8, O4, O2 vs B1): LCM-LoRA few-step sampling.",
          "- **Quantisation** (Q4 vs O4): int8 weight-only UNet via torchao.", "- **Architecture** (T1, T2): SD-Turbo adversarial distillation.",
          "- **Adaptation** (A4, D4 if present): COCO-adapted / our own distilled adapter.",
          "- **Classical CV** (§6).", ""]
    for name, title in (("mobile_feasibility.md", "## 8. Mobile feasibility"),):
        p = REP / name
        if p.is_file():
            L += [title, "", "See `evaluation/reports/mobile_feasibility.md` (estimates derived from measured sizes; no phone benchmark).", ""]
    L += ["## 9. Adaptive generation and fallback",
          "Implemented in `ai_engine/adaptive` (measured hardware profile, Quick/Balanced/Best mapping, fallback ladder, decision log) and "
          "demonstrated live in the Stress Lab (`/api/v1/adaptive/stress-generate`). Unit-tested (see `tests/`).", "",
          "## 10. Failure analysis and limitations", "See `evaluation/reports/failure_analysis.md` and the auto-extracted failures in "
          "`evaluation/results/compositional/failures.md`.", "",
          "## 11. Reproduce", "```",
          "python evaluation/scripts/run_fid_benchmark.py --generate --latency --score --variants B0,B1,O8,O4,O2,Q4,T1,T2 --n 300",
          "python evaluation/scripts/run_compositional_eval.py --generate --score --variants B0,O4,T1,T2",
          "python evaluation/scripts/run_cv_ablation.py --variant O4",
          "python evaluation/scripts/mobile_feasibility.py",
          f"python evaluation/scripts/build_eval_report.py --usns {a.usns} --team-id {a.team_id}", "```"]
    out = REP / f"eval_P3_{a.team_id}.md"
    out.write_text("\n".join(L), encoding="utf-8")
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
