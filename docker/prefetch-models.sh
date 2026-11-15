#!/usr/bin/env sh
cd "$(dirname "$0")" && docker compose run --rm imagineai python docker/prefetch_models.py "$@"
