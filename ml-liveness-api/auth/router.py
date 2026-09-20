from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from .jwt_handler import (
    TokenResponse,
    verify_token,
    create_access_token,
    create_and_store_refresh_token,
    hash_token,
)
from .dependencies import get_current_user, TokenData
from database import get_db
from crud import get_valid_refresh_token, revoke_refresh_token, revoke_all_user_tokens

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    """For demo/testing - in production use SSO"""
    user_id: str
    org_id: str
    roles: list[str] = ["Viewer"]


@router.post("/token", response_model=TokenResponse, summary="Get tokens (demo/testing)")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Demo login endpoint - for testing purposes.
    In production, use SSO (Auth0/Okta/Entra ID) to issue tokens.
    """
    access_token = create_access_token({
        "sub": request.user_id,
        "org_id": request.org_id,
        "roles": request.roles,
    })
    
    refresh_token = create_and_store_refresh_token(
        db, request.user_id, request.org_id, request.roles
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token(
    request: RefreshRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Use a valid refresh token to get a new access token + new refresh token.
    Implements token rotation: old refresh token is invalidated.
    """
    try:
        # Verify the incoming token is a refresh token
        token_data = await verify_token(request.refresh_token, expected_type="refresh")
        
        # Check database for valid, non-revoked token
        token_hash = hash_token(request.refresh_token)
        stored_token = get_valid_refresh_token(db, token_hash, token_data.user_id)
        
        if not stored_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked refresh token",
            )
        
        # Revoke the used token (rotation)
        revoke_refresh_token(db, stored_token.id)
        
        # Create new tokens
        new_access = create_access_token({
            "sub": token_data.user_id,
            "org_id": token_data.org_id,
            "roles": token_data.roles,
        })
        
        new_refresh = create_and_store_refresh_token(
            db, token_data.user_id, token_data.org_id, token_data.roles
        )
        
        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
        )
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.post("/logout", summary="Logout current session")
async def logout(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Revoke the provided refresh token"""
    token_hash = hash_token(refresh_token)
    stored_token = get_valid_refresh_token(db, token_hash, current_user.user_id)
    
    if stored_token:
        revoke_refresh_token(db, stored_token.id)
    
    return {"message": "Logged out successfully"}


@router.post("/logout-all", summary="Logout from all devices")
async def logout_all(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Revoke all refresh tokens for the current user"""
    count = revoke_all_user_tokens(db, current_user.user_id)
    return {"message": f"Logged out from {count} session(s)"}


@router.get("/me", summary="Get current user info")
async def get_me(current_user: TokenData = Depends(get_current_user)):
    """Return current authenticated user info"""
    return {
        "user_id": current_user.user_id,
        "org_id": current_user.org_id,
        "roles": current_user.roles,
    }
