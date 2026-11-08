"""Additive (P3B): GET /api/v1/model. A NEW endpoint, so existing strict clients are unaffected."""
from typing import Optional

from pydantic import BaseModel

from .v1 import API_VERSION


class AdapterStatus(BaseModel):
    configured: bool  # ADAPTER_PATH was set
    active: bool  # an approved adapter is applied to the loaded model
    reason: str  # why it is / is not active; safe text, never a path
    adapter_sha256: Optional[str] = None
    adapter_bytes: Optional[int] = None
    base_revision: Optional[str] = None
    weight: Optional[float] = None


class ModelInfoResponse(BaseModel):
    api_version: str = API_VERSION
    model: str
    model_revision: Optional[str] = None  # the configured pin; None = unpinned
    loaded: bool
    adapter: AdapterStatus
