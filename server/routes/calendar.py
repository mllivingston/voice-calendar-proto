from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, Depends

from server.auth import get_current_user, AuthUser
from server.calendarsvc.store import list_events as store_list, apply_command as store_apply

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/list")
def list_events(user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    events = store_list(user.sub)
    return {"events": events, "user": {"sub": user.sub, "email": user.email}}

@router.post("/mutate")
def mutate(payload: Dict[str, Any], user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Supports:
      - {"op":"noop"}                                → no change
      - {"op":"delete_last"}                         → pop last
      - {"type":"create_event","title", "start","end"} → create
    """
    result = store_apply(user.sub, payload)
    return {**result, "user": {"sub": user.sub, "email": user.email}}
