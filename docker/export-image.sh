#!/usr/bin/env sh
cd "$(dirname "$0")" && docker save imagineai:latest -o imagineai-image.tar && echo "Saved. On another laptop: docker load -i imagineai-image.tar && docker compose up -d"
