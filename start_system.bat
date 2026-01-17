@echo off
cd /d "%~dp0"

echo ===================================================
echo      Smart Mobility System - Startup Manager
echo ===================================================

if not exist .venv (
    echo [ERROR] Virtual environment not found!
    echo Please run 'install_dependencies.bat' or create .venv first.
    pause
    exit
)

echo.
echo Launching Backend Server...
start "AI Backend Server" cmd /k "call .venv\Scripts\activate && cd backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo Launching Frontend Dashboard...
start "Web Dashboard" cmd /k "cd frontend && npm run dev"

echo.
echo System is starting up. Check the opened windows for status.
echo.
pause
