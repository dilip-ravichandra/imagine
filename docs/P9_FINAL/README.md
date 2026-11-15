# P9 — Final packaging, documentation and demo

Date: 2026-11-07. **P9 final gate: NOT MET.** This folder holds everything that *can* be prepared without real measurements, a phone or a hosted URL. Anything needing those is marked `TODO(team)` or NOT RUN, never filled with invented values.

| File | Purpose | State |
|---|---|---|
| `ARCHITECTURE.md` | Architecture diagram (Mermaid) matching the code as built | Done (reflects code, not measured behaviour) |
| `DESIGN_DOCUMENT.md` | Design decisions, modules, trade-offs, limits | Done; evidence sections say NOT RUN |
| `LICENSE_AND_SECRETS_AUDIT.md` | Secret scan results, licence inventory | Scan done; licence decisions are human TODOs |
| `FINAL_CHECKLIST.md` | docs/12 checklist with evidence per line | Done; mostly unticked, on purpose |
| `DEMO_SCRIPT.md` | 3-minute demo plan + backup rules | Done; needs a rehearsal and NEW unseen prompts |
| `VIVA_PREP.md` | Questions and where the answer lives in the repo | Done |
| `CLEAN_SETUP_TEST.md` | Procedure + log table for the clean-clone test | Procedure only; test NOT RUN |
| `../eval_P3_TeamID_DRAFT.md` | Draft of the graded eval file (USN line is a placeholder) | Skeleton; all results NOT RUN |

## Blocking items (nothing in P9 can close these)
1. **No real measurements exist**: P1A SD-Turbo run, P4, P6 profile, P7 evaluation all NOT RUN.
2. **No reviewed adapter** (DL-02 open): V6 cannot be run, and the "meaningful adaptation" requirement is unmet.
3. **Android is a 14-line skeleton** (`MainActivity.kt`): no network layer, no INTERNET permission, no prompt UI, no image display. P1B/P8 were never delivered. See `ai_handoff/07_CLAUDE_ANDROID_TASK.md`.
4. **No hosted URL**; no physical-device test; deployment mode cannot be labelled with evidence yet (today: hybrid/laptop-server at best).
5. **Team USNs, repo URL, phone model, MODEL_REVISION pin, SD-Turbo licence check** unknown.
6. Test suite not re-run since the merge (see `docs/handoff_history/root_snapshot/INTEGRATION_REPORT.md`).
