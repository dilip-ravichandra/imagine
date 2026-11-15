"""Creative endpoints: styles, smart selection (GrabCut), story outline, manga page composition, PDF export."""
from __future__ import annotations

import base64
import io
import re
import uuid
from typing import Optional

import cv2
import numpy as np
from fastapi import Request
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel, Field

from computer_vision.creative.analyze import analyze as cv_analyze
from computer_vision.creative.adjust import adjust as cv_adjust, upscale as cv_upscale
from computer_vision.creative.manga import compose_page
from computer_vision.creative.selection import grabcut_mask, mask_bbox
from computer_vision.creative.stylize import STYLES, apply_style
from .services.errors import ServiceError
from .services.story import generate_outline, scene_prompt

_IMG = re.compile(r"([0-9a-f]{32})\.png")


class SelectRequest(BaseModel):
    image_base64: str
    rect: Optional[list[int]] = Field(default=None, description="[x, y, w, h] around the object, in image pixels")
    stroke_base64: Optional[str] = Field(default=None, description="rough painted selection (white = selected)")


class OutlineRequest(BaseModel):
    idea: str = Field(min_length=3, max_length=800)
    n_scenes: int = Field(default=6, ge=2, le=12)
    genre: str = "adventure"
    art_style: str = "Anime & Manga"


class PanelIn(BaseModel):
    image_url: str
    narration: Optional[str] = None
    dialogue: list[dict] = []
    sfx: Optional[str] = None


class PageRequest(BaseModel):
    title: str = ""
    panels: list[PanelIn] = Field(min_length=1, max_length=8)
    mode: str = "colour"  # colour | bw | ink
    page_no: int = 1


class StylizeRequest(BaseModel):
    image_base64: str
    style: str = "Watercolor"
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    seed: int = 0


class AdjustRequest(BaseModel):
    image_base64: str
    brightness: float = Field(default=0, ge=-100, le=100)
    contrast: float = Field(default=0, ge=-100, le=100)
    saturation: float = Field(default=0, ge=-100, le=100)
    warmth: float = Field(default=0, ge=-100, le=100)
    sharpness: float = Field(default=0, ge=0, le=100)
    denoise: float = Field(default=0, ge=0, le=100)
    auto: bool = False


class UpscaleRequest(BaseModel):
    image_base64: str
    scale: float = Field(default=2.0, ge=1.0, le=4.0)


class AnalyzeRequest(BaseModel):
    image_base64: str


class PdfRequest(BaseModel):
    image_urls: list[str] = Field(min_length=1, max_length=40)
    title: str = "storybook"


def register(app, *, auth, heavy, settings, store, decode_image):
    def load_stored(url: str) -> Image.Image:
        m = _IMG.search(url or "")
        if not m:
            raise ServiceError(400, "INVALID_IMAGE_URL", "Unrecognised image reference.", False, "Use image URLs returned by this server.")
        f = store.directory / f"{m.group(1)}.png"
        if not f.is_file():
            raise ServiceError(404, "IMAGE_NOT_FOUND", "That image is no longer stored on the server.", False, "Regenerate the panel.")
        return Image.open(f).convert("RGB")

    @app.get("/api/v1/styles", dependencies=auth)
    def styles():
        return {"styles": [{"id": s.id, "label": s.label, "description": s.description, "cv_finisher": s.finisher_strength > 0} for s in STYLES.values()]}

    @app.post("/api/v1/cv/select", dependencies=heavy("cv", 60))
    def smart_select(req: SelectRequest):
        """GrabCut: turn a rough box or stroke into an object-accurate mask (classical CV, no model weights)."""
        try:
            img = np.array(decode_image(req.image_base64).convert("RGB"))
            bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            stroke = np.array(decode_image(req.stroke_base64).convert("L")) if req.stroke_base64 else None
        except Exception as e:  # noqa: BLE001
            raise ServiceError(400, "INVALID_IMAGE_DATA", f"Could not decode the image: {e}", False, "Send PNG/JPEG data URLs.")
        if req.rect is None and stroke is None:
            raise ServiceError(400, "SELECTION_REQUIRED", "Provide a rect or a stroke.", False, "Draw a box or paint over the object.")
        m = grabcut_mask(bgr, rect=tuple(req.rect) if req.rect else None, stroke_mask=stroke)
        bb = mask_bbox(m)
        buf = io.BytesIO()
        Image.fromarray(m).save(buf, format="PNG")
        return {"status": "success", "mask_base64": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(),
                "bbox": list(bb) if bb else None, "area_fraction": round(float((m > 0).mean()), 4)}

    def _bgr(data: str) -> np.ndarray:
        try:
            return cv2.cvtColor(np.array(decode_image(data).convert("RGB")), cv2.COLOR_RGB2BGR)
        except Exception as e:  # noqa: BLE001
            raise ServiceError(400, "INVALID_IMAGE_DATA", f"Could not decode the image: {e}", False, "Send a PNG/JPEG data URL.")

    def _save(bgr: np.ndarray, request: Request) -> dict:
        rid = uuid.uuid4().hex
        name = store.save(Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), rid)
        return {"status": "success", "request_id": rid, "image_url": f"{str(request.base_url).rstrip('/')}/images/{name}",
                "width": int(bgr.shape[1]), "height": int(bgr.shape[0])}

    @app.post("/api/v1/cv/stylize", dependencies=heavy("cv", 60))
    def cv_stylize(req: StylizeRequest, request: Request):
        """Apply a style to an existing image with classical CV only (no diffusion, no GPU)."""
        src = _bgr(req.image_base64)
        out = apply_style(src, req.style, seed=req.seed)
        if req.strength < 1.0:
            out = cv2.addWeighted(src, 1 - req.strength, out, req.strength, 0)
        return _save(out, request)

    @app.post("/api/v1/cv/adjust", dependencies=heavy("cv", 60))
    def cv_adjust_endpoint(req: AdjustRequest, request: Request):
        out = cv_adjust(_bgr(req.image_base64), req.brightness, req.contrast, req.saturation, req.warmth, req.sharpness, req.denoise, req.auto)
        return _save(out, request)

    @app.post("/api/v1/cv/analyze", dependencies=heavy("cv", 60))
    def cv_analyze_endpoint(req: AnalyzeRequest):
        """Measured image statistics (sharpness, brightness, contrast, colourfulness, noise, palette)."""
        return {"status": "success", **cv_analyze(_bgr(req.image_base64))}

    @app.post("/api/v1/cv/upscale", dependencies=heavy("cv", 30))
    def cv_upscale_endpoint(req: UpscaleRequest, request: Request):
        return _save(cv_upscale(_bgr(req.image_base64), req.scale), request)

    @app.post("/api/v1/story/outline", dependencies=heavy("story", 10))
    def story_outline(req: OutlineRequest):
        out = generate_outline(settings.groq_api_key, settings.groq_model, req.idea.strip(), req.n_scenes, req.genre, req.art_style)
        for sc in out["scenes"]:
            sc["image_prompt"] = scene_prompt(out, sc)
        return out

    @app.post("/api/v1/story/page", dependencies=heavy("cv", 60))
    def story_page(req: PageRequest, request: Request):
        panels = []
        for p in req.panels:
            panels.append(dict(image=load_stored(p.image_url), narration=p.narration, dialogue=p.dialogue, sfx=p.sfx))
        page = compose_page(panels, req.title, req.page_no, req.mode)
        rid = uuid.uuid4().hex
        name = store.save(page, rid)
        return {"status": "success", "request_id": rid, "image_url": f"{str(request.base_url).rstrip('/')}/images/{name}",
                "width": page.size[0], "height": page.size[1]}

    @app.post("/api/v1/story/pdf", dependencies=heavy("cv", 30))
    def story_pdf(req: PdfRequest):
        pages = [load_stored(u) for u in req.image_urls]
        buf = io.BytesIO()
        pages[0].save(buf, format="PDF", save_all=True, append_images=pages[1:], resolution=150.0, title=req.title)
        return Response(buf.getvalue(), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{re.sub(r"[^A-Za-z0-9_-]", "_", req.title)[:40]}.pdf"'})
