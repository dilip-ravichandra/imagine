"""Matched, blind base-vs-adapter comparison on held-out prompts. Decides nothing by itself.

    python -m ai_engine.training.compare --data training_data\\p3a_small --adapter adapters\\small ^
        --out evaluation\\results\\p3a_compare_small --steps 1 4 --seeds 42 43

Same prompts, same seeds, same steps, base vs adapted. Writes images, comparison.json, and a BLIND review
sheet (A/B order randomised, key kept separate). Prompts: the validation captions (held out from training)
plus the evaluation file's dev prompts (also excluded from training). TEST prompts are never used here.
"""
import argparse
import csv
import json
import random
import sys
import time
from pathlib import Path

from .data import DataError
from .adapter import LORA_WEIGHT_NAME, SD15_BASE_MODEL, sha256_file, validate_adapter

REPO = Path(__file__).resolve().parents[2]
DEFAULT_EVAL = REPO / "evaluation" / "prompts" / "dataset_prompts.json"
WARMUP_PROMPT = "A ceramic cup on a wooden table."


def plan_runs(manifest: dict, eval_rows: list, steps_list, seeds, limit: int = 0, eval_only: bool = False) -> list:
    """Held-out prompts x steps x seeds. TEST rows are impossible to include by construction."""
    prompts = [] if eval_only else [
        dict(prompt_id=f"val_{r['image_id']}", prompt=r["caption"], source="validation")
        for r in manifest["validation"]
    ]
    prompts += [dict(prompt_id=r["id"], prompt=r["prompt"], source="dev")
                for r in eval_rows if r.get("split") == "dev"]
    if limit:
        prompts = prompts[:limit]
    if not prompts:
        raise DataError("No held-out prompts to compare")
    ids = [p["prompt_id"] for p in prompts]
    if len(ids) != len(set(ids)):
        raise DataError("Duplicate prompt ids")
    return [dict(p, steps=st, seed=sd) for p in prompts for st in steps_list for sd in seeds]


def build_review(records: list, seed: int = 7) -> tuple:
    """Blind sheet + key + copy plan. A/B order is randomised per pair (deterministically).

    The sheet only ever names neutral files (blind/0001_A.png). Which of base/adapted each one is lives in
    the key, and the key records the source file so run() can make the neutral copies.
    """
    rng = random.Random(seed)
    pairs = {}
    for r in records:
        if r["status"] == "ok":
            pairs.setdefault((r["prompt_id"], r["steps"], r["seed"]), {})[r["variant"]] = r
    sheet, key = [], []
    for n, k in enumerate(sorted(k for k, v in pairs.items() if "base" in v and "adapted" in v), start=1):
        v = pairs[k]
        a_is_base = rng.random() < 0.5
        a, b = (v["base"], v["adapted"]) if a_is_base else (v["adapted"], v["base"])
        pid = f"{k[0]}|steps{k[1]}|seed{k[2]}"
        sheet.append(dict(pair=pid, prompt=v["base"]["prompt"], image_A=f"blind/{n:04d}_A.png",
                          image_B=f"blind/{n:04d}_B.png", better_A_B_tie="", objects_correct_A="",
                          objects_correct_B="", artifacts_A="", artifacts_B="", notes=""))
        key.append(dict(pair=pid, A="base" if a_is_base else "adapted", B="adapted" if a_is_base else "base",
                        A_source=a["image"], B_source=b["image"]))
    return sheet, key


def make_blind_copies(out, sheet: list, key: list) -> None:
    """Copy each pair's images to neutral names so nothing the reviewer sees names the variant."""
    import shutil
    out = Path(out)
    (out / "blind").mkdir(exist_ok=True)
    for row, k in zip(sheet, key):
        shutil.copyfile(out / k["A_source"], out / row["image_A"])
        shutil.copyfile(out / k["B_source"], out / row["image_B"])


def summarize_review(sheet_rows: list, key: list) -> dict:
    """Tally a FILLED review sheet. Unfilled rows are reported, not guessed."""
    who = {k["pair"]: k for k in key}
    tally = dict(adapted_better=0, base_better=0, tie=0, unrated=0)
    for r in sheet_rows:
        v = (r.get("better_A_B_tie") or "").strip().upper()
        k = who.get(r["pair"])
        if v not in ("A", "B", "TIE") or not k:
            tally["unrated"] += 1
        elif v == "TIE":
            tally["tie"] += 1
        else:
            tally["adapted_better" if k[v] == "adapted" else "base_better"] += 1
    rated = tally["adapted_better"] + tally["base_better"] + tally["tie"]
    tally["rated"] = rated
    tally["adapted_not_worse_fraction"] = (tally["adapted_better"] + tally["tie"]) / rated if rated else None
    return tally


def run(a) -> int:  # pragma: no cover - needs GPU, torch, weights
    try:
        meta = validate_adapter(a.adapter, a.revision, SD15_BASE_MODEL)
        manifest = json.loads((Path(a.data) / "manifest.json").read_text(encoding="utf-8"))
        eval_rows = json.loads(Path(a.eval_prompts or DEFAULT_EVAL).read_text(encoding="utf-8"))
        plan = plan_runs(manifest, eval_rows, a.steps, a.seeds, a.limit, a.eval_only)
    except (DataError, OSError, KeyError, json.JSONDecodeError) as e:
        print("ERROR:", e, file=sys.stderr)
        return 2
    out = Path(a.out)
    if out.exists():
        print("ERROR: choose a new output directory", file=sys.stderr)
        return 2
    import torch
    from diffusers import AutoPipelineForText2Image
    if not torch.cuda.is_available():
        print("ERROR: CUDA GPU required", file=sys.stderr)
        return 2
    out.mkdir(parents=True)
    (out / "base").mkdir()
    (out / "adapted").mkdir()
    pipe = AutoPipelineForText2Image.from_pretrained(SD15_BASE_MODEL, revision=meta["base_revision"],
                                                     torch_dtype=torch.float16, variant="fp16").to("cuda")
    pipe.set_progress_bar_config(disable=True)
    records = []
    for variant in ("base", "adapted"):
        if variant == "adapted":
            pipe.load_lora_weights(str(a.adapter), weight_name=LORA_WEIGHT_NAME)
            pipe.set_adapters("default_0", adapter_weights=a.adapter_weight)
        with torch.inference_mode():  # warm-up, not recorded
            pipe(WARMUP_PROMPT, num_inference_steps=1, guidance_scale=7.5, width=512, height=512,
                 generator=torch.Generator("cpu").manual_seed(0))
        for i, r in enumerate(plan):
            torch.cuda.synchronize()
            torch.cuda.reset_peak_memory_stats()
            t = time.perf_counter()
            status, image_name = "ok", f"{variant}/{i:05d}.png"
            try:
                with torch.inference_mode():
                    res = pipe(r["prompt"], num_inference_steps=r["steps"], guidance_scale=7.5, width=512, height=512,
                               generator=torch.Generator("cpu").manual_seed(r["seed"]))  # same seed semantics as engine.py
                torch.cuda.synchronize()
                if getattr(res, "nsfw_content_detected", None) and any(res.nsfw_content_detected):
                    status = "filtered"
                else:
                    res.images[0].save(out / image_name)
            except Exception as e:  # noqa: BLE001 - recorded, never hidden
                status = "failed:" + type(e).__name__
            records.append(dict(r, variant=variant, status=status, image=image_name if status == "ok" else None,
                                inference_ms=(time.perf_counter() - t) * 1000,
                                peak_cuda_mib=torch.cuda.max_memory_allocated() / 2**20))
            (out / "comparison.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    sheet, key = build_review(records)
    make_blind_copies(out, sheet, key)
    with (out / "review_sheet.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(sheet[0]))
        w.writeheader()
        w.writerows(sheet)
    (out / "review_key.json").write_text(json.dumps(key, indent=2), encoding="utf-8")
    # Binds this comparison to ONE adapter + base revision, so ai_engine.training.approve can refuse a mismatched review.
    (out / "compare_meta.json").write_text(json.dumps(dict(
        adapter_sha256=meta["adapter_sha256"], base_revision=meta["base_revision"], steps=a.steps, seeds=a.seeds,
        adapter_weight=a.adapter_weight, planned_runs=len(plan), pairs_in_sheet=len(sheet)), indent=2), encoding="utf-8")
    (out / "README.txt").write_text(
        "Open only blind/ and review_sheet.csv (not base/, adapted/, comparison.json or review_key.json) until done.\n"
        "A/B order is randomised. Then run\n"
        "ai_engine.training.compare.summarize_review. This folder does not approve the adapter; see docs/ADAPTATION.md.\n"
        "Latency here excludes model load; it is not a benchmark (P4 does that). CLIP scoring is P7.\n", encoding="utf-8")
    bad = [r for r in records if r["status"] != "ok"]
    print(f"Done: {len(records)} records, {len(bad)} not ok. Review: {out / 'review_sheet.csv'}")
    return 0


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", required=True)
    p.add_argument("--adapter", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--revision", help="require the adapter to match this SD 1.5 commit")
    p.add_argument("--steps", type=int, nargs="+", default=[30], choices=range(1, 51))
    p.add_argument("--seeds", type=int, nargs="+", default=[42, 43])
    p.add_argument("--adapter-weight", type=float, default=1.0,
                   help="LoRA influence scale for development comparisons (default: 1.0)")
    p.add_argument("--limit", type=int, default=0, help="first N prompts only (smoke)")
    p.add_argument("--eval-prompts")
    p.add_argument("--eval-only", action="store_true", help="compare only prompts from --eval-prompts")
    return p


if __name__ == "__main__":
    sys.exit(run(parser().parse_args()))
