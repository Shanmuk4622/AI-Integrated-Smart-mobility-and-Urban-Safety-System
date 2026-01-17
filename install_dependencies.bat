@echo off
echo Setting up Smart Mobility System...

echo 1. Installing Backend Dependencies...
cd backend
pip install -r requirements.txt
cd ..

echo 2. Installing Frontend Dependencies...
cd frontend
call npm install
call npm install -D tailwindcss postcss autoprefixer
call npx tailwindcss init -p
call npm install lucide-react react-router-dom recharts clsx tailwind-merge
cd ..

echo Setup Complete!
echo To run backend: cd backend && uvicorn main:app --reload
echo To run frontend: cd frontend && npm run dev
pause
