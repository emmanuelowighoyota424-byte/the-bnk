"""
Chase-Style Voice Liveness & Security API

A production-ready FastAPI backend for voice deepfake detection using:
- WavLM + Attentive Classifier (ML-based liveness)
- Resemblyzer voice biometrics
- Librosa behavioral analysis
- Multi-tenant JWT authentication with RBAC
"""

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Depends,
    HTTPException,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import asyncio
import base64
import json

from config import settings
from database import get_db
from models.ml_models import device
from utils import ensemble_liveness_score, compute_voice_embedding, extract_behavioral_features
from crud import (
    get_or_create_user,
    get_active_voice_print,
    save_voice_print,
    deactivate_voice_prints,
    get_user_baseline,
    save_or_update_baseline,
    create_audit_log,
)
from auth import (
    auth_router,
    get_current_user,
    require_role,
    require_auditor,
    TokenData,
)


# Initialize FastAPI app
app = FastAPI(
    title="Chase-Style Voice Liveness API",
    description="Advanced voice deepfake detection with WavLM + AASIST-style architecture",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth routes
app.include_router(auth_router)


# Response Models
class LivenessResponse(BaseModel):
    liveness_score: float
    deepfake_probability: float
    behavioral_risk: float
    voice_match_score: float
    overall_risk: float
    recommendation: str
    user_id: str
    org_id: str


class EnrollmentResponse(BaseModel):
    success: bool
    message: str
    user_id: str
    org_id: str


# Health check endpoint
@app.get("/health", tags=["system"])
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": "WavLM + Attentive Classifier",
        "device": str(device),
        "auth": "JWT with refresh token rotation",
    }


# Liveness detection endpoint (file upload)
@app.post("/liveness/upload", response_model=LivenessResponse, tags=["liveness"])
async def liveness_upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Analyze uploaded audio for deepfake/liveness detection
    
    Returns:
    - liveness_score: 0-1 (higher = more likely real)
    - deepfake_probability: 0-1 (higher = more likely fake)
    - behavioral_risk: 0-1 (based on pitch/tempo anomalies)
    - voice_match_score: 0-1 (if user has enrolled voiceprint)
    - overall_risk: 0-1 (weighted ensemble)
    - recommendation: PROCEED / REVIEW / ESCALATE
    """
    audio_bytes = await file.read()
    
    # Get user's stored baseline and voiceprint if available
    user = get_or_create_user(db, current_user.user_id, current_user.org_id)
    baseline = get_user_baseline(db, user.id)
    voice_print = get_active_voice_print(db, user.id)
    
    # Prepare baseline dict
    baseline_dict = None
    if baseline:
        baseline_dict = {
            "pitch_variation": baseline.pitch_variation,
            "tempo": baseline.tempo,
        }
    
    # Get stored embedding
    user_embedding = voice_print.embedding if voice_print else None
    
    # Run ensemble liveness scoring
    result = ensemble_liveness_score(
        audio_bytes,
        user_baseline=baseline_dict,
        user_embedding=user_embedding,
    )
    
    # Create audit log
    create_audit_log(
        db,
        org_id=current_user.org_id,
        user_id=user.id,
        action="liveness_check",
        liveness_result=result,
        ip_address=request.client.host if request.client else None,
    )
    
    return LivenessResponse(
        liveness_score=result["liveness_score"],
        deepfake_probability=result["deepfake_probability"],
        behavioral_risk=result["behavioral_risk"],
        voice_match_score=result["voice_match_score"],
        overall_risk=result["overall_risk"],
        recommendation=result["recommendation"],
        user_id=current_user.user_id,
        org_id=current_user.org_id,
    )


# Voice enrollment endpoint
@app.post("/enrollment/voice", response_model=EnrollmentResponse, tags=["enrollment"])
async def enroll_voice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Enroll a user's voiceprint for future verification
    
    Best practices:
    - Use 5-10 seconds of clear speech
    - Avoid background noise
    - Use the same device type as verification
    """
    audio_bytes = await file.read()
    
    # Get or create user
    user = get_or_create_user(db, current_user.user_id, current_user.org_id)
    
    # Deactivate old voiceprints
    deactivate_voice_prints(db, user.id)
    
    # Compute and store new embedding
    embedding = compute_voice_embedding(audio_bytes)
    save_voice_print(db, user.id, embedding)
    
    # Also update behavioral baseline
    features = extract_behavioral_features(audio_bytes)
    save_or_update_baseline(db, user.id, features)
    
    # Audit log
    create_audit_log(
        db,
        org_id=current_user.org_id,
        user_id=user.id,
        action="voice_enrollment",
    )
    
    return EnrollmentResponse(
        success=True,
        message="Voice enrollment successful",
        user_id=current_user.user_id,
        org_id=current_user.org_id,
    )


# WebSocket for real-time streaming (Twilio / Vapi / Retell)
@app.websocket("/ws/stream/{org_id}")
async def websocket_stream(
    websocket: WebSocket,
    org_id: str,
    token: str | None = None,
):
    """
    Real-time audio streaming endpoint for Twilio Media Streams / Vapi / Retell
    
    Connect with: wss://your-domain/ws/stream/{org_id}?token=your_jwt
    
    Expected message format (Twilio-style):
    {
        "event": "media",
        "media": {
            "payload": "base64-encoded-audio"
        }
    }
    """
    # Validate JWT before accepting
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    
    try:
        from auth import verify_token
        current_user = await verify_token(token)
        
        # Tenant isolation check
        if current_user.org_id != org_id:
            await websocket.close(code=4003, reason="Org mismatch")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    await websocket.accept()
    
    # Audio buffer
    buffer = bytearray()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle Twilio-style media events
            if data.get("event") == "media" and "payload" in data.get("media", {}):
                chunk = base64.b64decode(data["media"]["payload"])
                buffer.extend(chunk)
                
                # Process every ~5 seconds of audio (16kHz * 5s = 80000 samples)
                if len(buffer) > 16000 * 5 * 2:  # 2 bytes per sample
                    clean_chunk = bytes(buffer)
                    
                    # Run liveness scoring
                    result = ensemble_liveness_score(clean_chunk)
                    result.update({
                        "user_id": current_user.user_id,
                        "org_id": current_user.org_id,
                    })
                    
                    # Send result
                    await websocket.send_json({
                        "type": "liveness_update",
                        **result,
                    })
                    
                    # Escalate if high risk
                    if result["overall_risk"] > settings.HIGH_RISK_THRESHOLD:
                        await websocket.send_json({
                            "type": "escalate",
                            "action": "ESCALATE",
                            "reason": "Voice anomaly detected - potential deepfake",
                        })
                    
                    # Clear buffer
                    buffer.clear()
            
            # Handle stop event
            elif data.get("event") == "stop":
                break
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=1011, reason=str(e))


# Admin audit logs endpoint
@app.get("/admin/audit-logs", tags=["admin"])
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(require_auditor),
):
    """
    Get audit logs for the current organization (requires Auditor role)
    """
    from crud import get_audit_logs_by_org
    
    logs = get_audit_logs_by_org(db, current_user.org_id, limit, offset)
    
    return {
        "logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "liveness_score": log.liveness_score,
                "deepfake_probability": log.deepfake_probability,
                "overall_risk": log.overall_risk,
                "recommendation": log.recommendation,
            }
            for log in logs
        ],
        "count": len(logs),
        "offset": offset,
        "limit": limit,
    }


# Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
