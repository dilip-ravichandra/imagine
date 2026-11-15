# CHANGELOG
## P7B
- Added `ai_engine/evaluation/p7b.py` (eval_P3_TeamID.md with USNs on line 1, ablation study in the docs/08 8.5 template, failure analysis from the human review sheet) and `evaluation/scripts/build_p7b_report.py` (exit 1 while any `TODO(team)` or the P7 gate is unresolved).
- Numbers only from real P7A output; missing = NOT RUN / NOT MEASURED; interpretation left to the team; P3/P5B/P6/P8 gaps declared in the eval file.
- Tests: +6 (`test_p7b.py`). Total 401 passed, 1 skipped. No other code changed.
## P7A
- Added `ai_engine/evaluation/{variants,harness,metrics,sizes,report,cv_pipelines,dryrun}.py`: variant grid V0-V7 (V6 adapter and V7 controller blocked, reported NOT RUN), run harness with warm-up/repeats/separate model-load and CV timing, CLIP once per (prompt, seed) incl. raw-vs-CV scoring, FID gate that refuses tiny samples, paired deltas with prompt-cluster bootstrap CI, model-size report, mechanical Markdown/JSON/CSV report, blank human-review sheet, failure-log template, quality-vs-cost plot.
- Added `evaluation/scripts/run_p7_eval.py` (refuses unpinned MODEL_REVISION; `--dry-run` synthetic) and `analyze_p7_results.py` (gate exit code), `docs/P7A_EVAL.md`.
- `requirements.txt` + matplotlib; `.gitignore` + `evaluation/results/p7/images/`; README, PHASE_TRACKER updated.
- Tests: +40 (`test_p7_metrics/variants_sizes/harness/report/cli.py`). Total 395 passed, 1 skipped. No backend/API/engine/CV change.
## P5A
- Added `computer_vision/common.py` (CVResult, validation, PIL helpers), `resize/resize.py`, `enhancement/enhance.py`, `edge_aware/edges.py` (+ package `__init__`s).
- Added `evaluation/scripts/demo_cv_p5a.py` and committed synthetic demo outputs in `evaluation/results/p5a/`.
- Added `docs/P5A_CV.md`; README, PHASE_TRACKER, API_CONTRACT note updated; `requirements.txt` + numpy, opencv-python-headless.
- Tests: +61 (`test_cv_resize/enhance/edge/compose.py`). Total 355 passed, 1 skipped. No backend/API/engine change.
- During testing, 5 first-draft test premises were wrong (not the code) and were corrected from measured behaviour; no module code changed because of them.
## P4
- Added `ai_engine/optimization/{config,policy,experiments,stats,benchmark,report}.py`: validated `OptimizationConfig`, torch-free policy, 8-experiment grid (B0 baseline, E1-E6 single-variable, C1 labelled combined), stats + pixel fidelity, benchmark core, mechanical report/gate.
- `backend/app/config.py`: new `Settings` fields + env vars `PRECISION`, `ATTENTION_SLICING`, `VAE_SLICING`, `OFFLOAD`, `WEIGHTS_VARIANT` (invalid values raise at startup). Defaults reproduce P1A.
- `backend/app/services/engine.py`: precision resolution, weight-variant choice, offload (never preceded by `.to(device)`), attention/VAE slicing; `load_info` attribute recorded by benchmarks. Config errors map to the existing safe `INTERNAL_ERROR`.
- Added `evaluation/scripts/run_p4_benchmarks.py` (refuses unpinned `MODEL_REVISION`; one subprocess per experiment) and `analyze_p4_results.py` (gate exit code).
- Added `docs/P4_OPTIMIZATION.md`; API contract: "no API change" note. API version stays 1.0.0; `GenerateResponse` unchanged.
- Tests: +50 (core/policy/settings/stats, engine with fake torch, benchmark/report/CLI with synthetic data). Total 294 passed, 1 skipped.

## P8 (task 08 integration)
- Static integration checks on the combined tree (compileall OK; 125 modules, 0 unresolved internal imports). **Test suite NOT run** (sandbox offline: no pytest/fastapi/pydantic).
- Added `INTEGRATION_REPORT.md`; refreshed README/README_TASK/HANDOFF/TEST_RESULTS/PHASE_TRACKER/FILES_CHANGED for the combined tree. No code, test, API or dependency change.

## P9 (final packaging)
- Added `docs/P9_FINAL/` (README, ARCHITECTURE, DESIGN_DOCUMENT, LICENSE_AND_SECRETS_AUDIT, FINAL_CHECKLIST, DEMO_SCRIPT, VIVA_PREP, CLEAN_SETUP_TEST) and `docs/eval_P3_TeamID_DRAFT.md`.
- Static secret scan: no matches. No code/test/API/dependency change. Final gate NOT MET (see `docs/P9_FINAL/README.md`).

# Safety audit (2026-11-07)
- `ai_engine/optimization/benchmark.py`: `ClipScorer` now requires a pinned revision (`CLIP_REVISION` / `--allow-unpinned`), records it in its label; the 3 runner scripts pass the flag.
- `backend/app/config.py`, `backend/app/main.py`, `.env.example`: optional `API_KEY` -> `X-API-Key` on `/api/v1/*` (default off); `Settings.api_key` hidden from repr; min 16 chars.
- `Dockerfile`: non-root user, healthcheck, no bytecode, no secrets (not built).
- Wording fixes (stale "skipped/NOT DONE"): `ai_engine/evaluation/variants.py`, `p7b.py`, `docs/P7A_EVAL.md`, `docs/P6_ADAPTIVE.md`, `docs/P4_OPTIMIZATION.md`; tests `test_p7_report.py`, `test_p7b.py` updated.
- Added `tests/test_safety.py` (+32), `docs/SAFETY_AND_PHASE_AUDIT.md`; updated `docs/API_CONTRACT_v1.md`, `docs/P9_FINAL/LICENSE_AND_SECRETS_AUDIT.md`, `FINAL_CHECKLIST.md`. Total 698 passed, 1 skipped.
