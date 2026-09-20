from sqlalchemy.orm import Session
from models.db_models import (
    User,
    VoicePrint,
    BehavioralBaseline,
    AuditLog,
    Organization,
    RefreshToken,
)
from datetime import datetime
import uuid


# Organization CRUD
def get_or_create_org(db: Session, org_id: str, name: str | None = None) -> Organization:
    """Get or create an organization"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(id=org_id, name=name or f"Org {org_id}")
        db.add(org)
        db.commit()
        db.refresh(org)
    return org


def get_org_by_id(db: Session, org_id: str) -> Organization | None:
    """Get organization by ID"""
    return db.query(Organization).filter(Organization.id == org_id).first()


# User CRUD
def get_or_create_user(
    db: Session,
    external_user_id: str,
    org_id: str,
    email: str | None = None,
    roles: list | None = None,
) -> User:
    """Get or create a user (for SSO/SCIM provisioning)"""
    user = db.query(User).filter(User.external_user_id == external_user_id).first()
    if not user:
        # Ensure org exists
        get_or_create_org(db, org_id)
        
        user = User(
            id=str(uuid.uuid4()),
            external_user_id=external_user_id,
            org_id=org_id,
            email=email,
            roles=roles or ["Viewer"],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_by_external_id(db: Session, external_user_id: str) -> User | None:
    """Get user by external (SSO) ID"""
    return db.query(User).filter(User.external_user_id == external_user_id).first()


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Get user by internal ID"""
    return db.query(User).filter(User.id == user_id).first()


def update_user_roles(db: Session, user_id: str, roles: list) -> User | None:
    """Update user roles"""
    user = get_user_by_id(db, user_id)
    if user:
        user.roles = roles
        db.commit()
        db.refresh(user)
    return user


# Voice Print CRUD
def save_voice_print(
    db: Session,
    user_id: str,
    embedding: list[float],
    confidence_threshold: float = 0.85,
) -> VoicePrint:
    """Save a new voice print for a user"""
    vp = VoicePrint(
        user_id=user_id,
        embedding=embedding,
        confidence_threshold=confidence_threshold,
    )
    db.add(vp)
    db.commit()
    db.refresh(vp)
    return vp


def get_active_voice_print(db: Session, user_id: str) -> VoicePrint | None:
    """Get the active voice print for a user"""
    return (
        db.query(VoicePrint)
        .filter(VoicePrint.user_id == user_id, VoicePrint.is_active == True)
        .order_by(VoicePrint.enrollment_date.desc())
        .first()
    )


def deactivate_voice_prints(db: Session, user_id: str) -> int:
    """Deactivate all voice prints for a user (before re-enrollment)"""
    count = (
        db.query(VoicePrint)
        .filter(VoicePrint.user_id == user_id, VoicePrint.is_active == True)
        .update({"is_active": False})
    )
    db.commit()
    return count


def update_voice_print_verification(db: Session, voice_print_id: int) -> VoicePrint | None:
    """Update last verification timestamp"""
    vp = db.query(VoicePrint).filter(VoicePrint.id == voice_print_id).first()
    if vp:
        vp.last_verified = datetime.utcnow()
        db.commit()
        db.refresh(vp)
    return vp


# Behavioral Baseline CRUD
def save_or_update_baseline(
    db: Session,
    user_id: str,
    features: dict,
) -> BehavioralBaseline:
    """Save or update behavioral baseline for a user"""
    baseline = (
        db.query(BehavioralBaseline)
        .filter(BehavioralBaseline.user_id == user_id)
        .first()
    )
    
    if baseline:
        # Update existing baseline
        baseline.avg_pause_duration = features.get("avg_pause_duration")
        baseline.pitch_variation = features.get("pitch_variation")
        baseline.tempo = features.get("tempo")
        baseline.mfcc_mean = features.get("mfcc_mean")
        baseline.last_updated = datetime.utcnow()
    else:
        # Create new baseline
        baseline = BehavioralBaseline(
            user_id=user_id,
            avg_pause_duration=features.get("avg_pause_duration"),
            pitch_variation=features.get("pitch_variation"),
            tempo=features.get("tempo"),
            mfcc_mean=features.get("mfcc_mean"),
        )
        db.add(baseline)
    
    db.commit()
    db.refresh(baseline)
    return baseline


def get_user_baseline(db: Session, user_id: str) -> BehavioralBaseline | None:
    """Get behavioral baseline for a user"""
    return (
        db.query(BehavioralBaseline)
        .filter(BehavioralBaseline.user_id == user_id)
        .first()
    )


# Audit Log CRUD
def create_audit_log(
    db: Session,
    org_id: str,
    action: str,
    user_id: str | None = None,
    liveness_result: dict | None = None,
    ip_address: str | None = None,
    device_info: dict | None = None,
) -> AuditLog:
    """Create an audit log entry"""
    log = AuditLog(
        user_id=user_id,
        org_id=org_id,
        action=action,
        liveness_score=liveness_result.get("liveness_score") if liveness_result else None,
        deepfake_probability=liveness_result.get("deepfake_probability") if liveness_result else None,
        behavioral_risk=liveness_result.get("behavioral_risk") if liveness_result else None,
        overall_risk=liveness_result.get("overall_risk") if liveness_result else None,
        recommendation=liveness_result.get("recommendation") if liveness_result else None,
        ip_address=ip_address,
        device_info=device_info,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_audit_logs_by_org(
    db: Session,
    org_id: str,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    """Get audit logs for an organization"""
    return (
        db.query(AuditLog)
        .filter(AuditLog.org_id == org_id)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_audit_logs_by_user(
    db: Session,
    user_id: str,
    limit: int = 100,
) -> list[AuditLog]:
    """Get audit logs for a specific user"""
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )


# Refresh Token CRUD
def save_refresh_token(
    db: Session,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
) -> RefreshToken:
    """Save a new refresh token"""
    rt = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


def get_valid_refresh_token(
    db: Session,
    token_hash: str,
    user_id: str,
) -> RefreshToken | None:
    """Get a valid (non-revoked, non-expired) refresh token"""
    return (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.utcnow(),
        )
        .first()
    )


def revoke_refresh_token(db: Session, token_id: int) -> bool:
    """Revoke a specific refresh token"""
    token = db.query(RefreshToken).filter(RefreshToken.id == token_id).first()
    if token:
        token.revoked = True
        db.commit()
        return True
    return False


def revoke_all_user_tokens(db: Session, user_id: str) -> int:
    """Revoke all refresh tokens for a user (logout all devices)"""
    count = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
        .update({"revoked": True})
    )
    db.commit()
    return count
