from __future__ import annotations
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

_bearer = HTTPBearer(auto_error=False)

class AuthUser:
    def __init__(self, sub: str, email: Optional[str] = None):
        self.sub = sub
        self._email = email

    @property
    def email(self) -> Optional[str]:
        return self._email

def _bypass_on() -> bool:
    req = (os.getenv("AUTH_REQUIRED") or "").strip().lower() in {"1", "true", "yes"}
    if req:
        return False
    v = (os.getenv("AUTH_BYPASS") or "").strip().lower()
    return v in {"1", "true", "yes", "y"}

def _bypass_user() -> AuthUser:
    return AuthUser(sub="dev-bypass", email="dev@local")

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> AuthUser:
    if _bypass_on():
        os.environ.setdefault("SUPABASE_JWT_SECRET", "dev")
        return _bypass_user()

    if not credentials or (credentials.scheme or "").lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials or ""
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server auth not configured",
        )

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub") or payload.get("user_id")
    email = payload.get("email")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: no sub",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AuthUser(sub=sub, email=email)
