# Adaptation result

## Candidate and training

| Item | Value |
|---|---|
| Base model + pinned revision | `stable-diffusion-v1-5/stable-diffusion-v1-5` @ `451f4fe16113bff5a5d2269ed5ad43b0592e9a14` |
| Dataset | `training_data/coco_sd15_lenbalanced`; 10,000 train / 1,000 validation. Train captions balanced by length (4,986 short, 5,014 longer). |
| Training settings | 2,500 optimizer steps, accumulation 4, rank 4, LR `2e-5`, 512px, seed 2026; checkpoints at 1,250 and 2,500. About 78 minutes. |
| Runtime | RTX 5050 Laptop GPU, torch 2.11.0+cu128, diffusers 0.35.1 trainer (vendored). |
| Candidate reviewed | `adapters/coco_sd15_lenbalanced_step2500`; SHA-256 `4caf84a78c6a37ce8657bad7245ffdac73ea1fe0b65b0a7b52f829d6d6788ca4` |
| Inference scale evaluated | 0.5 |
| Training completed? | Yes; exit code 0. |

## Fresh held-out comparison

| Item | Value |
|---|---|
| Comparison | `evaluation/results/lora_lenbalanced_final_test` |
| Prompts | 100 planned; 99 valid blind image pairs (one adapted output was filtered). |
| Blind visual review | 99 pairs reviewed. Adapted better: 33; base better: 13; tie: 53. |
| Adapted better-or-tied | 86/99 = 86.9%; exceeds the 70% threshold. |
| Adapted-only failures | 1; threshold is 0. The adapted image for `Flickr30K_test_15834` was filtered while its base image succeeded. |
| AI review outcome | Percentage threshold passes; overall acceptance fails because of the adapted-only filtered output. |
| Systematic-artifact check | No repeated global artifact stood out in the AI visual review. The required human artifact check has not been completed. |
| Approval | Not approved; no `approval.json` was written. |
| Served by default | No. `.env` was not changed; keep the base model as default. |

The 0.5 inference scale is rejected under the existing acceptance rule. Do not remove its filtered pair from the tally to make it pass.

## Conservative scale follow-up

| Item | Value |
|---|---|
| Comparison | `evaluation/results/lora_lenbalanced_valscale_025` |
| Prompts | 60 unused validation captions; 59 valid blind pairs. |
| Blind visual review | 59 pairs. Adapted better: 5; base better: 8; tie: 46. |
| Adapted better-or-tied | 51/59 = 86.4%; exceeds the 70% threshold. |
| Adapted-only failures | 0. One base-only output was filtered. |
| AI review outcome | Quantitative checks pass at inference scale 0.25. |
| Approval | Approved after the user explicitly accepted the AI review; `approval.json` is hash-bound to this adapter. |
| Approval record | `evaluation/results/lora_lenbalanced_valscale_025_user_approved` (separate copy because the IDE held the original review sheet open). |
| Runtime configuration | `.env` selects `adapters/coco_sd15_lenbalanced_step2500` at `ADAPTER_WEIGHT=0.25`. The adapter will become active when the API loads the model. |
| Port 8080 website | `sd15_adapted` is the default model selection; its multi-model route loads the approved adapter at weight 0.25. `/api/v1/models` reports it available. |

Scale 0.25 is the strongest candidate supported by the current fresh comparisons. Runtime supports `ADAPTER_WEIGHT` and reports the configured scale in `/api/v1/model`.

Advisory Codex visual review details are in each comparison folder's `codex_ai_review.json`, `codex_ai_review_summary.json`, and `codex_ai_review.csv`. The user-approved rating sheet and approval inputs are retained in the separate approval-record folder.
