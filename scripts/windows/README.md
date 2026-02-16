# Verifair Windows Scripts

This folder contains batch scripts (`.bat`) for easy installation and running of the Verifair application on Windows.

## 1. Prerequisites (install_prerequisites.bat)

IF YOU DO NOT HAVE PYTHON OR NODE.JS INSTALLED:
Double-click on `install_prerequisites.bat`.
This will check for **Python** and **Node.js** and attempt to install them using Windows Package Manager (`winget`).

> **Important:** If this script installs anything, you must **restart your computer** (or at least your terminal) before running the other scripts.

## 2. Installation (install_project.bat)

Double-click on `install_project.bat`.
This will:
1.  Check for Python installation.

2.  Create a virtual environment for the backend (`backend\venv`).
3.  Install Python dependencies.
4.  Install Node.js dependencies for the frontend.

## 3. Running the App

Double-click on `start_verifair.bat`.
This will:
1.  Open two new Command Prompt windows.
2.  One window will run the Backend server (`http://localhost:8000`).
3.  One window will run the Frontend server (`http://localhost:3000`).

## 4. Stopping the App

To stop the application, simply close the two Command Prompt windows that were opened.
