# FID / KID / CLIP benchmark (measured)

Prompts: held-out COCO validation captions (never used for training). Reference: the matching real photos (center-cropped 512). **FID is computed on a small sample (n shown) and is biased upward; use it to RANK variants under identical conditions, not as an absolute leaderboard number.** KID is the less biased small-sample counterpart.

| ID | Variant | n | FID ↓ | KID×1e3 ↓ | CLIP ↑ | Median ms ↓ | p95 ms | Peak VRAM MB ↓ | Size MB ↓ | Speed-up | VRAM saved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B0 | Baseline: SD1.5 fp32, 30 steps (PNDM, CFG 7.5) | 300 | 112.5 | 5.0 | 0.316 | 10545 | 11007 | 5066 | 4068 | 1.0× | 0% |
| B1 | + fp16 (precision only), 30 steps | 300 | 112.6 | 5.1 | 0.316 | 4303 | 4420 | 2676 | 2034 | 2.5× | 47% |
| O8 | + LCM-LoRA, fp16, 8 steps | 300 | 123.5 | 11.6 | 0.301 | 737 | 748 | 2816 | 2163 | 14.3× | 44% |
| O4 | + LCM-LoRA, fp16, 4 steps | 300 | 121.2 | 9.9 | 0.303 | 451 | 457 | 2816 | 2163 | 23.4× | 44% |
| O2 | + LCM-LoRA, fp16, 2 steps | 300 | 126.1 | 9.1 | 0.301 | 309 | 312 | 2816 | 2163 | 34.1× | 44% |
| Q4 | + LCM-LoRA, fp16, 4 steps, int8 weight-only UNet | 300 | 121.2 | 10.2 | 0.303 | 495 | 498 | 2531 | 1882 | 21.3× | 50% |
| O4T | + LCM-LoRA, fp16, 4 steps, TAESD tiny VAE decoder | 300 | 122.0 | 10.1 | 0.303 | 340 | 348 | 2207 | 2008 | 31.0× | 56% |
| T1 | SD-Turbo fp16, 1 step | 300 | 117.1 | 9.2 | 0.321 | 247 | 249 | 3098 | 2461 | 42.8× | 39% |
| T2 | SD-Turbo fp16, 2 steps | 300 | 119.3 | 10.1 | 0.316 | 313 | 316 | 3097 | 2461 | 33.7× | 39% |
| D4 | ImagineAI-Distilled: SD1.5 + OUR COCO-warm-started LCM-LoRA, fp16, 4 steps | 300 | 120.4 | 9.7 | 0.302 | 487 | 491 | 2817 | 2163 | 21.6× | 44% |
| D2 | ImagineAI-Distilled, fp16, 2 steps | 300 | 128.1 | 9.6 | 0.300 | 334 | 344 | 2816 | 2163 | 31.6× | 44% |
| E500 | ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 500 steps), fp16, 4 steps | 300 | 121.2 | 10.3 | 0.303 | 462 | 514 | 2817 | 2163 | 22.8× | 44% |
| E1000 | ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 1000 steps), fp16, 4 steps | 300 | 121.7 | 11.1 | 0.301 | 481 | 516 | 2816 | 2163 | 21.9× | 44% |
| E1500 | ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 1500 steps), fp16, 4 steps | 300 | 121.9 | 10.8 | 0.302 | 476 | 511 | 2816 | 2163 | 22.2× | 44% |
| E2000 | ImagineAI-Curated: SD1.5 + OUR LCM-LoRA (CV-curated COCO, alpha 8, 2000 steps), fp16, 4 steps | 300 | 122.3 | 11.0 | 0.302 | 499 | 537 | 2816 | 2163 | 21.1× | 44% |
| A4 | ImagineAI-Adapted: SD1.5 + LCM-LoRA + COCO adapter, fp16, 4 steps | 300 | 120.1 | 10.5 | 0.304 | 483 | 488 | 2817 | 2164 | 21.8× | 44% |

GPU: NVIDIA GeForce RTX 5050 Laptop GPU. Latency = end-to-end `pipe()` incl. VAE decode, 512×512, batch 1, 2 warm-up runs discarded.