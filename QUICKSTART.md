# Verifair QuickStart Guide 🚀

Get the Verifair frontend and backend up and running in minutes!

## 📦 Easy Installation (One-Time Setup)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-.git
    cd VERIFAIR_AI-BIAS-DETECTION-
    ```

2.  **Run the Installer Script:**
    This automatically sets up your Python virtual environment and installs all dependencies.
    ```bash
    chmod +x install_project.sh
    ./install_project.sh
    ```

## ▶️ Start the Application (Daily Use)

Simply double-click or run:
```bash
chmod +x start_verifair.sh  # (First time only)
./start_verifair.sh
```

This will magically open a **new Terminal window** with separate tabs for:
1.  **Frontend**: Runs on `http://localhost:3000` (Your beautiful UI!)
2.  **Backend**: API server on `http://localhost:8000` (Powered by Python FastAPI)
3.  **Ngrok Tunnel**: If installed, gives you a public URL (e.g., `https://xyz.ngrok-free.app`)

## 🛑 Stop the Application

If you ran it via `start_verifair.sh`, simply **close the new Terminal window** to stop everything.

Alternatively, you can run the kill switch:
```bash
chmod +x stop_verifair.sh
./stop_verifair.sh
```

## ⚠️ Requirements

Make sure you have these installed:
-   **Python 3.9+** (Check: `python3 --version`)
-   **Node.js 18+** (Check: `node --version`)
-   **Ngrok** (Optional, for public URLs: `brew install ngrok`)

---
**Enjoy Verifair!** 🛡️✨
