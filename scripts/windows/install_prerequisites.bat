@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo      Verifair - Prerequisite Installer
echo ==========================================
echo.
echo This script attempts to install missing dependencies (Python, Node.js)
echo using the Windows Package Manager (winget).
echo.
echo NOTE: You may be prompted for Administrator permissions.
echo.

:: 1. Check for Winget
winget --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] 'winget' is not found.
    echo Please update Windows 10/11 or install "App Installer" from the Microsoft Store.
    echo We cannot automatically install prerequisites without winget.
    pause
    exit /b 1
)

:: 2. Check/Install Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Python not found. Installing Python 3.11...
    winget install -e --id Python.Python.3.11 --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Python.
    ) else (
        echo [SUCCESS] Python installed.
    )
) else (
    echo [INFO] Python is already installed.
)

:: 3. Check/Install Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found. Installing Node.js LTS...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js.
    ) else (
        echo [SUCCESS] Node.js installed.
    )
) else (
    echo [INFO] Node.js is already installed.
)

:: 4. Check/Install Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Git not found. Installing Git...
    winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Git.
    ) else (
        echo [SUCCESS] Git installed.
    )
) else (
    echo [INFO] Git is already installed.
)

:: 5. Install Visual C++ Redistributable (Required for ML libraries)
echo [INFO] Checking for Visual C++ Redistributable...
winget install -e --id Microsoft.VCRedist.2015+.x64 --accept-source-agreements --accept-package-agreements
if !errorlevel! neq 0 (
    echo [INFO] Visual C++ Redistributable likely already installed or skipped.
) else (
    echo [SUCCESS] Visual C++ Redistributable installed/updated.
)

echo.
echo ==========================================
echo      Prerequisite Check Complete
echo ==========================================
echo.
echo IMPORTANT: If any tools were just installed, you MUST
echo RESTART your Command Prompt or Terminal for the changes to take effect.
echo.
pause
