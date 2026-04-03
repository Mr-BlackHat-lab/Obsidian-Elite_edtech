@echo off
echo.
echo ============================================
echo  LearnPulse AI — Starting all services
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Building and starting Docker containers...
docker-compose up --build -d
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker failed to start.
    echo Make sure Docker Desktop is running first.
    pause
    exit /b 1
)

echo.
echo [2/3] Waiting for backend to be healthy...
:wait_loop
timeout /t 3 /nobreak >nul
docker inspect --format="{{.State.Health.Status}}" learnpulse_backend 2>nul | findstr "healthy" >nul
if %errorlevel% neq 0 (
    echo     still starting...
    goto wait_loop
)

echo.
echo [3/3] All services running!
echo.
echo   Backend API  : http://localhost:8000
echo   Health check : http://localhost:8000/health
echo   API docs     : http://localhost:8000/docs
echo.
echo   Logs (all)   : docker-compose logs -f
echo   Logs (celery): docker-compose logs -f celery
echo   Stop all     : docker-compose down
echo.
echo ============================================
echo  Extension is already built in extension/dist
echo  Load it in Chrome:
echo    chrome://extensions -> Developer Mode -> Load Unpacked
echo    Select: %~dp0extension
echo ============================================
echo.
pause
