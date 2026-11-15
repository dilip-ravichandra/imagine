---
title: Imagine AI
emoji: 🎨
colorFrom: purple
colorTo: blue
sdk: gradio
app_file: app.py
python_version: 3.12
license: other
---

# Imagine AI

Hugging Face ZeroGPU hosting for the Imagine AI React website, research
dashboard, Android API, and a Gradio ZeroGPU inference page.

## Routes

- `/` — Imagine AI React site
- `/research` — research dashboard
- `/zero-gpu` — Gradio inference page (ZeroGPU entry point)
- `/download/android.apk` — Android debug APK
- `/api/v1/*` — shared Android/web API

Set `HF_TOKEN` in Space Secrets after accepting access to the pinned Stable
Diffusion 1.5 repository. Optional Space Secrets: `API_KEY`, `GROQ_API_KEY`,
`GROQ_MODEL`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. Do not commit tokens or
provider credentials.

The model weights have their own terms. This Space is marked `other` rather
than Apache-2.0 because the bundled application, SD 1.5 checkpoints, LoRAs,
and evaluation assets do not share one Apache license. Review each upstream
license and the Stable Diffusion 1.5 terms before publishing the Space as
public.

ZeroGPU is shared and quota-limited. It does not provide an always-on A100;
requests queue for dynamically allocated hardware, and free accounts have a
daily GPU quota. See the current [ZeroGPU documentation](https://huggingface.co/docs/hub/en/spaces-zerogpu).
