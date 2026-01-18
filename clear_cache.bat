@echo off
REM ==========================================
REM Clear Python Cache - Manual Script
REM ==========================================
REM Run this script if you change config.py and want to ensure changes are applied

cd /d "%~dp0"

echo [INFO] Clearing Python cache files...

if exist "worker\__pycache__" (
    rmdir /s /q "worker\__pycache__"
    echo - Cleared worker\__pycache__
)

if exist "worker\core\__pycache__" (
    rmdir /s /q "worker\core\__pycache__"
    echo - Cleared worker\core\__pycache__
)

if exist "worker\services\__pycache__" (
    rmdir /s /q "worker\services\__pycache__"
    echo - Cleared worker\services\__pycache__
)

if exist "worker\sort\__pycache__" (
    rmdir /s /q "worker\sort\__pycache__"
    echo - Cleared worker\sort\__pycache__
)

if exist "backend\__pycache__" (
    rmdir /s /q "backend\__pycache__"
    echo - Cleared backend\__pycache__
)

if exist "backend\app\__pycache__" (
    rmdir /s /q "backend\app\__pycache__"
    echo - Cleared backend\app\__pycache__
)

echo.
echo [SUCCESS] Python cache cleared!
echo You can now run the worker and it will use the latest config.
echo.
pause
