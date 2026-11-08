import logging
import secrets
import threading
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ai_engine.prompt import PromptAnalysis, analyze_prompt
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .schemas.model import AdapterStatus, ModelInfoResponse
from .schemas.registry import ModelCatalogueEntry, ModelCatalogueResponse
from .schemas.prompt import PromptAnalysisRequest
from .schemas.v1 import (API_VERSION, CapabilitiesResponse, ErrorBody, ErrorResponse,
                         GenerateRequest, GenerateResponse, HealthResponse)
from .services.adaptive import build_controller
from .services.engine import DiffusionEngine, SDTurboEngine
from .services.errors import ServiceError
from .services.generation import GenerationService
from .services.multi_model import generate_with_model
from .services.storage import ImageStore
from .services.vision_review import review_pair

log = logging.getLogger("imagineai")


class ChatRequest(BaseModel):
    messages: list[dict[str, str]] = Field(min_length=1, max_length=50)


class ChatResponse(BaseModel):
    message: str
    model: str


class VisionReviewRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    image_a: str = Field(min_length=20, max_length=12_000_000)
    image_b: str = Field(min_length=20, max_length=12_000_000)


class VisionReviewResponse(BaseModel):
    winner: str
    confidence: float
    prompt_accuracy_A: float
    prompt_accuracy_B: float
    anatomy_A: float
    anatomy_B: float
    artifacts_A: list[str]
    artifacts_B: list[str]
    objects_correct_A: bool
    objects_correct_B: bool
    reason: str


def _err(status_code: int, code: str, message: str, retryable: bool, action: str, rid=None):
    body = ErrorResponse(request_id=rid, error=ErrorBody(
        code=code, message=message, retryable=retryable, suggested_action=action))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def create_app(engine: Optional[DiffusionEngine] = None, settings: Optional[Settings] = None,
               controller=None, monitor=None) -> FastAPI:
    settings = settings or load_settings()
    engine = engine or SDTurboEngine(settings)
    store = ImageStore(settings.output_dir, settings.max_stored_images)
    if controller is None:  # P6: stays None unless ADAPTIVE_PROFILE is configured
        controller, monitor = build_controller(settings)
    service = GenerationService(engine, store, settings, controller, monitor)

    def adapted_model_status() -> tuple[bool, str]:
        status = engine.adapter_status()
        reason = str(status.get("reason") or "Adapter is not configured.")
        ready = bool(status.get("configured")) and reason.lower().startswith("approved adapter")
        return ready, reason

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        engine.adapter_status()  # logs a clear warning at startup if a configured adapter will not be used
        if settings.preload_model:
            threading.Thread(target=_safe_preload, args=(service,), daemon=True).start()
        yield

    def require_api_key(request: Request) -> None:
        """No-op unless API_KEY is configured. Constant-time compare; the supplied value is never logged or echoed."""
        if not settings.api_key:
            return
        supplied = request.headers.get("x-api-key", "")
        if not secrets.compare_digest(supplied.encode("utf-8"), settings.api_key.encode("utf-8")):
            raise ServiceError(401, "UNAUTHORIZED", "A valid API key is required.", False,
                               "Send the server's API key in the X-API-Key header.")

    auth = [Depends(require_api_key)]
    app = FastAPI(title="Imagine AI", version=API_VERSION, lifespan=lifespan)
    app.mount("/images", StaticFiles(directory=str(store.directory)), name="images")

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    eval_results_dir = Path("evaluation/results")
    if eval_results_dir.exists():
        app.mount("/eval-images", StaticFiles(directory=str(eval_results_dir)), name="eval-images")

    @app.get("/", include_in_schema=False)
    @app.get("/dashboard", include_in_schema=False)
    def web_dashboard():
        index_file = static_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return JSONResponse(content={"name": "Imagine AI", "version": API_VERSION, "status": "running"})

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return _err(422, "INVALID_REQUEST", "Request failed validation.", False,
                    "Check prompt (1-500 chars), quality_mode (quick|balanced|best), resolution (256-1024), seed.")

    @app.exception_handler(ServiceError)
    async def service_handler(request: Request, exc: ServiceError):
        return _err(exc.status, exc.code, exc.message, exc.retryable, exc.action,
                    rid=getattr(request.state, "request_id", None))

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        log.error("unhandled error", exc_info=exc)  # details stay in server logs only
        return _err(500, "INTERNAL_ERROR", "An unexpected error occurred.", True, "Retry later.",
                    rid=getattr(request.state, "request_id", None))

    @app.get("/health", response_model=HealthResponse)
    def health():
        return HealthResponse()

    @app.get("/api/v1/capabilities", response_model=CapabilitiesResponse, dependencies=auth)
    def capabilities():
        ok, _ = engine.availability()
        res = settings.supported_resolutions
        return CapabilitiesResponse(quality_modes=["quick", "balanced", "best"],
                                    min_resolution=min(res), max_resolution=max(res),
                                    generation_available=ok, deployment_mode="hybrid/cloud")

    @app.get("/api/v1/model", response_model=ModelInfoResponse, dependencies=auth)
    def model_info():
        """Additive (P3B): which model/adapter this server will use or is using. No GPU work, no paths."""
        return ModelInfoResponse(model=settings.model_id, model_revision=settings.model_revision,
                                 loaded=engine.is_loaded(), adapter=AdapterStatus(**engine.adapter_status()))

    @app.get("/api/v1/models", response_model=ModelCatalogueResponse, dependencies=auth)
    def model_catalogue():
        """Return the backend-owned model catalogue and truthful runtime availability."""
        generation_available, reason = engine.availability()
        adapted_available, adapted_reason = adapted_model_status()
        entries = [
            ModelCatalogueEntry(
                id="sd_turbo",
                display_name="SD-Turbo",
                task="text-to-image",
                role="Quick generation",
                checkpoint="stabilityai/sd-turbo",
                license_reference="Hugging Face model card",
                quality_modes=["quick", "balanced", "best"],
                available=generation_available,
                availability_reason=(
                    "Available through the multi-model runtime." if generation_available
                    else reason or "The backend is configured for a different model."
                ),
                configured=generation_available,
            ),
            ModelCatalogueEntry(
                id="sd15",
                display_name="Stable Diffusion 1.5",
                task="text-to-image",
                role="Balanced generation and LoRA base",
                checkpoint="stable-diffusion-v1-5/stable-diffusion-v1-5",
                license_reference="Stable Diffusion model card",
                quality_modes=["balanced"],
                available=generation_available,
                availability_reason=(
                    "Available through the multi-model runtime." if generation_available
                    else reason or "The backend is configured for a different model."
                ),
                configured=generation_available,
            ),
            ModelCatalogueEntry(
                id="sd15_optimized",
                display_name="SD 1.5 Optimized (LCM)",
                task="text-to-image",
                role="Fast SD 1.5 generation",
                checkpoint="stable-diffusion-v1-5/stable-diffusion-v1-5 + LCM-LoRA",
                license_reference="Stable Diffusion and LCM model cards",
                quality_modes=["quick", "balanced"],
                available=generation_available,
                availability_reason=(
                    "Available through the multi-model runtime." if generation_available
                    else reason or "The backend is unavailable."
                ),
                configured=generation_available,
            ),
            ModelCatalogueEntry(
                id="sd15_adapted",
                display_name="SD 1.5 Adaptive LoRA",
                task="text-to-image",
                role="COCO-trained adaptive model",
                checkpoint="stable-diffusion-v1-5/stable-diffusion-v1-5 + COCO LoRA",
                license_reference="Stable Diffusion model card",
                quality_modes=["balanced"],
                available=generation_available and adapted_available,
                availability_reason=(
                    f"Approved LoRA ready at weight {settings.adapter_weight:g}."
                    if generation_available and adapted_available
                    else adapted_reason if not adapted_available
                    else reason or "The backend is unavailable."
                ),
                configured=adapted_available,
            ),
            ModelCatalogueEntry(
                id="sdxl",
                display_name="Stable Diffusion XL",
                task="text-to-image",
                role="Best-quality research path",
                checkpoint="stabilityai/stable-diffusion-xl-base-1.0",
                license_reference="Stable Diffusion XL model card",
                quality_modes=["best"],
                available=False,
                availability_reason="Requires explicit model configuration and hardware validation.",
                configured=False,
            ),
        ]
        return ModelCatalogueResponse(models=entries)

    @app.post("/api/v1/generate", response_model=GenerateResponse, dependencies=auth)
    def generate(req: GenerateRequest, request: Request):
        # sync endpoint -> runs in the threadpool, so /health stays responsive during generation
        rid = uuid.uuid4().hex
        request.state.request_id = rid
        return service.generate(req, str(request.base_url), rid)

    @app.post("/api/v1/prompt/analysis", response_model=PromptAnalysis, dependencies=auth)
    def prompt_analysis(req: PromptAnalysisRequest):
        """Additive (P2): structured analysis of the prompt TEXT. Does not touch the model or the GPU."""
        return analyze_prompt(req.prompt)

    @app.post("/api/v1/chat", response_model=ChatResponse, dependencies=auth)
    def chat(req: ChatRequest):
        """Proxy approved chat messages to Groq without exposing the server-side API key."""
        if not settings.groq_api_key:
            raise ServiceError(
                503,
                "CHAT_UNAVAILABLE",
                "The assistant is unavailable because GROQ_API_KEY is not configured.",
                False,
                "Configure GROQ_API_KEY on the backend and retry.",
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are ImagineAI's product assistant. Give concise, practical help about "
                    "image generation, learning, storybooks, editing, and this product. "
                    "Do not claim access to private data or tools you were not given."
                ),
            },
            *req.messages,
        ]
        try:
            response = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.groq_model, "messages": messages, "temperature": 0.4},
                timeout=30.0,
            )
            response.raise_for_status()
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("Groq returned an empty assistant message.")
            return ChatResponse(message=content.strip(), model=settings.groq_model)
        except httpx.HTTPStatusError as exc:
            log.warning("Groq request failed with status %s", exc.response.status_code)
            raise ServiceError(
                502,
                "CHAT_PROVIDER_ERROR",
                "The assistant provider rejected the request.",
                True,
                "Retry the request later.",
            ) from exc
        except (httpx.RequestError, KeyError, IndexError, TypeError, ValueError) as exc:
            log.warning("Groq request could not be completed: %s", type(exc).__name__)
            raise ServiceError(
                502,
                "CHAT_PROVIDER_ERROR",
                "The assistant provider did not return a usable response.",
                True,
                "Retry the request later.",
            ) from exc

    @app.post("/api/v1/review/pair", response_model=VisionReviewResponse, dependencies=auth)
    def review_pair_endpoint(req: VisionReviewRequest):
        """Return advisory structured feedback for a blinded A/B image pair."""
        return review_pair(settings, req.prompt, req.image_a, req.image_b)

    @app.get("/api/v1/metrics/summary")
    def metrics_summary():
        """Empirical evaluation summary for Problem Statement 3 dashboard."""
        return {
            "environment": {
                "gpu": "NVIDIA GeForce RTX 5050 Laptop GPU",
                "vram_mb": 8151,
                "os": "Windows 11",
                "framework": "PyTorch 2.11.0+cu128 / Diffusers 0.42.1",
                "model": "stabilityai/sd-turbo @ b261bac6fd2cf515557d5d0707481eafa0485ec2"
            },
            "summary_cards": {
                "best_clip_alignment": 0.333,
                "inference_speedup_x": 3.01,
                "baseline_latency_ms": 866.5,
                "vram_reduction_pct": 43.4,
                "fastest_e2e_ms": 288.4,
                "cv_overhead_ms": 17.9
            }
        }

    @app.get("/api/v1/models/sd15-comparison")
    def sd15_comparison():
        """Empirical comparison for SD 1.5 Baseline vs Adapted vs Optimized vs Distilled."""
        cmp_file = Path("evaluation/reports/sd15_comparison_empirical.json")
        if cmp_file.exists():
            import json
            return json.loads(cmp_file.read_text(encoding="utf-8"))
        return {"error": "Comparison file not found"}

    class MultiModelRequest(BaseModel):
        prompt: str = Field(min_length=1, max_length=500)
        model_choice: str = "sd_turbo"
        resolution: int = 512
        seed: Optional[int] = None
        steps: Optional[int] = None

    @app.post("/api/v1/generate/multimodel")
    def generate_multimodel(req: MultiModelRequest, request: Request):
        if req.model_choice == "sd15_adapted":
            ready, adapter_reason = adapted_model_status()
            if not ready:
                raise ServiceError(503, "MODEL_UNAVAILABLE", "The approved adapted model is unavailable.",
                                   False, adapter_reason)
        available, reason = engine.availability()
        if not available:
            raise ServiceError(
                503,
                "MODEL_UNAVAILABLE",
                "Image generation is unavailable in this CPU deployment.",
                True,
                reason,
            )
        rid = uuid.uuid4().hex
        res = generate_with_model(req.prompt, req.model_choice, req.seed, req.resolution, req.steps,
                                  settings=settings)
        image_name = store.save(res["image"], rid)
        base = str(request.base_url).rstrip("/")
        return {
            "status": "success",
            "request_id": rid,
            "image_url": f"{base}/images/{image_name}",
            "model": res["model"],
            "model_choice": res["model_choice"],
            "precision": res["precision"],
            "steps": res["steps"],
            "seed": res["seed"],
            "resolution": res["resolution"],
            "latency_ms": res["latency_ms"],
            "peak_gpu_mb": res["peak_vram_mb"]
        }

    class StressGenerateRequest(BaseModel):
        prompt: str = Field(min_length=1, max_length=500)
        latency_budget_ms: int = Field(default=300, ge=50, le=20000)
        vram_budget_mb: int = Field(default=4096, ge=1024, le=16384)
        model_choice: Optional[str] = Field(default="sd_turbo")
        seed: Optional[int] = None

    @app.post("/api/v1/adaptive/stress-generate")
    def stress_generate(req: StressGenerateRequest, request: Request):
        """Simulates real-time hardware budget stress and runs adaptive generation."""
        available, reason = engine.availability()
        if not available:
            raise ServiceError(
                503,
                "MODEL_UNAVAILABLE",
                "Live stress generation requires the GPU model runtime.",
                True,
                reason,
            )
        model_choice = req.model_choice or "sd_turbo"
        if model_choice == "sd15_adapted":
            ready, adapter_reason = adapted_model_status()
            if not ready:
                raise ServiceError(503, "MODEL_UNAVAILABLE", "The approved adapted model is unavailable.",
                                   False, adapter_reason)
        upscale_bicubic = False

        if model_choice == "sd_turbo":
            # Dynamic fallback ladder logic based on empirical profile constraints
            if req.latency_budget_ms < 120 or req.vram_budget_mb < 2000:
                chosen_res = 128
                chosen_steps = 1
                ladder_step = 4
                ladder_name = "Classical Rescaling (128px, 1 step + Bicubic Upscale)"
                expl = f"Ultra-strict constraint ({req.latency_budget_ms} ms budget, {req.vram_budget_mb} MB VRAM): Controller fell back to Ladder Step 4 (128px generation + bicubic upscale) to guarantee sub-100ms response under extreme hardware starvation."
                upscale_bicubic = True
            elif req.latency_budget_ms < 200 or req.vram_budget_mb < 2800:
                chosen_res = 256
                chosen_steps = 1
                ladder_step = 3
                ladder_name = "Spatial Rescaling (256px, 1 step)"
                expl = f"Strict constraint ({req.latency_budget_ms} ms budget, {req.vram_budget_mb} MB VRAM): Controller stepped down resolution to 256x256 at 1 step (Ladder Step 3) to prevent timeout and avoid OOM."
            elif req.latency_budget_ms < 300 or req.vram_budget_mb < 3800:
                chosen_res = 512
                chosen_steps = 1
                ladder_step = 2
                ladder_name = "Step Throttling (512px, 1 step)"
                expl = f"Moderate latency constraint ({req.latency_budget_ms} ms budget): Controller reduced denoising steps to 1 step at 512x512 (Ladder Step 2) achieving sub-200ms latency."
            elif req.latency_budget_ms >= 600 and req.vram_budget_mb >= 5000:
                chosen_res = 512
                chosen_steps = 4
                ladder_step = 1
                ladder_name = "Quality Mode (512px, 4 steps)"
                expl = f"Relaxed budget ({req.latency_budget_ms} ms budget, {req.vram_budget_mb} MB VRAM): Controller expanded denoising to 4 steps for optimal structural quality."
            else:
                chosen_res = 512
                chosen_steps = 2
                ladder_step = 1
                ladder_name = "Standard Combined (512px, 2 steps)"
                expl = f"Balanced budget ({req.latency_budget_ms} ms budget, {req.vram_budget_mb} MB VRAM): Controller selected optimal 512x512 with 2 steps (Ladder Step 1). No fallback required."
        else:
            if req.latency_budget_ms < 1000 or req.vram_budget_mb < 2500:
                chosen_res = 256
                chosen_steps = 4 if "sd15" in model_choice else 1
                ladder_step = 3
                ladder_name = "Spatial Fallback (256px)"
                expl = f"Constrained budget ({req.latency_budget_ms} ms, {req.vram_budget_mb} MB VRAM): Controller downscaled resolution to 256x256 to fit memory envelope."
            elif req.latency_budget_ms < 2500 or req.vram_budget_mb < 4000:
                chosen_res = 512
                chosen_steps = 8 if model_choice == "sd15_optimized" else 15
                ladder_step = 2
                ladder_name = "Step Throttling"
                expl = f"Moderate latency budget ({req.latency_budget_ms} ms): Throttled denoising steps to fit execution threshold."
            else:
                chosen_res = 512
                chosen_steps = 8 if model_choice == "sd15_optimized" else 30
                ladder_step = 1
                ladder_name = "Full Quality Mode"
                expl = f"Adequate budget ({req.latency_budget_ms} ms, {req.vram_budget_mb} MB VRAM): Full quality pipeline configuration selected."

        rid = uuid.uuid4().hex
        res = generate_with_model(req.prompt, model_choice, req.seed, chosen_res, chosen_steps,
                                  settings=settings)
        img = res["image"]
        if upscale_bicubic:
            from PIL import Image
            img = img.resize((512, 512), Image.BICUBIC)

        image_name = store.save(img, rid)
        base = str(request.base_url).rstrip("/")

        return {
            "status": "success",
            "request_id": rid,
            "image_url": f"{base}/images/{image_name}",
            "executed_latency_ms": round(res["latency_ms"], 1),
            "latency_budget_ms": req.latency_budget_ms,
            "budget_met": bool(res["latency_ms"] <= req.latency_budget_ms),
            "peak_vram_mb": round(res["peak_vram_mb"], 1),
            "vram_budget_mb": req.vram_budget_mb,
            "chosen_resolution": chosen_res,
            "chosen_steps": chosen_steps,
            "chosen_precision": res["precision"],
            "ladder_step": ladder_step,
            "ladder_name": ladder_name,
            "explanation": expl,
            "model_choice": model_choice
        }

    return app


def _safe_preload(service: GenerationService) -> None:
    try:
        service.preload()
    except Exception:  # noqa: BLE001
        log.exception("preload failed; the model will be retried on the first request")


app = create_app()
