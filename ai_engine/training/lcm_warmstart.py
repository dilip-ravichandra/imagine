"""Warm-started LCM distillation (our adaptation of the pinned upstream trainer, which stays byte-identical).

The upstream `train_lcm_distill_lora_sd_wds.py` starts the student LoRA from scratch. Here we instead initialise it from an
existing LCM-LoRA (default: `latent-consistency/lcm-lora-sdv1-5`) and continue consistency distillation on OUR data
(COCO captions, length-balanced, held-out validation excluded) with the SD1.5 teacher. The goal is a few-step adapter that is
better matched to COCO-style prompts than the generic public one, trained in far fewer steps than from scratch.

It patches `peft.get_peft_model` inside the loaded trainer module at runtime; no upstream source is edited, so the
SHA-256 check in the Colab notebook still holds.

Usage (everything after `--init_lora_from X` is passed to the upstream trainer unchanged):
    accelerate launch --mixed_precision=fp16 ai_engine/training/lcm_warmstart.py \
        --init_lora_from latent-consistency/lcm-lora-sdv1-5 --lora_rank 64 --lora_alpha 64 <upstream args...>
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

TRAINER = Path(__file__).parent / "third_party" / "train_lcm_distill_lora_sd_wds.py"


def pop_arg(argv: list[str], name: str):
    """Remove `name VALUE` / `name=VALUE` from argv and return VALUE (None if absent)."""
    for i, a in enumerate(argv):
        if a == name and i + 1 < len(argv):
            v = argv[i + 1]
            del argv[i:i + 2]
            return v
        if a.startswith(name + "="):
            del argv[i]
            return a.split("=", 1)[1]
    return None


def load_lcm_lora_into(peft_unet, source: str) -> dict:
    """Copy an LCM-LoRA (hub id or folder) into the trainable adapter `default` of a PEFT-wrapped UNet."""
    from diffusers import StableDiffusionPipeline
    from diffusers.utils import convert_unet_state_dict_to_peft
    from peft import set_peft_model_state_dict

    sd = StableDiffusionPipeline.lora_state_dict(source, weight_name="pytorch_lora_weights.safetensors")
    sd = sd[0] if isinstance(sd, tuple) else sd
    sd = {k[len("unet."):]: v for k, v in sd.items() if k.startswith("unet.")}
    sd = convert_unet_state_dict_to_peft(sd)
    if hasattr(peft_unet, "base_model") and not any(k.startswith("base_model.") for k in sd):
        sd = {"base_model.model." + k: v for k, v in sd.items()}  # PeftModel wrapper expects the prefixed key space
    res = set_peft_model_state_dict(peft_unet, sd, adapter_name="default")
    unexpected = list(getattr(res, "unexpected_keys", None) or [])
    return dict(n_tensors=len(sd), unexpected=len(unexpected))


def main() -> None:
    init_from = pop_arg(sys.argv, "--init_lora_from")
    spec = importlib.util.spec_from_file_location("upstream_lcm_trainer", TRAINER)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["upstream_lcm_trainer"] = mod
    spec.loader.exec_module(mod)  # defines functions only; upstream guards main() behind __name__ == "__main__"

    if init_from:
        original = mod.get_peft_model

        def patched(model, config, *a, **k):
            if getattr(config, "r", None) == 64 and abs(float(config.lora_alpha) - 8.0) > 1e-6 and "lcm-lora" in str(init_from):
                raise ValueError(
                    "Public LCM-LoRA is rank 64 / alpha 8 (scale 0.125). Training it with lora_alpha="
                    f"{config.lora_alpha} makes it {config.lora_alpha / 8:g}x too strong. Pass --lora_alpha=8.")
            wrapped = original(model, config, *a, **k)
            info = load_lcm_lora_into(wrapped, init_from)
            mod.logger.info(f"Warm-started student LoRA from {init_from}: {info}")
            if info["n_tensors"] == 0 or info["unexpected"] > 0:
                raise RuntimeError(f"LoRA warm-start did not map cleanly: {info}")
            return wrapped

        mod.get_peft_model = patched
    # Windows cannot pickle the trainer's local closures for dataloader workers, and the upstream dataset divides by
    # num_workers. Build with 1 (for the epoch arithmetic) then iterate in-process (num_workers = 0).
    orig_init = mod.SDText2ImageDataset.__init__

    def init_inprocess(self, *a, **k):
        k["num_workers"] = max(1, k.get("num_workers", 1))
        orig_init(self, *a, **k)
        inner = self._train_dataloader.pipeline[0]
        inner.num_workers = 0

    if sys.platform == "win32":  # Linux/Colab can use real dataloader workers
        mod.SDText2ImageDataset.__init__ = init_inprocess
    mod.main(mod.parse_args())


if __name__ == "__main__":
    main()
