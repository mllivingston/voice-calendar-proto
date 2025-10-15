from __future__ import annotations
import os
from typing import Optional, Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

try:
    import jwt  # PyJWT
except Exception as e:
    raise RuntimeError("PyJWT is required. Install with: python -m pip install pyjwt") from e

_bearer = HTTPBearer(auto_error=False)

class AuthUser(Dict[str, Any]):
    @property
    def sub(self) -> str:
        return self.get("sub", "")
    @property
    def email(self) -> Optional[str]:
        return self.get("email")

def _bypass_user() -> AuthUser:
    return AuthUser(sub="dev-bypass", email="dev@local")

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> AuthUser:
    """
    Dev (AUTH_BYPASS=1): always return a stub user and never raise.
    Prod: require Bearer token and validate HS256 using SUPABASE_JWT_SECRET.
    """
    if os.getenv("AUTH_BYPASS") == "1":
        # ensure code that checks for a secret sees a value
        os.environ.setdefault("SUPABASE_JWT_SECRET", "dev")
        return _bypass_user()

    if credentials is None or not credentials.scheme or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Server auth not configured",
        )

    token = credentials.credentials
    try:
        # Supabase issues HS256 tokens. No audience verification needed for local dev.
        payload = jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub") or payload.get("user_id") or ""
    email = payload.get("email")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing sub")

    return AuthUser(sub=sub, email=email)
