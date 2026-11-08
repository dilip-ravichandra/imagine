"""Launch a LoRA fine-tune of Stable Diffusion 1.5 with a pinned diffusers trainer.

    python -m ai_engine.training.train_lora --data training_data\\p3a_smoke --out adapters\\smoke ^
        --revision <40-char SD 1.5 commit> --preset smoke
    (add --dry-run to print the command and run every check without a GPU)

Status written to <out>/adaptation.json is one of: started | failed | training_completed_not_validated.
There is deliberately NO "validated" status here: only ai_engine.training.compare plus human review
can justify using an adapter (P3B).
"""
import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

from .adapter import SD15_BASE_MODEL, LORA_WEIGHT_NAME, STATUS_DONE, sha256_file
from .data import DataError, assert_no_leakage, load_exclusions

BASE_MODEL = SD15_BASE_MODEL

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
TRAINER = HERE / "third_party" / "train_text_to_image_lora.py"
TRAINER_SHA256 = "a50c34fa31addef037e00f66b345ddb1f4e92628f463f1f9c6a89f19e85f5351"
TRAINER_URL = ("https://raw.githubusercontent.com/huggingface/diffusers/v0.35.1/"
               "examples/text_to_image/train_text_to_image_lora.py")
# UNTUNED starting points, not recommendations. steps counts optimizer updates.
PRESETS = {"smoke": dict(steps=5, accum=1, warmup=0), "small": dict(steps=150, accum=4, warmup=15)}
REQUIRED_MODULES = ("torch", "diffusers", "transformers", "accelerate", "peft", "datasets", "torchvision")


def resolve_settings(a) -> dict:
    """Merge preset and explicit flags, then validate. Raises DataError with a plain message."""
    base = PRESETS.get(a.preset, {})
    pick = lambda v, k: v if v is not None else base.get(k)  # explicit None check: 0 must NOT fall back to the preset
    s = dict(steps=pick(a.steps, "steps"), accum=pick(a.accum, "accum"), warmup=pick(a.warmup, "warmup"),
             rank=a.rank, learning_rate=a.learning_rate, resolution=a.resolution, seed=a.seed,
             checkpoint_every=(a.checkpoint_every if a.checkpoint_every is not None else pick(a.steps, "steps")))
    if None in (s["steps"], s["accum"], s["warmup"]):
        raise DataError("Give --preset or all of --steps, --accum, --warmup")
    if s["steps"] < 1 or s["accum"] < 1 or s["rank"] < 1 or s["learning_rate"] <= 0:
        raise DataError("steps, accum, rank and learning rate must be positive")
    if not 0 <= s["warmup"] < s["steps"] or s["warmup"] > s["steps"] // 2:
        # Upstream defaults warmup to 500 steps; a short run would never reach its learning rate.
        raise DataError("warmup must be 0 <= warmup <= steps/2 (upstream's default of 500 would swamp a short run)")
    if s["resolution"] not in (384, 512):
        raise DataError("resolution must be 384 or 512")
    if s["checkpoint_every"] < 1:
        raise DataError("checkpoint interval must be positive")
    return s


def build_command(a, s: dict) -> list:
    """The exact argv. Flags are explicit so upstream defaults can't silently change the run."""
    data = Path(a.data).resolve()
    return [sys.executable, "-m", "accelerate.commands.launch", "--num_processes=1", "--mixed_precision=fp16",
            str(TRAINER),
            f"--pretrained_model_name_or_path={SD15_BASE_MODEL}", f"--revision={a.revision}", "--variant=fp16",
            f"--train_data_dir={data / 'train'}", "--image_column=image", "--caption_column=text",
            f"--resolution={s['resolution']}", "--center_crop",
            # NOTE: no --random_flip. Flipping turns "left of" into "right of" and corrupts spatial captions.
            # NOTE: no --validation_prompt. Comparison handles validation with the SD 1.5 inference settings.
            "--train_batch_size=1", f"--gradient_accumulation_steps={s['accum']}", "--gradient_checkpointing",
            "--mixed_precision=fp16", f"--rank={s['rank']}", f"--learning_rate={s['learning_rate']}",
            "--lr_scheduler=constant", f"--lr_warmup_steps={s['warmup']}", "--max_grad_norm=1.0",
            f"--max_train_steps={s['steps']}", f"--seed={s['seed']}", "--dataloader_num_workers=0",
            f"--checkpointing_steps={s['checkpoint_every']}", "--checkpoints_total_limit=2",
            "--report_to=none", f"--output_dir={Path(a.out).resolve()}"]


def preflight(a, s: dict, *, check_cuda: bool = True, cuda_available=None) -> list:
    """Return a list of problem strings (empty = ready). Never launches anything."""
    problems = []
    if not re.fullmatch(r"[0-9a-f]{40}", a.revision or ""):
        problems.append("--revision must be the full 40-character commit hash of runwayml/stable-diffusion-v1-5 "
                        "('main' is not reproducible).")
    if not TRAINER.is_file():
        problems.append(f"Vendored trainer missing: {TRAINER}")
    elif sha256_file(TRAINER) != TRAINER_SHA256:
        problems.append("Vendored trainer hash differs from the pinned diffusers v0.35.1 file; do not edit it.")
    data = Path(a.data)
    man = data / "manifest.json"
    if not (data / "train" / "metadata.jsonl").is_file() or not man.is_file():
        problems.append(f"{data} is not a P3A dataset (need train/metadata.jsonl and manifest.json). "
                        "Run ai_engine.training.build_dataset first.")
    else:
        try:
            m = json.loads(man.read_text(encoding="utf-8"))
            ev = load_exclusions(a.eval_prompts or [REPO / "evaluation" / "prompts" / "dataset_prompts.json"])
            assert_no_leakage(m["train"] + m["validation"], ev)  # re-checked at launch, not trusted from build time
            tr = {r["sha256"] for r in m["train"]}
            if tr & {r["sha256"] for r in m["validation"]}:
                problems.append("Train and validation share identical images.")
            seen = s["steps"] * s["accum"]
            if a.preset != "smoke" and seen < 0.5 * len(m["train"]):  # smoke only proves the pipeline
                problems.append(f"This run sees {seen} samples but the set has {len(m['train'])}: under half an epoch. "
                                "Raise --steps/--accum or use a smaller set.")
        except (DataError, KeyError, json.JSONDecodeError) as e:
            problems.append(f"Dataset manifest check failed: {e}")
    if Path(a.out).exists():
        problems.append(f"Output directory already exists (adapters are never overwritten): {a.out}")
    if check_cuda:
        missing = [m for m in REQUIRED_MODULES if importlib.util.find_spec(m) is None]
        if missing:
            problems.append("Missing packages: " + ", ".join(missing) + " (pip install -r requirements-training.txt)")
        else:
            if cuda_available is None:
                import torch
                cuda_available = torch.cuda.is_available()
            if not cuda_available:
                problems.append("No CUDA GPU visible to torch. Use the GPU laptop or Colab. "
                                "(RTX 50-series needs a CUDA 12.8+ torch build.)")
    return problems


def _write_meta(out: Path, meta: dict) -> None:
    (out / "adaptation.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def run(a) -> int:
    try:
        s = resolve_settings(a)
    except DataError as e:
        print("ERROR:", e, file=sys.stderr)
        return 2
    problems = preflight(a, s, check_cuda=not a.dry_run)
    cmd = build_command(a, s)
    if a.dry_run:
        print("DRY RUN: nothing launched, nothing written.")
        print("Settings:", json.dumps(s))
        print("Command:\n ", " ".join(cmd))
        print("Problems:" if problems else "All checks passed (CUDA and packages are not checked in a dry run).")
        for p in problems:
            print(" -", p)
        return 1 if problems else 0
    if problems:
        print("Not launching. Fix these first:", *problems, sep="\n - ", file=sys.stderr)
        return 2
    out = Path(a.out)
    out.mkdir(parents=True)
    import torch
    man = Path(a.data) / "manifest.json"
    meta = dict(base_model=SD15_BASE_MODEL, base_revision=a.revision, settings=s, trainer_url=TRAINER_URL,
                trainer_sha256=TRAINER_SHA256, manifest_sha256=sha256_file(man), command=cmd, status="started",
                gpu=torch.cuda.get_device_name(0), torch=torch.__version__,
                warning="Experimental plain denoising-loss LoRA for Stable Diffusion 1.5; quality must be established "
                        "by held-out comparison and blind review. Keep the base model as default until "
                        "ai_engine.training.compare and human review say otherwise.")
    _write_meta(out, meta)
    with (out / "training.log").open("w", encoding="utf-8") as log:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in proc.stdout:
            print(line, end="", flush=True)
            log.write(line)
        code = proc.wait()
    weights = out / LORA_WEIGHT_NAME
    ok = code == 0 and weights.is_file()
    meta.update(status=STATUS_DONE if ok else "failed", exit_code=code)
    if ok:
        meta.update(adapter_bytes=weights.stat().st_size, adapter_sha256=sha256_file(weights))
    _write_meta(out, meta)
    if not ok:
        print("Training failed; see training.log.", file=sys.stderr)
        return 1
    print("Adapter saved. NOT validated. Next: python -m ai_engine.training.compare ...")
    return 0


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--revision", required=True, help="40-char SD 1.5 commit hash")
    p.add_argument("--preset", choices=sorted(PRESETS))
    p.add_argument("--steps", type=int)
    p.add_argument("--accum", type=int)
    p.add_argument("--warmup", type=int)
    p.add_argument("--rank", type=int, default=4)
    p.add_argument("--learning-rate", type=float, default=5e-5, help="untuned default; see docs/ADAPTATION.md")
    p.add_argument("--resolution", type=int, default=512)
    p.add_argument("--seed", type=int, default=2026)
    p.add_argument("--checkpoint-every", type=int,
                   help="save resumable checkpoints every N optimizer steps (default: final step only)")
    p.add_argument("--eval-prompts", nargs="+")
    p.add_argument("--dry-run", action="store_true")
    return p


if __name__ == "__main__":
    sys.exit(run(parser().parse_args()))
