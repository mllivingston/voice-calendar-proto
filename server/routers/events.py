from fastapi import APIRouter, Depends
from services.events import EventsService
from typing import Dict, List
from sqlmodel import SQLModel
from utils.connections import manager
from auth.deps import get_current_user

router = APIRouter(prefix="/api/events", tags=["events"])
svc = EventsService()

class EventCreate(SQLModel):
    title: str
    start_at: str | None = None
    end_at: str | None = None
    all_day: bool = False

@router.get("")
async def list_events(user=Depends(get_current_user)) -> Dict[str, List[dict]]:
    uid = user["user_id"]
    return {"events": [e.dict() for e in svc.list(uid)]}

@router.post("")
async def create_event(payload: EventCreate, user=Depends(get_current_user)):
    uid = user["user_id"]
    ev = svc.create(uid, payload.title, payload.start_at, payload.end_at, payload.all_day)
    await manager.broadcast_room(uid, {"type":"event_created","event": ev.dict()})
    return {"event": ev.dict()}

@router.delete("/{event_id}")
async def delete_event(event_id: str, user=Depends(get_current_user)):
    uid = user["user_id"]
    ok = svc.delete_by_id(uid, event_id)
    if ok:
        await manager.broadcast_room(uid, {"type":"event_deleted","event_id": event_id})
    return {"success": ok}
