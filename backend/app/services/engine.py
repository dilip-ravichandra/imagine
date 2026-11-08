"""Diffusion engine. One model, one pipeline, loaded lazily behind a lock.

torch/diffusers are imported only inside methods so the API and unit tests work without them.
"""
import importlib.util
import logging
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from ai_engine.optimization.policy import (active_optimizations, resolve_precision, validate_runtime,
                                           weights_variant)
from ai_engine.training.adapter import LORA_WEIGHT_NAME, AdapterRejected, load_approved_adapter

from ..config import Settings
from .errors import ServiceError, engine_unavailable, model_load_failed, out_of_memory

log = logging.getLogger("imagineai.engine")


@dataclass
class EngineResult:
    image: object  # PIL.Image.Image
    model: str
    model_revision: str
    precision: str
    scheduler: str
    steps: int
    width: int
    height: int
    seed: int
    peak_gpu_mb: Optional[float] = None  # None when no CUDA / not measured
    adapter_sha256: Optional[str] = None  # set only when an approved adapter produced this image


class DiffusionEngine(ABC):
    @abstractmethod
    def availability(self) -> tuple[bool, str]:
        """(usable, reason-if-not). Must be cheap and must not load the model."""

    @abstractmethod
    def ensure_loaded(self) -> Optional[float]:
        """Load the pipeline if needed. Returns load time in ms only if THIS call loaded it."""

    @abstractmethod
    def generate(self, prompt: str, seed: int, width: int, height: int, steps: int) -> EngineResult:
        ...

    def adapter_status(self) -> dict:
        """P3B. Safe to expose: never contains paths. Engines without adapter support report 'not configured'."""
        return dict(configured=False, active=False, reason="No adapter configured; using the base model.",
                    adapter_sha256=None, adapter_bytes=None, base_revision=None, weight=None)

    def is_loaded(self) -> bool:
        return False


def _import_ml():
    import torch
    from diffusers import AutoPipelineForText2Image
    return torch, AutoPipelineForText2Image


def _is_oom(exc: BaseException, torch) -> bool:
    oom_cls = getattr(getattr(torch, "cuda", None), "OutOfMemoryError", None)
    if oom_cls is not None and isinstance(exc, oom_cls):
        return True
    return isinstance(exc, RuntimeError) and "out of memory" in str(exc).lower()


class SDTurboEngine(DiffusionEngine):
    """stabilityai/sd-turbo via diffusers. guidance_scale=0.0 and no negative prompt (per model card)."""

    def __init__(self, settings: Settings):
        self.s = settings
        self._pipe = None
        self._torch = None
        self._device = "cpu"
        self._precision = "fp32"
        self._load_lock = threading.Lock()
        self.load_info: Optional[dict] = None  # set after a successful load; recorded by P4 benchmarks
        self._adapter: Optional[dict] = None  # approved adapter currently applied, else None
        self._adapter_reason: Optional[str] = None
        self._precheck_reason: Optional[str] = None

    def availability(self) -> tuple[bool, str]:
        for mod in ("torch", "diffusers", "transformers"):
            if importlib.util.find_spec(mod) is None:
                return False, "Install ML dependencies: pip install -r requirements-ml.txt"
        return True, ""

    def ensure_loaded(self) -> Optional[float]:
        if self._pipe is not None:
            return None
        with self._load_lock:  # prevents concurrent pipeline loads
            if self._pipe is not None:
                return None
            ok, reason = self.availability()
            if not ok:
                raise engine_unavailable(reason)
            torch, Auto = _import_ml()
            t0 = time.perf_counter()
            try:
                want = self.s.device
                if want == "cuda" and not torch.cuda.is_available():
                    raise RuntimeError("DEVICE=cuda requested but CUDA is not available")
                device = "cuda" if (want in ("auto", "cuda") and torch.cuda.is_available()) else "cpu"
                precision = resolve_precision(self.s.precision, device,
                                              lambda: bool(torch.cuda.is_bf16_supported()))
                validate_runtime(device, self.s.offload)
                dtype = getattr(torch, {"fp16": "float16", "fp32": "float32", "bf16": "bfloat16"}[precision])
                variant = weights_variant(self.s.precision, precision, self.s.weights_variant)

                def build():  # P4 precision/offload/slicing; also used to rebuild a CLEAN pipeline if an adapter fails
                    return self._build_pipe(Auto, device, dtype, variant)

                pipe, adapter, reason = self._maybe_attach_adapter(build(), torch, build)  # P3B
            except BaseException as exc:  # noqa: BLE001 - translate, never leak details to clients
                log.exception("model load failed")
                self._free(torch)
                if _is_oom(exc, torch):
                    raise out_of_memory() from None
                raise model_load_failed() from None
            self.load_info = {"device": device, "precision": precision, "weights_variant": variant,
                              "optimizations": list(active_optimizations(
                                  precision, self.s.attention_slicing, self.s.vae_slicing, self.s.offload))}
            self._precision = precision
            self._adapter, self._adapter_reason = adapter, reason
            self._torch, self._pipe, self._device = torch, pipe, device  # _pipe last: it is the "loaded" flag
            log.info("model loaded: %s", self.load_info)
            return (time.perf_counter() - t0) * 1000.0

    def _build_pipe(self, Auto, device, dtype, variant):
        """Base pipeline with the P4 optimisation settings applied (precision via dtype, offload, slicing)."""
        kw = dict(torch_dtype=dtype, revision=self.s.model_revision)
        if variant:
            kw["variant"] = variant
        pipe = Auto.from_pretrained(self.s.model_id, **kw)
        if self.s.offload == "none":
            pipe = pipe.to(device)
        elif self.s.offload == "model":
            pipe.enable_model_cpu_offload()  # must NOT be preceded by .to(device)
        else:
            pipe.enable_sequential_cpu_offload()
        if self.s.attention_slicing:
            pipe.enable_attention_slicing()
        if self.s.vae_slicing:
            pipe.vae.enable_slicing()
        pipe.set_progress_bar_config(disable=True)
        return pipe

    def _maybe_attach_adapter(self, pipe, torch, rebuild):
        """Returns (pipe, adapter_info | None, reason). NEVER raises because of the adapter: any problem => base model.

        Only an adapter that passes `load_approved_adapter` (training done, same base revision, hash intact, blind
        review approved) is loaded. It is loaded unfused with the same call as ai_engine.training.compare, so what is
        served is what was reviewed.
        """
        if not self.s.adapter_path:
            return pipe, None, "No adapter configured; using the base model."
        try:
            info = load_approved_adapter(self.s.adapter_path, self.s.model_revision, self.s.model_id)
        except AdapterRejected as e:
            log.warning("adapter rejected; serving the base model: %s", e)
            return pipe, None, f"Adapter not used: {e}"
        try:
            pipe.load_lora_weights(info["path"], weight_name=LORA_WEIGHT_NAME)
            pipe.set_adapters("default_0", adapter_weights=self.s.adapter_weight)
        except Exception as exc:  # noqa: BLE001
            if _is_oom(exc, torch):
                raise  # a real resource problem: let the caller translate it, do not hide it behind a fallback
            log.exception("adapter failed to load; rebuilding a clean base pipeline")
            del pipe  # a failed load can leave half-injected layers, so never reuse this pipeline
            self._free(torch)
            return rebuild(), None, "Adapter not used: it failed to load."
        log.info("approved adapter active sha256=%s weight=%s", info["sha256"][:12], self.s.adapter_weight)
        return pipe, info, f"Approved adapter active at weight {self.s.adapter_weight:g}."

    def is_loaded(self) -> bool:
        return self._pipe is not None

    def _precheck(self) -> str:
        """Cheap, cached pre-load verdict so a bad config is visible at startup, not after the slow first request.

        Advisory only: the real decision is re-made at load time by _maybe_attach_adapter.
        """
        if self._precheck_reason is None:
            try:
                load_approved_adapter(self.s.adapter_path, self.s.model_revision, self.s.model_id)
                self._precheck_reason = "Approved adapter will be applied when the model loads."
            except AdapterRejected as e:
                log.warning("adapter will NOT be used (base model will be served): %s", e)
                self._precheck_reason = f"Adapter will not be used: {e}"
        return self._precheck_reason

    def adapter_status(self) -> dict:
        cfg = bool(self.s.adapter_path)
        a = self._adapter
        if self._pipe is not None:
            reason = self._adapter_reason
        else:
            reason = self._precheck() if cfg else "No adapter configured; using the base model."
        return dict(configured=cfg, active=a is not None, reason=reason,
                    adapter_sha256=a["sha256"] if a else None, adapter_bytes=a["bytes"] if a else None,
                    base_revision=a["base_revision"] if a else None,
                    weight=self.s.adapter_weight if cfg else None)

    @staticmethod
    def _free(torch) -> None:
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001
            pass

    def _scheduler_label(self) -> str:
        sch = self._pipe.scheduler
        try:
            spacing = sch.config.get("timestep_spacing")
        except Exception:  # noqa: BLE001
            spacing = None
        return type(sch).__name__ + (f"(timestep_spacing={spacing})" if spacing else "")

    def generate(self, prompt: str, seed: int, width: int, height: int, steps: int) -> EngineResult:
        if self._pipe is None:
            raise model_load_failed()
        torch = self._torch
        cuda = self._device == "cuda"
        try:
            with torch.inference_mode():
                if cuda:
                    torch.cuda.reset_peak_memory_stats()
                gen = torch.Generator("cpu").manual_seed(seed)  # CPU generator: seed means the same on any device
                out = self._pipe(prompt=prompt, num_inference_steps=steps, guidance_scale=0.0,
                                 width=width, height=height, generator=gen)
                if cuda:
                    torch.cuda.synchronize()
                peak = torch.cuda.max_memory_allocated() / 1048576 if cuda else None
        except BaseException as exc:  # noqa: BLE001
            if _is_oom(exc, torch):
                self._free(torch)
                raise out_of_memory() from None
            if isinstance(exc, ServiceError):
                raise
            log.exception("generation failed")
            raise
        revision = self.s.model_revision or "unpinned (hub default)"
        if self._adapter:  # the response must say which weights produced the image
            revision += f"+lora-{self._adapter['sha256'][:12]}"
        return EngineResult(image=out.images[0], model=self.s.model_id,
                            model_revision=revision, adapter_sha256=self._adapter["sha256"] if self._adapter else None,
                            precision=self._precision, scheduler=self._scheduler_label(),
                            steps=steps, width=width, height=height, seed=seed, peak_gpu_mb=peak)
