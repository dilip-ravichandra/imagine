# Architecture (as implemented in this repo)

**Deployment mode: hybrid edge-server.** Lightweight clients (React website, research dashboard, Android app) send a prompt
to a GPU-backed FastAPI server. Nothing diffusion-related runs on the phone; the on-device question is answered
analytically in `evaluation/reports/mobile_feasibility.md` (estimates, not a phone benchmark).

```mermaid
flowchart TD
    subgraph Clients
        W[React website frontend/]
        D[Research dashboard backend/app/static]
        A[Android app Jetpack Compose android/]
    end
    W & D & A --> API[FastAPI backend/app/main.py<br/>API key, request validation, uniform errors]

    API --> PA[Prompt intelligence ai_engine/prompt<br/>objects, attributes, counts, spatial relations]
    API --> AC{Adaptive controller ai_engine/adaptive<br/>measured hardware profile + live VRAM}
    PA --> AC
    AC -->|budget OK| ENG
    AC -->|tight budget: fewer steps, lower res, smaller model| ENG
    AC -->|no GPU / OOM| FB[Fallback ladder<br/>quick preset, CPU path, explicit 'degraded' flag]
    FB --> ENG

    subgraph ENG[Generation engines backend/app/services]
        T[sd_turbo: SD-Turbo fp16, 1-2 steps]
        L[sd15_optimized: SD1.5 + LCM-LoRA fp16, 4-8 steps]
        M[sd15_adapted: SD1.5 + approved COCO LoRA]
        B[sd15_baseline: SD1.5 fp32, 30 steps - the benchmark]
    end

    ENG --> CV[Classical CV computer_vision/<br/>resize, enhance, edge-aware, quality, artifact detect/correct]
    CV --> ST[storage + gallery services/storage.py, gallery_store.py]
    ST --> RESP[Response: image + generation info + performance + resource_decision + quality]

    subgraph Offline[Offline pipelines]
        TR[Training ai_engine/training<br/>LoRA, LCM distillation, blind-review approval gate]
        EV[Evaluation evaluation/scripts<br/>FID, KID, CLIP, compositional, CV ablation, latency, mobile feasibility]
    end
    TR -->|approved adapter, hash-bound| M
    EV -->|fid_results.json, compositional_results.json| API
```

## Endpoints (API v1)

| Endpoint | Purpose |
|---|---|
| `GET /health`, `/api/v1/capabilities`, `/api/v1/model`, `/api/v1/models` | liveness, limits, active model, model catalogue |
| `POST /api/v1/generate` | text to image with the adaptive controller (production path) |
| `POST /api/v1/generate/multimodel` | explicit model choice: `sd_turbo`, `sd15_optimized`, `sd15_adapted`, `sd15_baseline` |
| `POST /api/v1/generate/img2img`, `/inpaint` | edit paths used by the studio pages |
| `POST /api/v1/prompt/analysis`, `/prompt/enhance` | structured prompt analysis, LLM prompt enhancement |
| `POST /api/v1/adaptive/stress-generate` | Stress Lab: generation under a simulated latency/VRAM budget |
| `GET /api/v1/metrics/benchmark`, `/metrics/summary` | **measured** FID/KID/CLIP/latency/VRAM/size table (read from `evaluation/results/fid/`) |
| `GET /api/v1/training/runs` | **real** adapter training records and dataset manifests |
| `GET/POST/DELETE /api/v1/gallery` | stored generations |

## Order of operations in `generate()`
prompt analysis → adaptive controller (steps, resolution, model, fallback) → engine → optional CV stage (assess/correct) →
save once → response containing `resource_decision` (why this configuration was chosen).

## Opt-in switches
`PRECISION, ATTENTION_SLICING, VAE_SLICING, OFFLOAD, WEIGHTS_VARIANT` (inference optimisation); `CV_MODE=off|assess|correct`;
`ADAPTIVE_PROFILE/POLICY/ALLOW_SYNTHETIC/DECISION_LOG`; `ADAPTER_PATH/ADAPTER_WEIGHT`; `MODEL_REVISION`, `PRELOAD_MODEL`;
`IMAGINEAI_HOSTED_VARIANTS=1` serves the React site at `/`.

## What the diagram deliberately does not claim
No on-device inference, no cloud autoscaling. The hosted demo is a single GPU (laptop or a Hugging Face ZeroGPU Space).
