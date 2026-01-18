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
echo [INFO] Clearing Python cache...
if exist "worker\__pycache__" rmdir /s /q "worker\__pycache__"
if exist "worker\core\__pycache__" rmdir /s /q "worker\core\__pycache__"
if exist "worker\services\__pycache__" rmdir /s /q "worker\services\__pycache__"
if exist "worker\sort\__pycache__" rmdir /s /q "worker\sort\__pycache__"

echo.
echo [INFO] Starting Worker...
python worker\main.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Worker exited with error code %ERRORLEVEL%.
)
pause
