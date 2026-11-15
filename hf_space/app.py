"""Hugging Face Gradio Space wrapper around the existing Imagine AI service."""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

SPACE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(SPACE_ROOT))

os.environ.setdefault("HF_SPACE_RUNTIME", "1")
os.environ.setdefault("IMAGINEAI_HOSTED_VARIANTS", "1")
os.environ.setdefault("MODEL_ID", "stable-diffusion-v1-5/stable-diffusion-v1-5")
os.environ.setdefault("MODEL_REVISION", "451f4fe16113bff5a5d2269ed5ad43b0592e9a14")
os.environ.setdefault("ADAPTER_PATH", "adapters/coco_sd15_lenbalanced_step2500")
os.environ.setdefault("ADAPTER_WEIGHT", "0.25")
os.environ.setdefault("DEVICE", "cuda")
os.environ.setdefault("PRECISION", "fp16")
os.environ.setdefault("WEIGHTS_VARIANT", "fp16")
os.environ.setdefault("PRELOAD_MODEL", "false")
os.environ.setdefault("OUTPUT_DIR", "/tmp/imagineai-generated")

import gradio as gr
import uvicorn

import backend.app.main as main_module
from backend.app.config import load_settings
from backend.app.main import create_app
from runtime import ZeroGPUEngine, generate_on_zerogpu

settings = load_settings()
fastapi_app = create_app(engine=ZeroGPUEngine(settings), settings=settings)

# Both the native Gradio page and existing React/research/Android clients call
# this one decorated function, so inference is always inside a ZeroGPU lease.
def generate_for_api(prompt, model_choice="sd_turbo", seed=None, resolution=512, custom_steps=None, settings=None):
    return generate_on_zerogpu(
        prompt=prompt,
        model_choice=model_choice,
        resolution=resolution,
        seed=seed,
        steps=custom_steps,
    )


main_module.generate_with_model = generate_for_api


def gradio_generate(prompt: str, model_choice: str, resolution: int, seed: int, api_key: str):
    if settings.api_key and not secrets.compare_digest((api_key or "").strip(), settings.api_key):
        raise gr.Error("Enter the API key configured in this Space's Secrets.")
    result = generate_on_zerogpu(
        prompt=prompt.strip(),
        model_choice=model_choice,
        resolution=int(resolution),
        seed=int(seed) if seed is not None else None,
    )
    return result["image"], (
        f"{result['model_choice']} · {result['precision']} · {result['steps']} steps · "
        f"seed {result['seed']} · {result['latency_ms']:.0f} ms"
    )


with gr.Blocks(title="Imagine AI · ZeroGPU", theme=gr.themes.Soft()) as zero_gpu_ui:
    gr.Markdown(
        "# Imagine AI · ZeroGPU\n"
        "Generation runs on Hugging Face ZeroGPU. The existing Imagine AI site, "
        "research dashboard, and Android-compatible API are served from this Space."
    )
    with gr.Tab("Generate"):
        with gr.Row():
            with gr.Column(scale=1):
                prompt_input = gr.Textbox(
                    label="Prompt", placeholder="A quiet cabin beside a lake at sunrise", lines=3, max_lines=5
                )
                model_input = gr.Dropdown(
                    choices=[
                        ("SD-Turbo · quick", "sd_turbo"),
                        ("SD 1.5 · baseline", "sd15_baseline"),
                        ("SD 1.5 · LCM", "sd15_optimized"),
                        ("SD 1.5 · approved LoRA (0.25)", "sd15_adapted"),
                    ],
                    value="sd15_adapted",
                    label="Model",
                )
                resolution_input = gr.Dropdown(
                    choices=[256, 384, 512, 640, 768], value=512, label="Square resolution"
                )
                seed_input = gr.Number(value=2026, precision=0, label="Seed")
                api_key_input = gr.Textbox(label="API key (if configured)", type="password")
                generate_button = gr.Button("Generate image", variant="primary")
            with gr.Column(scale=1):
                image_output = gr.Image(label="Generated image", type="pil")
                status_output = gr.Textbox(label="Run details", interactive=False)
        generate_button.click(
            gradio_generate,
            inputs=[prompt_input, model_input, resolution_input, seed_input, api_key_input],
            outputs=[image_output, status_output],
            api_name="generate_image",
        )
    with gr.Tab("Other clients"):
        gr.Markdown(
            "- [Imagine AI website](/)\n"
            "- [Research dashboard](/research)\n"
            "- [Download Android APK](/download/android.apk)\n"
            "- Android server URL: `https://<your-space-subdomain>.hf.space/`\n\n"
            "In Android Server Configuration, enter that URL. If `API_KEY` is set in "
            "Space Secrets, enter the same value in the app."
        )

zero_gpu_ui.queue(max_size=4)

# Make Gradio's ZeroGPU UI part of the same host without removing FastAPI's
# existing routes. The SPA catch-all must remain after the Gradio mount.
spa_fallback = next(
    (route for route in fastapi_app.router.routes if getattr(route, "name", None) == "react_route_fallback"),
    None,
)
if spa_fallback is not None:
    fastapi_app.router.routes.remove(spa_fallback)
fastapi_app = gr.mount_gradio_app(fastapi_app, zero_gpu_ui, path="/zero-gpu")
if spa_fallback is not None:
    fastapi_app.add_api_route(
        "/{frontend_path:path}", spa_fallback.endpoint, methods=["GET"],
        include_in_schema=False, name="react_route_fallback",
    )

app = fastapi_app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")), workers=1)
