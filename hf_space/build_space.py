"""Assemble a clean Hugging Face Space checkout without local secrets or eval reviews."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys

sys.path.insert(0, str(ROOT))

from ai_engine.training.adapter import load_approved_adapter
ADAPTER_PATH = "adapters/coco_sd15_lenbalanced_step2500"
MODEL_ID = "stable-diffusion-v1-5/stable-diffusion-v1-5"
MODEL_REVISION = "451f4fe16113bff5a5d2269ed5ad43b0592e9a14"


def copy_tree(source: Path, destination: Path) -> None:
    if not source.is_dir():
        raise FileNotFoundError(f"Required directory is missing: {source.relative_to(ROOT)}")
    shutil.copytree(
        source,
        destination,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".env", ".pytest_cache"),
    )


def build(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    load_approved_adapter(ROOT / ADAPTER_PATH, MODEL_REVISION, MODEL_ID)

    for directory in ("backend", "ai_engine", "computer_vision"):
        copy_tree(ROOT / directory, destination / directory)
    copy_tree(ROOT / "frontend" / "dist", destination / "frontend" / "dist")
    copy_tree(ROOT / ADAPTER_PATH, destination / ADAPTER_PATH)
    copy_tree(
        ROOT / "evaluation" / "results" / "p7" / "images",
        destination / "evaluation" / "results" / "p7" / "images",
    )

    # measured benchmark + compositional + training records read by /api/v1/metrics/benchmark and /api/v1/training/runs
    for rel in ("fid/fid_results.json", "fid/fid_results.md", "compositional/compositional_results.json"):
        src = ROOT / "evaluation" / "results" / rel
        if src.is_file():
            out = destination / "evaluation" / "results" / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, out)
    for adapter_meta in (ROOT / "adapters").glob("*/adaptation.json"):
        out = destination / "adapters" / adapter_meta.parent.name / "adaptation.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(adapter_meta, out)
        approval = adapter_meta.parent / "approval.json"
        if approval.is_file():
            shutil.copy2(approval, out.parent / "approval.json")
    for manifest in (ROOT / "training_data").glob("*/manifest.json"):
        out = destination / "training_data" / manifest.parent.name / "manifest.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(manifest, out)

    comparison = ROOT / "evaluation" / "reports" / "sd15_comparison_empirical.json"
    if comparison.is_file():
        out = destination / "evaluation" / "reports" / comparison.name
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(comparison, out)

    apk = ROOT / "android" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
    if not apk.is_file():
        raise FileNotFoundError("Build the Android debug APK before assembling the Space.")
    apk_out = destination / "android" / "app" / "build" / "outputs" / "apk" / "debug" / apk.name
    apk_out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(apk, apk_out)

    for filename in ("app.py", "runtime.py", "requirements.txt", "README.md"):
        shutil.copy2(Path(__file__).parent / filename, destination / filename)

    forbidden = [
        destination / ".env",
        destination / "evaluation" / "results" / "lora_lenbalanced_final_test" / "review_key.json",
        destination / "evaluation" / "results" / "lora_lenbalanced_valscale_025" / "review_sheet.csv",
    ]
    leaked = [str(path.relative_to(destination)) for path in forbidden if path.exists()]
    if leaked:
        raise RuntimeError(f"Refusing to publish private files: {', '.join(leaked)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "_build",
        help="Output folder that becomes the Hugging Face Space repository root.",
    )
    args = parser.parse_args()
    build(args.output.resolve())
    print(f"Space assembled at {args.output.resolve()}")
