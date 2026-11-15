#!/usr/bin/env sh
cd "$(dirname "$0")" && docker compose down && echo "Stopped. Your data is kept; ./start.sh starts it again."
