# Safety audit (2026-11-07)
Read `docs/SAFETY_AND_PHASE_AUDIT.md` first: tests re-run (698 passed, 1 skipped), phases cross-checked, safety fixes applied, open items listed. Optional `API_KEY` and `CLIP_REVISION` are new; defaults keep old behaviour.

---
# Task 08 - Integration of the combined P0-P7B tree
Read `INTEGRATION_REPORT.md` first. In short: static checks passed; the test suite could NOT be run in the sandbox (no network); re-run it on your machine with the commands in section 7 of that report. The text below is the earlier P7A task README and is kept for reference.

---
# P7A — Metrics harness (task README)
Adds `ai_engine/evaluation/` (variants, run harness, CLIP/FID-gate/paired-statistics/size/report), two CLIs, 40 tests and `docs/P7A_EVAL.md`. Backend, API, engine and CV modules are untouched. **No real measurements exist; the harness has run only against fakes and a synthetic engine.** Variants V6 (adapter) and V7 (controller) are blocked by the skipped P3/P6 and are reported as NOT RUN.

## Run / test (Windows PowerShell, repo root; Python 3.10+)
```
pip install -r requirements.txt
python -m pytest -q
python evaluation/scripts/run_p7_eval.py --list
python evaluation/scripts/run_p7_eval.py --all --dry-run --split dev --limit 4     # plumbing only, synthetic
# GPU laptop, real numbers:
$env:MODEL_REVISION="<commit hash>"; python evaluation/scripts/run_p7_eval.py --all --clip
python evaluation/scripts/analyze_p7_results.py
```
