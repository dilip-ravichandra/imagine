# HANDOFF UPDATE (P1A Real GPU Run, 2026-11-07)
P1A real SD-Turbo generation is **VERIFIED AND COMPLETE** on the RTX 5050 Laptop GPU (Windows 11, Python 3.12.10, PyTorch 2.11.0+cu128).
Smoke test passed: 512x512 image generated in 323.82 ms warm end-to-end latency (2 steps, fp16). Peak GPU VRAM 3,097.6 MB.
Full pytest suite: **698 passed, 1 skipped** in 15.74s.
Pinned revisions:
- `MODEL_REVISION`: `b261bac6fd2cf515557d5d0707481eafa0485ec2`
- `CLIP_REVISION`: `3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268`
Highest-value next tasks:
1. P4 optimization benchmarks (`evaluation/scripts/run_p4_benchmarks.py`) and P6 profile sweep (`run_p6_profile_sweep.py`).
2. P7A hold-out evaluation (`run_p7_eval.py`) + P5B CV report (`report_cv_p5b.py`).
3. Android client implementation (`ai_handoff/07_CLAUDE_ANDROID_TASK.md`).

---
# HANDOFF UPDATE (safety audit, 2026-11-07)
Read `docs/SAFETY_AND_PHASE_AUDIT.md` first. Test suite re-run: **698 passed, 1 skipped** (the "tests not re-run" blocker is cleared). No phase status changed.
Changes: (F1) CLIP downloads must be pinned: set `CLIP_REVISION` (or `--allow-unpinned`) when using `--clip`. (F2) Optional `API_KEY` env: when set, clients **must send `X-API-Key`** on `/api/v1/*` — **Person 2: add this header in the Retrofit client (read it from build config, never commit it)**. Default is off. (F3) Dockerfile now non-root (unbuilt). (F4) P7/P7B wording corrected: controller, P5B and the gated adapter loader exist; only measured evidence is missing.
Open safety items needing a human before any public hosting: O1 no content moderation, O2 no rate/body limits, O3 HTTPS + manifest, O4 SD-Turbo licence at your pinned revision, O7 Git history scan (see audit §4).
Still the highest-value next tasks: (1) GPU laptop: pin `MODEL_REVISION` + `CLIP_REVISION`, P1A smoke test, P4/P6/P7 runs; (2) Android app (`ai_handoff/07_CLAUDE_ANDROID_TASK.md`); (3) DL-02 adapter.

---
# HANDOFF UPDATE (P9, 2026-11-07)
P9 docs/templates are in `docs/P9_FINAL/`; final gate NOT MET. Blockers: real measurements (P1A/P4/P6/P7), reviewed adapter (DL-02), Android app is a skeleton (P1B/P8 never delivered - highest-value next task is `ai_handoff/07_CLAUDE_ANDROID_TASK.md`), hosted URL, USNs, tests not re-run since merge.

---
# HANDOFF UPDATE (task 08, 2026-11-07)
This is the COMBINED tree (see MERGE_NOTES.md), not only P7B. The text below is P7B's and still says P3B/P5B/P6 were skipped: that is stale; PHASE_TRACKER.md is current. Task 08 added INTEGRATION_REPORT.md; the full test suite was NOT re-run (sandbox offline). First action for the next person: run `pip install -r requirements.txt && python -m pytest -q` and record the real result, then the human GPU steps below.

---
# HANDOFF_NEXT_CLAUDE.md
## Project
Imagine AI — P3 Resource-Efficient Text-to-Image Generation (hybrid/cloud inference).
## Current phase
- P7B — **generators done, report CONTENT NOT WRITTEN** (no real results exist). `python evaluation/scripts/build_p7b_report.py --usns U1,U2` writes `eval_P3_<TeamID>.md`, `ablation_study.md`, `failure_analysis.md` into `evaluation/reports/`; exit 1 until no `TODO(team)` remains and the P7 gate is met. Order: real P7A run -> analyze -> fill `p7_human_review.csv` by eye -> build_p7b_report -> team writes interpretations/failure explanations.
- P7A Metrics harness — **COMPLETE for code + tests; NO real measurements.** Still open from before: P4 measured results NOT RUN, P1A real SD-Turbo run NOT RUN, P0/P1B Android unverified, P3A/P3B/P6 skipped (DL-02 still open), P5B (CV quality metrics + artifact detection) NOT done (P5A modules only).
- Date: 2026-11-07
## Completed
`ai_engine/evaluation/` (variants V0-V7, harness, metrics incl. FID gate + prompt-cluster bootstrap, sizes, report, dry-run engine), `run_p7_eval.py`, `analyze_p7_results.py`, `docs/P7A_EVAL.md`, 40 tests. 395 pass, 1 skipped.
## Files
Key: `ai_engine/evaluation/*.py`, `evaluation/scripts/{run,analyze}_p7_*.py`, `docs/P7A_EVAL.md`, `tests/test_p7_*.py`, `tests/p7_helpers.py`.
## Interfaces
`run_variant(variant, engine, prompts, seeds, repeats, warmup, out_dir, environment, ram_fn, clip, clock, suite_info)`; result schema `p7_variant_result/1`. Report: `build_report/render_markdown`. Details: `docs/P7A_EVAL.md`. API v1.0.0 and backend unchanged.
## Dependencies
New: `matplotlib` (plot only, lazy import). CLIP needs `transformers` + weights (requirements-ml.txt), untested in sandbox.
## Tests
| Command | Status | Notes |
|---|---|---|
| python -m pytest -q | PASS | 395 passed, 1 skipped |
| run_p7_eval.py --all --dry-run ... then analyze | PASS (plumbing) | synthetic, gate correctly NOT MET |
| Real GPU run, real CLIP, model size, Windows | NOT RUN | |
## Known issues
No stage-level latency (engine exposes none; stored null). FID not computable (no real reference set, no Inception extractor; gate refuses). Default sample (20 prompts x 3 seeds x 2 repeats) is small, CIs will be wide. V5 tests P5A auto_enhance only. The 20 hold-out prompts are frozen but now seen: demo needs NEW unseen prompts.
## Decisions
Hold-out split is the default eval set; CLIP once per (prompt, seed) from repeat 0; CV effect measured against the same images pre-CV; bootstrap resamples prompts; synthetic results can never satisfy the gate; blocked variants stay listed as NOT RUN; report is mechanical (no verdicts).
## Exact next task
Human step first (laptop): pin `MODEL_REVISION`, run P1A smoke test, then `run_p7_eval.py --only V0 --clip --prompts-per-category 1 --repeats 1 --warmup 1`, then the full `--all --clip` and `analyze_p7_results.py`; also run P4 (`run_p4_benchmarks.py`) since V1-V4 mirror it. Then P7B (Both): fill `eval_P3_TeamID.md` from `evaluation/reports/p7_report.md`, ablation table (docs/08 section 8.5), failure cases from `p7_human_review.csv`; explicitly declare the V6/V7 gaps (DL-02). Optionally P5B first (CV-04/CV-05 still open).
## Next Claude must read
PROJECT_BRIEF.md, this handoff, `docs/P7A_EVAL.md`, `docs/08_TEST_AND_EVALUATION_PLAN.md`, `evaluation/reports/p7_report.md` (once real).
## Must NOT redo
Scaffold, API schema, engine/service, prompt parser, P4 harness, P5A modules, P7A harness (extend, do not rewrite).
## Missing input
Real SD-Turbo images, GPU results, MODEL_REVISION, real FID reference set (if FID is wanted), repo URL, phone model, contract sign-off, team USNs.
