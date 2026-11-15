@echo off
setlocal
cd /d "%~dp0"
echo.
echo  Imagine AI - starting (first run builds the image: about 10 minutes, then it starts in seconds)
echo.
docker info >nul 2>&1
if errorlevel 1 (
  echo  Docker is not running. Install Docker Desktop from https://www.docker.com/products/docker-desktop
  echo  then open it, wait until it says "Engine running", and run this file again.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
if not exist ..\adapters mkdir ..\adapters
set PORT=8000
for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORT=" .env') do set PORT=%%b
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo  Something went wrong while building. Scroll up for the error, or see docker\README.md.
  pause
  exit /b 1
)
echo  Waiting for the website to be ready...
powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){ try{ Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/health -TimeoutSec 2 | Out-Null; exit 0 }catch{ Start-Sleep 2 } }; exit 1"
if errorlevel 1 (
  echo  The site did not answer in time. Run "docker logs imagineai" to see why.
  pause
  exit /b 1
)
echo.
echo  Ready: http://localhost:%PORT%   (create an account on the first screen)
start "" http://localhost:%PORT%
endlocal
