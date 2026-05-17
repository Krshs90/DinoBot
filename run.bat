@echo off
echo ==================================================
echo   Starting DinoBot Neural Engine Platform
echo ==================================================
echo.

REM Install Backend Dependencies
echo [1/4] Installing Backend Dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Failed to install python dependencies.
    pause
    exit /b %errorlevel%
)

REM Install Frontend Dependencies
echo [2/4] Installing Frontend Dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo Failed to install npm dependencies.
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..

REM Start Backend
echo [3/4] Starting FastAPI Backend Engine...
start cmd /k "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000"

REM Start Frontend
echo [4/4] Starting React Dashboard...
start cmd /k "cd frontend && npm run dev"

echo.
echo ==================================================
echo   System Online!
echo   Dashboard: http://localhost:5173
echo ==================================================

REM Wait a few seconds for servers to initialize
timeout /t 3 /nobreak >nul

REM Open the dashboard automatically in the default browser
start http://localhost:5173

pause
