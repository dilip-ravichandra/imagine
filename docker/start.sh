#!/usr/bin/env sh
# Mac / Linux: ./start.sh
set -e
cd "$(dirname "$0")"
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Install Docker (https://docs.docker.com/get-docker/), start it, and run this again."; exit 1
fi
[ -f .env ] || cp .env.example .env
mkdir -p ../adapters
PORT=$(grep -E '^PORT=' .env | cut -d= -f2); PORT=${PORT:-8000}
docker compose up -d --build
printf "Waiting for the website"
i=0; until curl -fs "http://localhost:$PORT/health" >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 90 ] && { echo; echo "Not ready. Run: docker logs imagineai"; exit 1; }
  printf "."; sleep 2
done
echo; echo "Ready: http://localhost:$PORT  (create an account on the first screen)"
( command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT" ) || ( command -v open >/dev/null && open "http://localhost:$PORT" ) || true
