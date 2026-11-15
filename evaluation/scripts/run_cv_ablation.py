"""Classical-CV post-processing ablation on REAL generated images (not synthetic).

Takes the images of one benchmark variant (default O4 = LCM-LoRA fp16 4 steps), applies each CV configuration from
`computer_vision.pipeline`, and measures FID / KID / CLIP against the same COCO references plus a sharpness proxy and the
artifact-flag rate. This answers: does each classical stage actually help, hurt, or do nothing on generated images?

    python evaluation/scripts/run_cv_ablation.py --variant O4
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_fid_benchmark as fb  # noqa: E402

ROOT = fb.ROOT
sys.path.insert(0, str(ROOT))

CONFIGS = {
    "none": dict(),
    "enhance (CLAHE/WB/gamma, adaptive)": dict(enhance=True),
    "smooth (bilateral)": dict(smooth=True),
    "sharpen (edge-preserving unsharp)": dict(sharpen=True),
    "smooth + sharpen": dict(smooth=True, sharpen=True),
    "enhance + smooth + sharpen": dict(enhance=True, smooth=True, sharpen=True),
    "correct (guarded artifact fix)": dict(correct=True),
}


def lap_var(arr) -> float:
    import cv2
    return float(cv2.Laplacian(cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY), cv2.CV_64F).var())


def main() -> int:
    import numpy as np
    from PIL import Image
    import torch_fidelity
    from computer_vision.pipeline import CVPipelineConfig, run_pipeline

    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="O4")
    ap.add_argument("--n", type=int, default=300)
    a = ap.parse_args()
    fb.prepare_real()
    src = fb.OUT / a.variant
    ps = fb.prompts(a.n)
    files = [src / f"{p['i']:04d}.jpg" for p in ps if (src / f"{p['i']:04d}.jpg").exists()]
    out = fb.OUT / "_cv_ablation" / a.variant
    results = {}
    for name, kw in CONFIGS.items():
        d = out / ("cfg_" + str(list(CONFIGS).index(name)))
        d.mkdir(parents=True, exist_ok=True)
        ms, sharp, flagged, changed = [], [], 0, 0
        for f in files:
            arr = np.asarray(Image.open(f).convert("RGB"))
            t0 = time.perf_counter()
            res = run_pipeline(arr, CVPipelineConfig(assess=True, **kw))
            ms.append((time.perf_counter() - t0) * 1000)
            sharp.append(lap_var(res.image))
            flagged += bool(res.flag_names)
            changed += bool(res.changed)
            Image.fromarray(res.image).save(d / f.name, quality=95)
        m = torch_fidelity.calculate_metrics(input1=str(d), input2=str(fb.REAL_DIR), cuda=True, fid=True, kid=True,
                                             kid_subset_size=min(100, len(files) - 1), kid_subsets=100, verbose=False)
        cs = fb.clip_scores(d, [p for p in ps if (d / f"{p['i']:04d}.jpg").exists()])
        results[name] = dict(n=len(files), fid=m["frechet_inception_distance"], kid_mean=m["kernel_inception_distance_mean"],
                            clip_mean=statistics.fmean(cs), cv_ms_mean=statistics.fmean(ms), laplacian_var_mean=statistics.fmean(sharp),
                            flagged_share=flagged / len(files), changed_share=changed / len(files))
        print(f"[cv] {name}: FID {m['frechet_inception_distance']:.2f} CLIP {statistics.fmean(cs):.4f} {statistics.fmean(ms):.1f} ms", flush=True)
    (fb.OUT / f"cv_ablation_{a.variant}.json").write_text(json.dumps(results, indent=1))
    base = results["none"]
    lines = [f"# Classical-CV ablation on real {a.variant} outputs", "",
             f"n = {base['n']} images. Reference = real COCO validation photos. Deltas are vs `none`.", "",
             "| CV configuration | FID | ΔFID | KID×1e3 | CLIP | ΔCLIP | CV ms/img | sharpness (Laplacian var) | flagged | pixels changed |",
             "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for k, r in results.items():
        lines.append(f"| {k} | {r['fid']:.2f} | {r['fid'] - base['fid']:+.2f} | {r['kid_mean'] * 1000:.1f} | {r['clip_mean']:.4f} | "
                     f"{r['clip_mean'] - base['clip_mean']:+.4f} | {r['cv_ms_mean']:.1f} | {r['laplacian_var_mean']:.0f} | "
                     f"{100 * r['flagged_share']:.0f}% | {100 * r['changed_share']:.0f}% |")
    (fb.OUT / f"cv_ablation_{a.variant}.md").write_text("\n".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
