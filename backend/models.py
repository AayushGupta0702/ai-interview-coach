from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship: A candidate can take multiple mock sessions
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    
    # Core scores
    composite_score = Column(Integer, nullable=False)
    content_score = Column(Integer, nullable=False)
    eye_contact_score = Column(Integer, nullable=False)
    posture_score = Column(Integer, nullable=False)
    
    # Expressions
    dominant_expression = Column(String(50), nullable=False)
    
    # Text data (stored as JSON string text)
    strengths = Column(Text, nullable=False)
    weaknesses = Column(Text, nullable=False)
    detailed_evaluations = Column(Text, nullable=False)
    
    # Raw logs (questions, answers, telemetry timelines)
    history_transcript = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    candidate = relationship("Candidate", back_populates="interviews")
