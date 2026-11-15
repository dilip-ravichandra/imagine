@echo off
cd /d "%~dp0"
echo Saving the built image to imagineai-image.tar so it can be copied to another laptop (no rebuild needed there).
docker save imagineai:latest -o imagineai-image.tar
echo Done. On the other laptop:  docker load -i imagineai-image.tar   then   docker compose up -d
pause
