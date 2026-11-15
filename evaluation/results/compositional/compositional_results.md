# Compositional accuracy (automatic, GenEval-style)

Checker: OWL-ViT detector + CLIP zero-shot colour on the detected box. Accuracy = share of prompts whose image passes the check. Relative comparison between variants only; the checker is imperfect.

| ID | Variant | single | two objects | counting | colour | position | overall |
|---|---|---:|---:|---:|---:|---:|---:|
| T1 | SD-Turbo fp16, 1 step | 100% | 85% | 25% | 90% | 35% | 67% |
| T2 | SD-Turbo fp16, 2 steps | 100% | 75% | 25% | 90% | 25% | 63% |
| O4 | + LCM-LoRA, fp16, 4 steps | 100% | 55% | 20% | 65% | 10% | 50% |
| Q4 | + LCM-LoRA, fp16, 4 steps, int8 weight-only UNet | 100% | 60% | 20% | 70% | 10% | 52% |
| B0 | Baseline: SD1.5 fp32, 30 steps (PNDM, CFG 7.5) | 100% | 60% | 35% | 75% | 15% | 57% |
| D4 | ImagineAI-Distilled: SD1.5 + OUR COCO-warm-started LCM-LoRA, fp16, 4 steps | 100% | 50% | 35% | 65% | 5% | 51% |