# server/auth/supabase.py
import os
from typing import Dict, Any
from jose import jwt

def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verifies a Supabase access token using HS256 and your project's JWT secret.
    """
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise ValueError("SUPABASE_JWT_SECRET not set")

    iss_base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not iss_base:
        raise ValueError("SUPABASE_URL not set")

    issuer = f"{iss_base}/auth/v1"
    audience = os.environ.get("SUPABASE_AUDIENCE", "authenticated")

    # HS256 decode with issuer/audience checks
    claims = jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=audience,
        issuer=issuer,
        options={"leeway": 10},
    )
    return claims
