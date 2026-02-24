
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Get DB URL from env or default to local (for non-docker dev)
# Using SQLite by default for easier local setup
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./verifair.db"
)

# SQLAlchemy setup
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency to get DB session per request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
