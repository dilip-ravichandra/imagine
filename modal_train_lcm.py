"""Warm-started LCM-LoRA distillation on a Modal GPU (instead of the 8 GB laptop GPU).

    modal volume put imagineai-lcm colab_upload/ImagineAI_LCM/coco_train.tar /coco_train.tar
    modal run modal_train_lcm.py --steps 12            # smoke test, costs cents
    modal run --detach modal_train_lcm.py --steps 2000 # full run (resumes from the volume if interrupted)
    modal volume get imagineai-lcm /exports adapters_modal   # download diffusers-ready adapters

Cost: A10G ~ $1.10/h. Check the workspace spend limit in the Modal dashboard first (see MODAL_DEPLOY_GUIDE.md).
alpha MUST stay 8 (public LCM-LoRA is rank 64 / alpha 8); lcm_warmstart.py refuses other values.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parent
TRAIN = "ai_engine/training"
MODEL_ID = "stable-diffusion-v1-5/stable-diffusion-v1-5"
MODEL_REVISION = "451f4fe16113bff5a5d2269ed5ad43b0592e9a14"
TRAINER_SHA = "91574a77355539f44cacb229596eeb97e59da20ab969b2fe868132aaeb1047ec"

vol = modal.Volume.from_name("imagineai-lcm", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("torch==2.5.1", "torchvision==0.20.1")
    .pip_install("diffusers==0.35.1", "transformers>=4.44,<5", "peft>=0.14", "accelerate>=0.30", "webdataset==1.0.2",
                 "braceexpand==0.1.7", "safetensors", "tensorboard", "huggingface_hub")
    .add_local_file(ROOT / "ai_engine/__init__.py", "/code/ai_engine/__init__.py")
    .add_local_file(ROOT / TRAIN / "__init__.py", f"/code/{TRAIN}/__init__.py")
    .add_local_file(ROOT / TRAIN / "lcm_warmstart.py", f"/code/{TRAIN}/lcm_warmstart.py")
    .add_local_file(ROOT / TRAIN / "export_lcm_adapter.py", f"/code/{TRAIN}/export_lcm_adapter.py")
    .add_local_file(ROOT / TRAIN / "third_party/train_lcm_distill_lora_sd_wds.py",
                    f"/code/{TRAIN}/third_party/train_lcm_distill_lora_sd_wds.py")
)
app = modal.App("imagineai-lcm-train", image=image)


def _token() -> dict:
    t = os.environ.get("HF_TOKEN", "")
    if not t:
        try:
            from huggingface_hub.constants import HF_TOKEN_PATH
            p = Path(HF_TOKEN_PATH)
            t = p.read_text().strip() if p.is_file() else ""
        except Exception:
            pass
    return {"HF_TOKEN": t} if t else {}


@app.function(gpu="A10G", timeout=3 * 3600, retries=modal.Retries(max_retries=3, initial_delay=5.0), volumes={"/data": vol}, secrets=[modal.Secret.from_dict(_token())])
def train(steps: int = 2000, ckpt_every: int = 250, batch: int = 4, accum: int = 2, samples: int = 7000):
    import hashlib

    tar = Path("/data/coco_train.tar")
    assert tar.is_file(), "upload first: modal volume put imagineai-lcm colab_upload/ImagineAI_LCM/coco_train.tar /coco_train.tar"
    trainer = Path(f"/code/{TRAIN}/third_party/train_lcm_distill_lora_sd_wds.py")
    assert hashlib.sha256(trainer.read_bytes()).hexdigest() == TRAINER_SHA, "trainer is not the pinned upstream file"
    out = Path("/data/run_v2" if steps >= 500 else "/data/run_smoke")
    resume = ["--resume_from_checkpoint=latest"] if list(out.glob("checkpoint-*")) else []
    cmd = ["accelerate", "launch", "--num_processes=1", "--mixed_precision=fp16", f"/code/{TRAIN}/lcm_warmstart.py",
           f"--pretrained_teacher_model={MODEL_ID}", f"--teacher_revision={MODEL_REVISION}",
           "--init_lora_from=latent-consistency/lcm-lora-sdv1-5", f"--output_dir={out}",
           f"--train_shards_path_or_url={tar}", "--resolution=512", f"--train_batch_size={batch}",
           f"--gradient_accumulation_steps={accum}", f"--max_train_steps={steps}", f"--max_train_samples={samples}",
           "--learning_rate=1e-5", "--lr_scheduler=cosine", "--lr_warmup_steps=50", "--lora_rank=64", "--lora_alpha=8",
           "--mixed_precision=fp16", "--cast_teacher_unet", "--gradient_checkpointing", f"--vae_encode_batch_size={batch}",
           "--dataloader_num_workers=2", f"--checkpointing_steps={ckpt_every}", "--checkpoints_total_limit=8",
           "--validation_steps=1000000", "--report_to=tensorboard", "--seed=2026"] + resume
    env = dict(os.environ, PYTHONPATH="/code", PYTHONUNBUFFERED="1", HF_HOME="/data/hf")
    r = subprocess.run(cmd, env=env)
    vol.commit()
    if r.returncode != 0:
        raise RuntimeError(f"training failed with exit code {r.returncode} (see the log above)")
    sys.path.insert(0, "/code")
    from ai_engine.training.export_lcm_adapter import export
    exp = Path("/data/exports" if steps >= 500 else "/data/exports_smoke")
    for ck in sorted(out.glob("checkpoint-*"), key=lambda p: int(p.name.split("-")[1])):
        n = ck.name.split("-")[1]
        print("export", n, export(ck / "unet_lora", exp / f"lcm_curated_{n}", alpha=8, rank=64)["n_tensors"], "tensors")
    if (out / "unet_lora").exists():
        export(out / "unet_lora", exp / "lcm_curated_final", alpha=8, rank=64)
    vol.commit()
    return sorted(p.name for p in exp.iterdir())


@app.local_entrypoint()
def main(steps: int = 2000, ckpt_every: int = 250):
    print(train.remote(steps=steps, ckpt_every=ckpt_every))
