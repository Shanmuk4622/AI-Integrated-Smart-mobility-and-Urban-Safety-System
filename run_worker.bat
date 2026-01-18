@echo off
cd /d "%~dp0"

echo [INFO] Environment Check...

if exist ".venv\Scripts\activate.bat" (
    echo [INFO] Activating .venv...
    call .venv\Scripts\activate.bat
) else (
    echo [WARNING] .venv not found. Ensure you are running this from the project root or have python installed globally.
)

echo [INFO] Checking Dependencies...
pip install -r worker\requirements.txt

echo.
echo [INFO] Starting Worker...
python worker\main.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Worker exited with error code %ERRORLEVEL%.
)
pause
