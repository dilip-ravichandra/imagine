# Imagine AI — resource-efficient text-to-image for mobile (Problem Statement P3)

> *Your imagination. Our intelligence.* A hybrid edge-server text-to-image system: lightweight clients (web, dashboard,
> Android) talk to a GPU server that runs an **optimised, budget-aware** diffusion pipeline, compared quantitatively with an
> unoptimised Stable Diffusion 1.5 baseline.

## What the problem asks, and where each part lives

| P3 requirement | Where it is |
|---|---|
| Lightweight diffusion model, pretrained + meaningful adaptation | SD-Turbo, SD1.5 + LCM-LoRA, our COCO LoRA, our warm-started LCM distillation (`ai_engine/training/`) |
| Prompt encoding, conditional generation, optimised inference | `backend/app/services/`, `ai_engine/` |
| ≥ 2 optimisation strategies + baseline comparison | fp16, few-step distillation (LCM / SD-Turbo), int8 weight-only, TAESD decoder → `evaluation/reports/eval_P3_*.md` |
| Classical CV (resize, enhance, edge-aware, quality, artifacts) | `computer_vision/` + measured ablation (`evaluation/results/fid/cv_ablation_O4.md`) |
| Complex prompts, semantic consistency | prompt parser (`ai_engine/prompt`) + detector-based compositional benchmark (`run_compositional_eval.py`) |
| Adaptive generation + fallback | `ai_engine/adaptive/` (measured hardware profile, fallback ladder) + Stress Lab page |
| CLIP, FID, latency, peak memory, size, quality-vs-cost | `evaluation/scripts/run_fid_benchmark.py` → `evaluation/results/fid/fid_results.md` |
| Failure analysis, ablation | `evaluation/reports/failure_analysis.md`, `ablation_study.md`, `evaluation/results/compositional/failures.md` |

**Benchmark = the unoptimised pretrained model:** SD 1.5 (rev `451f4fe1…`), fp32, 30 PNDM steps, CFG 7.5, 512 px.
All variants use the same 300 held-out COCO validation captions and seeds. See the generated report for the numbers.

## Quick start

### One command (Docker, CPU: API + website + dashboards)
```bash
docker build -t imagineai . && docker run --rm -p 8000:8000 -e API_KEY=change-me imagineai
# GPU generation: docker build --build-arg INSTALL_ML=1 ...  and run with --gpus all
```

### Local (Windows PowerShell)
```powershell
python -m venv .venv ; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install torch --index-url https://download.pytorch.org/whl/cu128   # RTX 50-series needs CUDA 12.8+ build
pip install -r requirements-ml.txt
cd frontend ; npm ci ; npx vite build ; cd ..
$env:IMAGINEAI_HOSTED_VARIANTS="1"; uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000/` (React site) or `/research` (research dashboard). Without ML packages the server still starts;
`generate` then returns a stable 503 and the measured-results pages keep working.

## Pages (all read live data from the API)
`/` landing · `/create` generator · `/gallery` · `/research` **Model Performance** (measured FID/KID/CLIP/latency/VRAM/size) ·
`/training` **real** adapter runs and dataset manifests · `/admin` live system status · research dashboard tabs:
Generate, Batch hold-out, **Stress Lab** (adaptive budget), Pipeline, Model Comparison, Robustness, Failure analysis, Catalogue.
Sign-in is a demo (no passwords are verified).

## Reproduce the evaluation
```powershell
python evaluation/scripts/run_fid_benchmark.py --generate --latency --score --n 300 --variants B0,B1,O8,O4,O2,Q4,O4T,T1,T2
python evaluation/scripts/run_compositional_eval.py --generate --score --variants B0,O4,T1,T2,Q4
python evaluation/scripts/run_cv_ablation.py --variant O4
python evaluation/scripts/mobile_feasibility.py
python evaluation/scripts/build_eval_report.py --usns 1MS22CS001,1MS22CS002 --team-id <TeamID>
```
Training our own few-step adapter (warm-started LCM distillation, 8 GB GPU settings): see `docs/COLAB_LCM_SPEED_FINETUNE.md`
and `ai_engine/training/lcm_warmstart.py`.

## Tests
`python -m pytest -q` (no weights needed; ~700 tests). Real-model smoke: `RUN_REAL_MODEL=1 pytest tests/test_real_model_smoke.py -m real_model`.

## Android
`android/` (Jetpack Compose). Open in Android Studio (JDK 17), set the server URL in Settings (`http://10.0.2.2:8000/` for the
emulator, the laptop LAN IP for a phone). **Not benchmarked on a physical phone.**

## Honest limitations (read before the demo)
- **Hybrid, not on-device.** Generation runs on a GPU server; the on-device question is answered only analytically
  (`evaluation/reports/mobile_feasibility.md`, estimates).
- **FID on a few hundred images is biased and noisy.** Use it to rank variants evaluated identically; KID is reported alongside.
- **Latency is from a laptop GPU** that throttles at ~87 °C; we report cool-start controlled latency and keep sustained numbers.
- **Classical CV barely moves FID/CLIP** on generated images (|ΔFID| < 0.5) and costs 95–230 ms; it is opt-in and gated, not default.
- **int8 weight-only quantisation was slower** than fp16 on this GPU (smaller, but not faster).
- The compositional checker (detector + CLIP) is imperfect; compare variants against each other, not against ground truth.
- Models carry their own licences (SD1.5 CreativeML Open RAIL-M; SD-Turbo non-commercial research licence). The COCO training
  data has per-image licences listed in the dataset manifest. Image generators can reproduce biases of their training data.

## Repository map
`backend/` FastAPI · `frontend/` React site · `ai_engine/` prompt, adaptive, optimisation, training · `computer_vision/` classical CV ·
`evaluation/` scripts, prompts, results, reports · `android/` · `hf_space/` Hugging Face Space packaging · `docs/` design docs.
Design document: `docs/P9_FINAL/DESIGN_DOCUMENT.md`; architecture: `docs/P9_FINAL/ARCHITECTURE.md`.
