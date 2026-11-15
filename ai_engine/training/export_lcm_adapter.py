"""Export a warm-start LCM training checkpoint to a diffusers-loadable LoRA.

The trainer saves PEFT-style keys (`unet.base_model.model.*`) and no alpha. diffusers assumes scale 1, but training used
scale = lora_alpha / rank, so the B matrices are multiplied by that scale on export. Tensors are otherwise unchanged.

    python -m ai_engine.training.export_lcm_adapter adapters/lcm_coco_curated_run/checkpoint-1000/unet_lora adapters/lcm_curated_1000 --alpha 8 --rank 64
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def export(src: Path, dst: Path, alpha: float, rank: int, note: str = "") -> dict:
    from safetensors.torch import load_file, save_file
    sd = load_file(str(src / "pytorch_lora_weights.safetensors"))
    scale = alpha / rank
    out = {}
    for k, v in sd.items():
        k2 = k.replace("unet.base_model.model.", "unet.", 1)
        out[k2] = (v * scale if "lora_B" in k2 else v).contiguous()
    dst.mkdir(parents=True, exist_ok=True)
    save_file(out, str(dst / "pytorch_lora_weights.safetensors"), metadata={"format": "pt"})
    info = dict(kind="warm-started LCM consistency distillation (ours)", base_model="stable-diffusion-v1-5/stable-diffusion-v1-5",
                base_revision="451f4fe16113bff5a5d2269ed5ad43b0592e9a14", init_from="latent-consistency/lcm-lora-sdv1-5",
                source=str(src), lora_B_scale=scale, alpha=alpha, rank=rank, n_tensors=len(out), note=note,
                weights_sha256=hashlib.sha256((dst / "pytorch_lora_weights.safetensors").read_bytes()).hexdigest())
    (dst / "adaptation.json").write_text(json.dumps(info, indent=1), encoding="utf-8")
    return info


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("dst", type=Path)
    ap.add_argument("--alpha", type=float, default=8.0)
    ap.add_argument("--rank", type=int, default=64)
    a = ap.parse_args()
    print(json.dumps(export(a.src, a.dst, a.alpha, a.rank), indent=1))
