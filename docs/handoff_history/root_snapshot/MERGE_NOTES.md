# MERGE_NOTES — combined ImagineAI tree (master pack + P2 + P3B + P5B + P6 + P7B)

Built 2026-11-07 from six uploaded ZIPs. **Read this before trusting any single phase's HANDOFF/TRACKER.**

## 1. Why this was not a plain copy
The ZIPs are **not cumulative**. After P2 the phases branched, and each later ZIP contains only its own lineage:

| ZIP | Built on | Unique contribution |
|---|---|---|
| Master pack | – | docs/, ai_handoff/ task cards, README/Dockerfile scaffold |
| P2 | P1A | prompt parser, 87-prompt suite, `/api/v1/prompt/analysis` (shared base) |
| P3B | P2 | LoRA adapter gate/loader, training scripts, `/api/v1/model` |
| P5B | P4 + P5A | CV quality metrics, artifact detection/correction, `computer_vision/pipeline.py`, `CV_MODE` |
| P6 (folder is named `ImagineAI_P5A_CV_Basics`) | P4 + P5A | adaptive controller, profiles, fallback, `ADAPTIVE_PROFILE` |
| P7B (includes P7A) | P4 + P5A | metrics harness, ablation/failure report generators |

Copying the "latest" ZIP over the rest would have silently dropped P3B, P5B and P6. So: every unique file was placed, and the 19 files that exist in more than one ZIP with different content were merged with a 3-way merge (`git merge-file`; base = P2's copy for P3B, and the P6/P7B-agreed copy for the P5B/P6/P7B group where two of them agree, else P2's copy).

## 2. Hand fixes (textually clean merges that were semantically wrong)
- `backend/app/services/generation.py` `generate()`: P5B's CV hook and P6's controller branch collided (double generate, double save, broken response). Rewritten: controller (or fixed steps) -> then CV hook -> save once -> response with `quality`, `cv_ms` and the controller's `resource_decision`.
- `backend/app/services/engine.py` `ensure_loaded()`: P3B's adapter loader and P4's precision/offload/slicing load path collided. Now `_build_pipe(Auto, device, dtype, variant)` applies P4 settings and `_maybe_attach_adapter(pipe, torch, rebuild)` rebuilds a clean base pipeline **with the same P4 settings** if an adapter fails. (Signature of `_build_pipe`/`_maybe_attach_adapter` changed; no existing test called them directly.)
- `backend/app/config.py`: `adapter_path` field was merged outside the dataclass; moved inside.
- `.gitignore` de-duplicated; `.env.example` keeps the P-phase variables (master pack's blank duplicate keys removed).
- `tests/test_adaptive_api.py` (P6): **pre-existing bug, not caused by the merge.** The P6 handoff lists this test as NOT RUN. It failed on a clean P6 tree because the synthetic profile is for `synthetic/model-a` while the test used the default model id. Test now aligns the settings with the fixture.
- Added `tests/test_merge_integration.py` (4 tests): CV+controller in one request; adapter + P4 settings in one load; failed-adapter rebuild keeps P4 settings; safe defaults.

## 3. Docs: what is where
- Top-level `README.md`, `README_TASK.md`, `HANDOFF_NEXT_CLAUDE.md`, `TEST_RESULTS.md`, `CHANGELOG_TASK.md`, `FILES_CHANGED.txt` are **P7B's**, i.e. they describe only the P7B lineage and still say P3B/P5B/P6 were skipped. They are stale for this combined tree.
- `PHASE_TRACKER.md` was rewritten for the combined tree (statuses taken from each ZIP's own handoff; nothing upgraded).
- Every ZIP's original handoff/tracker/test-result/changelog files are preserved unmodified in `docs/handoff_history/<zip>/`.
- `docs/API_CONTRACT_v1.md` merged cleanly: it contains the P1A, P2, P3B, P4, P5A/5B and P6 notes. API still v1.0.0, still unconfirmed by both developers.

## 4. Test evidence (this sandbox only)
`python -m pytest -q` -> **666 passed, 1 skipped** (the skipped one is the real-SD-Turbo smoke test).
Environment: Ubuntu 24.04, Python 3.12.3, OpenCV 5.0.0, no GPU, no torch/diffusers, no Hugging Face access.
**Not run anywhere:** real SD-Turbo generation, any GPU benchmark (P4/P6/P7), LoRA training, Windows, Android build.
The new integration tests use fake engines/ML stacks: they prove wiring, not GPU behaviour. The hand-merged `engine.py` load path has only been exercised with fakes.

## 5. Known open items (unchanged by the merge)
DL-02 (a trained and reviewed adapter) is still open; no measured benchmark profile exists (controller runs only on the synthetic fixture, which is refused unless `ADAPTIVE_ALLOW_SYNTHETIC=true`); P7B report content is not written; P1A laptop smoke test, `MODEL_REVISION` pin, SD-Turbo license check and PyTorch CUDA 12.8+ build for the RTX 5050 are still human steps; P1B/P8 Android work is outside these ZIPs.
