# Imagine AI cloud deployment

The Modal deployment serves the launched React site, the research dashboard,
the Android APK, and the shared inference API from one URL. Generation runs on
Modal's A10G GPU; the laptop GPU is not used.

## Cost guardrail

Before deploying, open **Modal → Usage & Billing** and set the workspace
**spend limit** to `$0`. This is the hard cap on net charges after credits. A
workspace usage budget is a different limit and does not guarantee `$0`
out-of-pocket. The current Modal CLI/SDK has no spend-limit setter, so verify
the value in the dashboard before running any Modal deployment or model
download command.

The Starter plan currently includes compute credits, and the hard spend limit
stops workloads when they would create out-of-pocket Modal charges. Provider
API keys (Groq/Gemini) are separate accounts and must have their own billing
limits if those APIs are enabled.

## Deploy

Use the existing authenticated Modal profile and Python environment:

```powershell
.\.venv\Scripts\python.exe -m modal deploy modal_deploy.py
```

Before deploying, accept the Stable Diffusion 1.5 model terms on Hugging Face
and put a read token in `.env` as `HF_TOKEN=...`. The pinned SD 1.5 repository
is gated, and the token is needed to download all model files. The deployment
script places that token and configured Groq/Gemini keys in an encrypted Modal
secret. It packages only the backend, research UI, built React assets,
approved LoRA, required catalogue images, and current Android APK. It does not
upload `.env`, training data, or review keys. It creates `.modal-api-key`
locally; keep that file private (it is ignored by Git).

After setting the Modal spend limit and `HF_TOKEN`, download the model files
into the persistent volume, then deploy:

```powershell
.\.venv\Scripts\python.exe -m modal run modal_deploy.py::download_models
.\.venv\Scripts\python.exe -m modal deploy modal_deploy.py
```

Modal returns the public base URL. The three surfaces are:

- React website: `/`
- Research dashboard: `/research`
- Android APK download: `/download/android.apk`

The API is at `/api/v1/*`, with `/health` public. The hosted web pages ask for
the API key on the first API request. In Android, open Server Configuration,
enter the same base URL (with trailing slash) and API key, then save. The APK
is the currently built debug APK.

## Verify after deployment

Open `/health`, `/`, `/research`, and `/download/android.apk`. Confirm the
React site and dashboard load, then use the model selector to generate with
SD-Turbo, SD 1.5, SD 1.5 LCM, and the approved SD 1.5 LoRA (weight `0.25`).
Generation requests stay on the cloud GPU and the service scales to zero after
60 seconds without requests.
