# syntax=docker/dockerfile:1
# Imagine AI: the whole website (React UI + API + image models) in one image. Build context = repo root:
#   docker build -f docker/Dockerfile -t imagineai .      (or just use docker/start.bat / start.sh)
# CPU build works on ANY laptop (Windows, macOS incl. Apple Silicon, Linux). For NVIDIA GPUs see docker/docker-compose.gpu.yml.
# No secrets are baked in: keys are passed at run time through docker/.env.

# ---- stage 1: build the React website -------------------------------------------------------------------------
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
RUN npx vite build

# ---- stage 2: API + models ------------------------------------------------------------------------------------
FROM python:3.11-slim
# CPU wheels by default (small, run everywhere). GPU build: --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu128
ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    IMAGINEAI_HOSTED_VARIANTS=1 IMAGINEAI_ALLOW_DOWNLOAD=1 \
    DATA_DIR=/data OUTPUT_DIR=/data/generated_images HF_HOME=/data/hf
WORKDIR /app

RUN pip install torch --index-url ${TORCH_INDEX}
COPY requirements.txt requirements-ml.txt ./
RUN pip install -r requirements.txt -r requirements-ml.txt "peft>=0.14" "huggingface-hub>=0.24"

COPY backend ./backend
COPY ai_engine ./ai_engine
COPY computer_vision ./computer_vision
COPY evaluation ./evaluation
COPY docker/prefetch_models.py ./docker/prefetch_models.py
# our own distilled LCM-LoRA (.dockerignore keeps only adapters/lcm_coco_warmstart; start.bat/start.sh create the folder if it is missing)
COPY adapters ./adapters
COPY --from=web /web/dist ./frontend/dist

RUN useradd --system --create-home --uid 10001 appuser \
    && mkdir -p /data/generated_images /data/hf && chown -R appuser:appuser /data
USER appuser
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
