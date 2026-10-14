@echo off
title NSE Market Data Pipeline - Windows RDP
echo ============================================================
echo   NSE Market Data Pipeline & Terminal - Windows Services
echo ============================================================

cd /d "%~dp0..\.."

echo [1/3] Checking Python virtual environment...
if not exist ".venv\Scripts\activate.bat" (
    echo Virtual environment not found. Creating .venv...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo Installing backend dependencies...
    pip install -r requirements.txt
    pip install -e .
) else (
    call .venv\Scripts\activate.bat
)

echo [2/3] Launching FastAPI Backend on port 8000...
start "NSE Backend (FastAPI)" cmd /k "call .venv\Scripts\activate.bat && uvicorn nse_pipeline.api.app:app --host 0.0.0.0 --port 8000"

echo [3/3] Launching Daily Bhavcopy Ingestion Scheduler...
start "NSE Daily Scheduler" cmd /k "call .venv\Scripts\activate.bat && python -m nse_pipeline.scheduler.daily_scheduler"

echo Launching Frontend Terminal on port 3000...
cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
start "NSE Frontend (Vite)" cmd /k "npm run preview -- --host 0.0.0.0 --port 3000"

echo ============================================================
echo   All NSE Services have been launched successfully!
echo   Frontend UI:  http://localhost:3000 or http://^<SERVER_IP^>:3000
echo   Backend API:  http://localhost:8000/docs
echo ============================================================
pause
