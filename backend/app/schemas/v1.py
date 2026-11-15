"""Frozen API contract v1.0.0. Changes require a version bump + docs/API_CONTRACT_v1.md update."""
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

API_VERSION = "1.0.0"
QualityMode = Literal["quick", "balanced", "best"]


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    quality_mode: QualityMode = "balanced"
    resolution: int = Field(default=512, ge=256, le=1024)
    seed: Optional[int] = Field(default=None, ge=0, le=2**32 - 1)

    @field_validator("prompt")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():  # whitespace-only is effectively empty; the text itself is kept untouched
            raise ValueError("prompt must not be blank")
        return v


class GenerationInfo(BaseModel):
    model: str
    model_revision: str
    precision: str
    scheduler: str
    steps: int
    width: int
    height: int
    seed: int


class PerformanceInfo(BaseModel):
    model_load_ms: Optional[float] = None
    prompt_encode_ms: Optional[float] = None
    denoise_ms: Optional[float] = None
    decode_ms: Optional[float] = None
    cv_ms: Optional[float] = None
    end_to_end_ms: Optional[float] = None
    peak_gpu_mb: Optional[float] = None
    peak_process_ram_mb: Optional[float] = None


class QualityInfo(BaseModel):
    clip_score: Optional[float] = None
    sharpness: Optional[float] = None
    brightness: Optional[float] = None
    contrast: Optional[float] = None
    artifact_flags: Optional[list[str]] = None


class ResourceDecision(BaseModel):
    fallback_used: bool
    reason: Optional[str] = None
    explanation: str


class GenerateResponse(BaseModel):
    status: Literal["success"] = "success"
    request_id: str
    image_url: str  # URL only; never a local file path
    generation: GenerationInfo
    performance: Optional[PerformanceInfo] = None
    quality: Optional[QualityInfo] = None
    resource_decision: ResourceDecision


class ErrorBody(BaseModel):
    code: str  # stable, e.g. INVALID_REQUEST, NOT_IMPLEMENTED, RESOURCE_EXHAUSTED, INTERNAL_ERROR
    message: str  # safe; no paths or stack traces
    retryable: bool
    suggested_action: str


class ErrorResponse(BaseModel):
    status: Literal["error"] = "error"
    request_id: Optional[str] = None
    error: ErrorBody


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    api_version: str = API_VERSION


class CapabilitiesResponse(BaseModel):
    api_version: str = API_VERSION
    quality_modes: list[QualityMode]
    min_resolution: int
    max_resolution: int
    generation_available: bool
    inpainting_available: bool = True
    img2img_available: bool = True
    deployment_mode: str  # truthful label: "hybrid/cloud" (server-side inference)
