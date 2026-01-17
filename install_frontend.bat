@echo off
cd frontend
echo Installing Tailwind CSS...
call npm install -D tailwindcss postcss autoprefixer
call npx tailwindcss init -p

echo Installing Utils...
call npm install lucide-react react-router-dom recharts clsx tailwind-merge

echo.
echo Frontend Dependencies Installed.
pause
