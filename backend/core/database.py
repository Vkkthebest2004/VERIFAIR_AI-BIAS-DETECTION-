
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Get DB URL from env or default to local (for non-docker dev)
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://verifair:verifair_secret@localhost:5432/verifair_db"
)

# SQLAlchemy setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency to get DB session per request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
