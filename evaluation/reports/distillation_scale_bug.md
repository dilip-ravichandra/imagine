# Failure analysis: first warm-started LCM distillation run (scale mismatch)

**What happened.** The first run of our warm-started LCM distillation (`ai_engine/training/lcm_warmstart.py`, 500 steps, COCO) produced an
adapter that generated noise-like images (D4: FID 252.9, KID×1e3 139.1, CLIP 0.236, compositional 10%; D2: FID 259.3, CLIP 0.239),
far worse than the public LCM-LoRA it started from (O4: FID 121.2, CLIP 0.303).

**Root cause.** The public LCM-LoRA is rank 64 with **alpha 8** (LoRA scale alpha/rank = 0.125). We copied its weights into a
student trained with `--lora_alpha=64` (scale 1.0): the adapter was **8x too strong from step 0**, and training never recovered.

**Correction.** The B matrices of the trained adapter were multiplied by 8/64 = 0.125 so that the effective update uses the scale the
weights were initialised for. This is a post-hoc rescale, not a clean retrain; the corrected adapter is evaluated as variants D4/D2.
`lcm_warmstart.py` now refuses to start when the student alpha/rank differs from the initial LoRA's (use `--lora_alpha=8`).
