from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from pydantic import BaseModel
from fastapi import HTTPException, status
from passlib.hash import pbkdf2_sha256
from sqlalchemy.orm import Session

import sys
sys.path.append("..")
from config import settings


class TokenData(BaseModel):
    user_id: str
    org_id: str
    roles: list[str] = []
    token_type: str = "access"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def hash_token(token: str) -> str:
    """Hash a token for secure storage"""
    return pbkdf2_sha256.hash(token)


def verify_token_hash(token: str, token_hash: str) -> bool:
    """Verify a token against its hash"""
    return pbkdf2_sha256.verify(token, token_hash)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a short-lived access token
    
    Args:
        data: Payload data (sub, org_id, roles)
        expires_delta: Custom expiration time
        
    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "token_type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Create a longer-lived refresh token
    
    Args:
        data: Payload data (sub, org_id, roles)
        
    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def verify_token(token: str, expected_type: str = "access") -> TokenData:
    """
    Verify and decode a JWT token
    
    Args:
        token: The JWT string
        expected_type: "access" or "refresh"
        
    Returns:
        TokenData with user info
        
    Raises:
        HTTPException: If token is invalid
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        
        # Extract claims
        user_id: str = payload.get("sub") or payload.get("user_id")
        org_id: str = payload.get("org_id") or settings.DEFAULT_ORG_ID
        token_type: str = payload.get("token_type")
        roles: list = payload.get("roles", [])
        
        # Validate required fields and type
        if user_id is None or token_type != expected_type:
            raise credentials_exception
        
        return TokenData(
            user_id=user_id,
            org_id=org_id,
            roles=roles,
            token_type=token_type,
        )
        
    except JWTError:
        raise credentials_exception


def create_and_store_refresh_token(
    db: Session,
    user_id: str,
    org_id: str,
    roles: list,
) -> str:
    """
    Create a refresh token and store its hash in the database
    
    Implements token rotation: revokes old tokens before creating new one.
    
    Args:
        db: Database session
        user_id: User ID
        org_id: Organization ID
        roles: User roles
        
    Returns:
        The raw refresh token (to send to client)
    """
    from crud import save_refresh_token, revoke_all_user_tokens
    
    # Revoke old tokens (rotation)
    revoke_all_user_tokens(db, user_id)
    
    # Create new token
    refresh_token = create_refresh_token({
        "sub": user_id,
        "org_id": org_id,
        "roles": roles,
    })
    
    # Store hash in database
    token_hash = hash_token(refresh_token)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    save_refresh_token(db, user_id, token_hash, expires_at)
    
    return refresh_token
