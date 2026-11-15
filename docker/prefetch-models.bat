@echo off
cd /d "%~dp0"
echo Downloading the AI models once (about 9 GB; use the "--minimal" option for only the default 2.5 GB model).
docker compose run --rm imagineai python docker/prefetch_models.py %*
pause
