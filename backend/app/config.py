"""Runtime settings, read from environment variables (see .env.example)."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from ai_engine.optimization.config import OFFLOADS
from ai_engine.optimization.policy import PRECISION_SETTINGS, WEIGHTS_VARIANTS

REPO_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_MODEL_ID = "stabilityai/sd-turbo"
# SD-Turbo is trained at 512x512; other sizes are allowed but quality is NOT yet measured (P4/P6).
DEFAULT_SUPPORTED_RESOLUTIONS = (256, 384, 512, 640, 768)


def _load_dotenv() -> None:
    """Load simple KEY=VALUE entries without overriding explicit process variables."""
    env_file = REPO_ROOT / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name, value = name.strip(), value.strip()
        if name and name not in os.environ:
            os.environ[name] = value


_load_dotenv()


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    return default if raw is None else raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolutions(raw: str | None) -> tuple[int, ...]:
    if not raw:
        return DEFAULT_SUPPORTED_RESOLUTIONS
    values = tuple(sorted({int(x) for x in raw.split(",") if x.strip()}))
    if not values or any(v % 8 or not 256 <= v <= 1024 for v in values):
        raise ValueError("SUPPORTED_RESOLUTIONS must be multiples of 8 within 256-1024")
    return values


def _choice(name: str, allowed: tuple[str, ...], default: str) -> str:
    raw = (os.getenv(name) or default).strip().lower()
    if raw not in allowed:
        raise ValueError(f"{name} must be one of {allowed}, got {raw!r}")
    return raw


@dataclass(frozen=True)
class Settings:
    model_id: str = DEFAULT_MODEL_ID
    model_revision: str | None = None  # None = hub default branch ("unpinned")
    device: str = "auto"  # auto | cuda | cpu
    output_dir: Path = REPO_ROOT / "generated_images"
    public_base_url: str | None = None  # override when behind a proxy/tunnel
    preload_model: bool = False
    supported_resolutions: tuple[int, ...] = DEFAULT_SUPPORTED_RESOLUTIONS
    max_stored_images: int = 200
    # P4 optimization knobs. Defaults reproduce P1A behaviour exactly (fp16 on CUDA / fp32 on CPU, nothing else on).
    precision: str = "auto"  # auto | fp32 | fp16 | bf16
    attention_slicing: bool = False
    vae_slicing: bool = False
    offload: str = "none"  # none | model | sequential
    weights_variant: str = "auto"  # auto | fp16 | none  (see ai_engine/optimization/policy.py)
    # P5B classical CV. "off" (default) = untouched P4 behaviour; "assess" = measure + flag, image unchanged;
    # "correct" = guarded, re-assessed correction (the saved/served PNG is then the corrected image).
    cv_mode: str = "off"  # off | assess | correct
    # P6 adaptive controller. adaptive_profile=None (default) = controller OFF, behaviour identical to P4/P5A.
    adaptive_profile: Path | None = None  # measured profile JSON (docs/P6_ADAPTIVE.md)
    adaptive_policy: Path | None = None  # optional policy JSON; default policy values are UNCALIBRATED
    adaptive_allow_synthetic: bool = False  # a profile marked synthetic is refused unless this is true
    adaptive_decision_log: Path | None = None  # optional JSON-lines file, one line per controller decision
    adapter_path: Path | None = None  # P3B: optional approved LoRA folder; None = base model only
    adapter_weight: float = 1.0  # LoRA influence scale; must match the scale used for quality review
    # Safety: optional shared secret for /api/v1/*. None = auth OFF (default, unchanged behaviour). repr=False so the
    # key can never leak through logging/printing a Settings object.
    api_key: str | None = field(default=None, repr=False)
    groq_api_key: str | None = field(default=None, repr=False)
    groq_model: str = "llama-3.1-8b-instant"
    gemini_api_key: str | None = field(default=None, repr=False)
    gemini_model: str = "gemini-3.8-flash"


def _path(name: str) -> Path | None:
    raw = os.getenv(name)
    return Path(raw) if raw and raw.strip() else None


MIN_API_KEY_CHARS = 16


def _api_key() -> str | None:
    key = os.getenv("API_KEY", "").strip()
    if not key:
        return None
    if len(key) < MIN_API_KEY_CHARS:
        raise ValueError(f"API_KEY must be at least {MIN_API_KEY_CHARS} characters (use a long random value)")
    return key


def _adapter_weight() -> float:
    raw = os.getenv("ADAPTER_WEIGHT", "1.0").strip()
    try:
        weight = float(raw)
    except ValueError as exc:
        raise ValueError("ADAPTER_WEIGHT must be a number between 0 and 1") from exc
    if not 0.0 <= weight <= 1.0:
        raise ValueError("ADAPTER_WEIGHT must be between 0 and 1")
    return weight


def load_settings() -> Settings:
    base = os.getenv("PUBLIC_BASE_URL")
    return Settings(
        model_id=os.getenv("MODEL_ID", DEFAULT_MODEL_ID),
        model_revision=os.getenv("MODEL_REVISION") or None,
        device=os.getenv("DEVICE", "auto").lower(),
        output_dir=Path(os.getenv("OUTPUT_DIR") or REPO_ROOT / "generated_images"),
        public_base_url=base.rstrip("/") if base else None,
        preload_model=_bool("PRELOAD_MODEL", False),
        supported_resolutions=_resolutions(os.getenv("SUPPORTED_RESOLUTIONS")),
        max_stored_images=int(os.getenv("MAX_STORED_IMAGES", "200")),
        precision=_choice("PRECISION", PRECISION_SETTINGS, "auto"),
        attention_slicing=_bool("ATTENTION_SLICING", False),
        vae_slicing=_bool("VAE_SLICING", False),
        offload=_choice("OFFLOAD", OFFLOADS, "none"),
        weights_variant=_choice("WEIGHTS_VARIANT", WEIGHTS_VARIANTS, "auto"),
        cv_mode=_choice("CV_MODE", ("off", "assess", "correct"), "off"),
        adaptive_profile=_path("ADAPTIVE_PROFILE"),
        adaptive_policy=_path("ADAPTIVE_POLICY"),
        adaptive_allow_synthetic=_bool("ADAPTIVE_ALLOW_SYNTHETIC", False),
        adaptive_decision_log=_path("ADAPTIVE_DECISION_LOG"),
        adapter_path=Path(os.environ["ADAPTER_PATH"]) if os.getenv("ADAPTER_PATH", "").strip() else None,
        adapter_weight=_adapter_weight(),
        api_key=_api_key(),
        groq_api_key=os.getenv("GROQ_API_KEY") or None,
        groq_model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
    )
