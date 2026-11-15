"""Mobile feasibility table, derived from MEASURED sizes/memory in evaluation/results/fid/<variant>/gen_stats.json.

What is measured (on the RTX 5050 laptop): per-component weight bytes at fp16/fp32, peak GPU memory, latency.
What is ESTIMATED here (clearly labelled): weight memory if the same tensors were stored at int8 / 4-bit, and the
resulting working-set RAM = weights + measured activation overhead. These are feasibility numbers, NOT on-device runs:
no phone benchmark was performed, and activation overhead on a phone runtime (Core ML / TFLite / QNN) will differ.

    python evaluation/scripts/mobile_feasibility.py
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FID = ROOT / "evaluation" / "results" / "fid"
OUT = ROOT / "evaluation" / "reports" / "mobile_feasibility.md"

# usable app RAM on typical devices (a phone OS lets one app use well under total RAM) -- rough planning figures
DEVICES = [("Budget phone (4 GB RAM)", 1.8), ("Mid phone (8 GB RAM)", 4.0), ("Flagship phone (12 GB RAM)", 6.0)]


def main() -> int:
    rows = []
    for v in ("O4", "Q4", "T1", "T2", "B0"):
        f = FID / v / "gen_stats.json"
        if not f.is_file():
            continue
        s = json.loads(f.read_text())
        sizes = s["model_size_mb"]
        weights_fp = s["model_size_total_mb"]
        dtype = s["config"]["dtype"]
        bytes_per = 2 if dtype == "fp16" else 4
        peak = s["peak_vram_mb"]
        act = max(0.0, peak - weights_fp)  # measured activation + workspace overhead
        params_m = weights_fp / bytes_per  # million parameters (MB / bytes-per-param)
        est = {"fp16": params_m * 2, "int8": params_m * 1, "int4": params_m * 0.5}
        rows.append((v, s["label"], weights_fp, act, peak, est, s["latency_median_ms"]))
    lines = ["# Mobile feasibility (derived from measured laptop-GPU numbers)", "",
             "**Honest scope:** these are *estimates* from measured weight sizes and measured activation overhead. "
             "No on-device run has been done. Latency is from the laptop GPU, not a phone NPU.", "",
             "| Variant | Measured weights MB | Measured peak GPU MB | est. weights int8 MB | est. weights int4 MB | est. working set int8 MB | est. working set int4 MB |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for v, label, w, act, peak, est, lat in rows:
        lines.append(f"| {v} {label} | {w:.0f} | {peak:.0f} | {est['int8']:.0f} | {est['int4']:.0f} | {est['int8'] + act:.0f} | {est['int4'] + act:.0f} |")
    lines += ["", "## Fits on-device? (working set vs usable app RAM)", "",
              "| Variant | " + " | ".join(d for d, _ in DEVICES) + " |", "|---|" + "---|" * len(DEVICES)]
    for v, label, w, act, peak, est, lat in rows:
        cells = []
        for _, ram in DEVICES:
            fits = []
            for name in ("fp16", "int8", "int4"):
                ws = est[name] + act
                fits.append(f"{name}:{'yes' if ws / 1024 <= ram else 'no'}")
            cells.append(" ".join(fits))
        lines.append(f"| {v} | " + " | ".join(cells) + " |")
    lines += ["", "## Deployment mode actually implemented",
              "",
              "- **Hybrid edge-server** (default, demonstrated): the phone/web client sends the prompt; a GPU server runs the optimized "
              "pipeline; the adaptive controller picks steps/resolution from a measured hardware profile and falls back when budget is tight.",
              "- **Fully on-device**: *not demonstrated.* The table above shows it is plausible only with int8/int4 weights and a mobile "
              "runtime; the repo does not claim a phone benchmark.",
              "",
              "Context from the literature (not our results): SnapFusion and MobileDiffusion report sub-2 s and sub-1 s 512px generation on recent "
              "iPhones after architecture-level compression, which is the research direction this table points at."]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
