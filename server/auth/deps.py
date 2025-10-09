# server/auth/deps.py
import os
from fastapi import Header, HTTPException, status
from .supabase import verify_supabase_token

def get_current_user(authorization: str = Header(None)):
    # DEV BYPASS: set AUTH_BYPASS=1 in .env to skip auth
    if os.getenv("AUTH_BYPASS") == "1":
        # Stable synthetic user id so events remain scoped
        return {"user_id": "dev-local-user"}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        claims = verify_supabase_token(token)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")
    return {"user_id": claims.get("sub")}
