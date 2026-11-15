@echo off
cd /d "%~dp0"
docker compose down
echo Stopped. Your accounts, gallery and downloaded models are kept. Run start.bat to start again.
pause
