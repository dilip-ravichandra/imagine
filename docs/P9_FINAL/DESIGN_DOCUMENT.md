# Design document — Imagine AI (P3: resource-efficient text-to-image for mobile)

## 1. Problem and constraints
Generate semantically accurate, realistic images from complex prompts while cutting **latency, memory and model size**
relative to a baseline, without a large loss in prompt alignment, quality or diversity. A public text-to-image API is not
allowed; the optimisation must be ours and measurable. Target: mobile clients. Dev hardware: RTX 5050 Laptop GPU, 8 GB.

## 2. Requirement traceability
See README table. Every mandatory item (A classical CV, B deep learning, C optimisation) and every advanced item
(complex prompts, semantic consistency, latency/memory, degradation study, adaptive strategy, fallback) maps to code and to a
measured artefact in `evaluation/`.

## 3. Benchmark (the "baseline")
The problem statement compares against *a baseline model* without naming one. We define it as the **unoptimised pretrained
model**: Stable Diffusion 1.5 (`451f4fe1…`), fp32, 30 PNDM steps, CFG 7.5, 512×512. Choosing the unmodified pretrained model
makes every claimed gain attributable to our changes. All variants share prompts, seeds, resolution and warm-up policy.

## 4. System architecture
See `ARCHITECTURE.md`. Hybrid edge-server: clients → FastAPI → prompt analysis → adaptive controller → engine
(`sd_turbo`, `sd15_optimized`, `sd15_adapted`, `sd15_baseline`) → optional classical CV → storage → response with a
`resource_decision` that explains the chosen configuration.

## 5. Models and optimisation strategies
| Strategy | Variant IDs | Mechanism |
|---|---|---|
| Reduced precision | B1 | fp32 → fp16 (Tensor Cores) |
| Few-step sampling by consistency distillation | O8, O4, O2 | LCM-LoRA + `LCMScheduler`, CFG 1 (halves UNet work per step) |
| Lightweight / adversarially distilled architecture | T1, T2 | SD-Turbo, 1–2 steps |
| Weight quantisation | Q4 | int8 weight-only UNet (torchao) |
| Latent-space / decoder optimisation | O4T | TAESD tiny VAE decoder |
| Adaptation | A4, D4, D2 | COCO LoRA (ours), warm-started LCM distillation on COCO (ours) |
Each variant changes one thing relative to its parent so the ablation is attributable. Results: generated report.

## 6. Adaptation (fine-tuning) design
- **Data:** COCO captions, length-balanced derivative: 10,000 train / 1,000 validation, a leakage guard against the frozen
  evaluation prompts, per-image licences recorded. Validation captions are the benchmark prompts and are never trained on.
- **LoRA (ours):** SD1.5, rank 4, 2,500 steps, blind pairwise review gate (hash-bound `approval.json`); approved at a conservative scale.
- **Warm-started LCM distillation (ours):** the pinned upstream trainer is unmodified; `ai_engine/training/lcm_warmstart.py`
  initialises the student LoRA from the public LCM-LoRA and continues consistency distillation with the SD1.5 teacher on our COCO
  shards. Rationale: adapt an existing few-step adapter to COCO-style prompts in few steps rather than relearn consistency.
- **Honesty:** an adapter is only reported as better if the benchmark shows it; the approval gate rejects regressions.

## 7. Classical CV
Resize (interpolation chosen by scale direction), enhancement (adaptive CLAHE / white balance / gamma), edge-aware smoothing and
sharpening (bilateral, guided, unsharp with halo guard), quality metrics, artifact detection and guarded correction.
**Measured on real generated images:** no stage changes FID/CLIP beyond noise and each costs 95–230 ms, so CV is an opt-in gated
stage. The artifact detector flags a high share of images (thresholds are uncalibrated) — documented as a limitation.

## 8. Adaptive controller and fallback
A measured hardware profile (steps × resolution → latency, VRAM) plus live VRAM readings select Quick/Balanced/Best settings
under a latency/VRAM budget; a fallback ladder lowers steps/resolution and flags `fallback_used` instead of failing on OOM.
Demonstrated interactively in the Stress Lab and unit-tested.

## 9. Evaluation design
Metrics in the problem-statement order: CLIP similarity, FID (+KID, preferred at small n), latency (median/p95, cool-start
controlled), peak memory, model size, quality-versus-cost. Complex-prompt consistency uses a detector-based compositional
benchmark (single, two-object, counting, colour binding, position) because CLIP cannot verify counts or relations.
Statistical care: same seeds, warm-up discarded, thermal control, small-sample caveats stated.

## 10. Deployment
Hybrid edge-server. Public hosting: Hugging Face Space (ZeroGPU) via `hf_space/` or any GPU host via the Dockerfile. Mobile
feasibility is analytical (`evaluation/reports/mobile_feasibility.md`); no phone benchmark was run.

## 11. Failure analysis
`evaluation/reports/failure_analysis.md` (categories with causes) and auto-extracted compositional failures with image links.
Typical causes: counts and spatial relations fail in single-pass diffusion without layout guidance; colour binding degrades
with very few steps; CLIP does not penalise count errors.

## 12. Limitations and ethics
Not on-device; FID is small-sample; laptop thermal throttling; imperfect automatic checker; non-commercial/restricted licences on
some weights; training data licences are mixed; models can reproduce social biases and can generate misleading images — outputs
should be labelled as AI-generated. Demo sign-in is not real authentication. Secrets are never committed (`.env`, tokens ignored).

## 13. Team contributions (fill before the viva)
Each member must be able to explain: the baseline and metric protocol, one optimisation strategy end-to-end, the adaptive
controller, the CV ablation result, and one failure case. See `VIVA_PREP.md`.
