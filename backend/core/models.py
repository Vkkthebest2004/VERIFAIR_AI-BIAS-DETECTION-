
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    profile_picture_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    audits = relationship("AuditRecord", back_populates="owner")

class AuditRecord(Base):
    """
    Stores the history of bias scans.
    """
    __tablename__ = "audit_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    
    # Statistics
    total_sentences = Column(Integer)
    bias_flags_count = Column(Integer)
    
    # Store the full JSON report so we can reconstruct the UI
    # In a real heavy production system, we might store this in S3/Blob and just link it.
    full_report_json = Column(JSON) 

    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="audits")
