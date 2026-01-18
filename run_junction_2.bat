@echo off
cd /d "%~dp0"

echo [INFO] Environment Check...

if exist ".venv\Scripts\activate.bat" (
    echo [INFO] Activating .venv...
    call .venv\Scripts\activate.bat
) else (
    echo [WARNING] .venv not found. Ensure you are running this from the project root.
)

echo.
echo [INFO] Starting Worker for JUNCTION 2...
echo [INFO] Accessing local config but overriding Junction ID...

:: Running with Junction ID 2
python worker\main.py --junction_id 2 --source "worker\Videos\sample2.mp4"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Worker exited with error code %ERRORLEVEL%.
)
pause
