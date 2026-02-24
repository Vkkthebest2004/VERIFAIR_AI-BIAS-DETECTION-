
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.api.routes import router as api_router
from backend.api.auth import router as auth_router
from backend.config.bias_config import MODEL_NAME
from backend.core.database import engine, Base

# Create Database Tables
Base.metadata.create_all(bind=engine)

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("VerifairMain")

app = FastAPI(
    title="Verifair API",
    description="The AI Bias Detection Platform Backend",
    version="1.0.0"
)

# CORS Configuration
# Allow requests from Next.js frontend (usually localhost:3000)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://frontend-three-blush-87.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.ngrok-free\.app|https://.*\.ngrok\.io",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routes
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(api_router, prefix="/api/v1", tags=["audit"])

try:
    from backend.api.live_audit import router as live_audit_router
    app.include_router(live_audit_router, prefix="/api/v1", tags=["live-audit"])
except Exception as e:
    logger.error(f"Failed to include live audit router: {e}")

try:
    from backend.api.live_copilot import router as live_copilot_router
    app.include_router(live_copilot_router, prefix="/api/v1", tags=["live-copilot"])
    logger.info("Live Copilot router loaded successfully")
except Exception as e:
    logger.error(f"Failed to include live copilot router: {e}")

@app.get("/")
def root():
    return {
        "message": "Welcome to Verifair API",
        "model": MODEL_NAME,
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
