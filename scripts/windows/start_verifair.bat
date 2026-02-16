@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
:: Navigate to project root
cd /d "%SCRIPT_DIR%..\.."

echo ==========================================
echo      Starting Verifair on Windows
echo ==========================================

:: Start Backend
echo [INFO] Launching Backend Server...
start "Verifair Backend" cmd /k "call backend\venv\Scripts\activate.bat && uvicorn backend.main:app --reload"

:: Start Frontend
echo [INFO] Launching Frontend Server...
start "Verifair Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo [INFO] Verifair is starting...
echo [INFO] Frontend: http://localhost:3000
echo [INFO] Backend:  http://localhost:8000
echo.
echo To stop the application, simply close the two new command windows.
pause
