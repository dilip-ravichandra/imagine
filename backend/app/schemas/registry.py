from pydantic import BaseModel

from .v1 import API_VERSION


class ModelCatalogueEntry(BaseModel):
    id: str
    display_name: str
    task: str
    role: str
    checkpoint: str
    license_reference: str
    quality_modes: list[str]
    available: bool
    availability_reason: str
    configured: bool
    benchmark_variant: str | None = None  # id in evaluation/results/fid (None = not benchmarked as configured here)
    measured: dict | None = None  # FID/KID/CLIP/latency/VRAM/size from the measured benchmark, never hard-coded


class ModelCatalogueResponse(BaseModel):
    api_version: str = API_VERSION
    models: list[ModelCatalogueEntry]
