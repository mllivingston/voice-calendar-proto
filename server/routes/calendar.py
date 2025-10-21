from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query

from server.auth import get_current_user, AuthUser
from server.calendarsvc import store

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/list")
def list_events(user: AuthUser = Depends(get_current_user)) -> Any:
    # Legacy: raw array of events
    return store.list_events(user.sub)

@router.get("/history")
def get_history(
    user: AuthUser = Depends(get_current_user),
    limit: Optional[int] = Query(default=50, ge=1, le=500),
) -> Dict[str, Any]:
    # Legacy: { user_id, limit, items, total } with items newest-first
    return store.history(user.sub, limit=limit or 50)

@router.post("/mutate")
def mutate(payload: Dict[str, Any], user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    # Legacy: {"status":"ok"|"error", "diff": {...}, "events":[...]}
    return store.apply_command(user.sub, payload)
