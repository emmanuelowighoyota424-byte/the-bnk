from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Boolean,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    users = relationship("User", back_populates="organization")
    audits = relationship("AuditLog", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    external_user_id = Column(String, unique=True, nullable=False)  # From SSO/SCIM
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String, nullable=True)
    roles = Column(JSON, default=list)  # e.g., ["OrgAdmin", "Auditor", "AgentBuilder"]
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organization = relationship("Organization", back_populates="users")
    voice_prints = relationship("VoicePrint", back_populates="user")
    behavioral_baselines = relationship("BehavioralBaseline", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class VoicePrint(Base):
    """Secure voice biometrics storage (embeddings only, not raw audio)"""

    __tablename__ = "voice_prints"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    embedding = Column(JSON)  # Store as list of floats (256-dim from Resemblyzer)
    enrollment_date = Column(DateTime(timezone=True), server_default=func.now())
    last_verified = Column(DateTime(timezone=True))
    confidence_threshold = Column(Float, default=0.85)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="voice_prints")


class BehavioralBaseline(Base):
    """Voice-specific behavioral signals baseline"""

    __tablename__ = "behavioral_baselines"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    avg_pause_duration = Column(Float)
    pitch_variation = Column(Float)
    tempo = Column(Float)
    mfcc_mean = Column(JSON)  # Mean MFCC vector
    last_updated = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="behavioral_baselines")


class AuditLog(Base):
    """Full audit trail for compliance (PCI-DSS / SOC 2)"""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    action = Column(String, nullable=False)  # e.g., "liveness_check", "transfer_attempt"
    liveness_score = Column(Float)
    deepfake_probability = Column(Float)
    behavioral_risk = Column(Float)
    overall_risk = Column(Float)
    recommendation = Column(String)  # "PROCEED", "ESCALATE", "BLOCK"

    ip_address = Column(String, nullable=True)
    device_info = Column(JSON, nullable=True)
    raw_payload = Column(Text, nullable=True)  # Redacted/minimized

    organization = relationship("Organization", back_populates="audits")
    user = relationship("User", back_populates="audit_logs")


class RefreshToken(Base):
    """Refresh token storage for rotation + revocation"""

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False)  # Store hashed token
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
