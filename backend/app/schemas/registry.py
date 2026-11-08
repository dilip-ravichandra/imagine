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


class ModelCatalogueResponse(BaseModel):
    api_version: str = API_VERSION
    models: list[ModelCatalogueEntry]
