# One-command build and run (CPU or GPU host):
#   docker build -t imagineai .
#   docker run --rm -p 8000:8000 -e API_KEY=change-me imagineai            # CPU: API + dashboard + classical CV
#   docker run --rm --gpus all -p 8000:8000 -e INSTALL_ML=1 ...             # see compose/README for the GPU image
# Never bake secrets into the image: pass API_KEY / HF_TOKEN at run time.

# ---- stage 1: build the React website -------------------------------------------------------------------------
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
RUN npx vite build

# ---- stage 2: API + dashboard ---------------------------------------------------------------------------------
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/app/.cache/huggingface \
    IMAGINEAI_HOSTED_VARIANTS=1
WORKDIR /app
COPY requirements.txt requirements-ml.txt ./
RUN pip install -r requirements.txt
ARG INSTALL_ML=0
RUN if [ "$INSTALL_ML" = "1" ]; then pip install -r requirements-ml.txt; fi

COPY backend ./backend
COPY ai_engine ./ai_engine
COPY computer_vision ./computer_vision
COPY evaluation ./evaluation
COPY --from=web /web/dist ./frontend/dist

RUN useradd --system --create-home --uid 10001 appuser \
    && mkdir -p /app/generated_images /app/.cache/huggingface \
    && chown -R appuser:appuser /app/generated_images /app/.cache
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
