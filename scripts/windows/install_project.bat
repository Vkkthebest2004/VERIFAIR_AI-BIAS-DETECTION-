@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
:: Navigate to project root (2 levels up from scripts\windows)
cd /d "%SCRIPT_DIR%..\.."

echo ==========================================
echo      Verifair - Windows Installer
echo ==========================================

:: 1. Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.9+ from python.org and try again.
    pause
    exit /b 1
)

:: 2. Create Virtual Environment
if not exist "backend\venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv backend\venv
) else (
    echo [INFO] Virtual environment already exists.
)

:: 3. Install Backend Dependencies
echo [INFO] Installing backend dependencies...
:: Activate venv and install
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)

:: 4. Install Frontend Dependencies
if exist "frontend" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies.
        cd ..
        pause
        exit /b 1
    )
    cd ..
) else (
    echo [ERROR] frontend directory not found!
    pause
    exit /b 1
)

echo.
echo ==========================================
echo      Installation Complete!
echo ==========================================
echo You can now run the application using:
echo    scripts\windows\start_verifair.bat
echo.
pause
