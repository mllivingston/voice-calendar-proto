from __future__ import annotations
from fastapi import APIRouter, Depends
from typing import Any, Dict

from server.auth import get_current_user, AuthUser

router = APIRouter(prefix="/ai", tags=["ai"])

@router.post("/interpret")
def interpret(body: Dict[str, Any], user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    # Stub: echo back a fake command; frontend uses this shape in the prototype.
    text = (body.get("text") or "").strip()
    cmd = {"type": "create_event", "title": text or "untitled", "start": None, "end": None}
    return {"command": cmd, "user": {"sub": user.sub, "email": user.email}}
