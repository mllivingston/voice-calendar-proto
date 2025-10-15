from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
import uuid
import threading

@dataclass
class Event:
    id: str
    title: str
    start: datetime
    end: datetime
    created_at: datetime

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
            "created_at": self.created_at.isoformat(),
        }

# Simple in-process, per-user store (keyed by user.sub)
_STORE: Dict[str, List[Event]] = {}
_LOCK = threading.Lock()

def _now() -> datetime:
    return datetime.now(timezone.utc)

def list_events(user_sub: str) -> List[Dict[str, Any]]:
    with _LOCK:
        return [e.to_json() for e in _STORE.get(user_sub, [])]

def add_event(user_sub: str, title: str, start: Optional[str], end: Optional[str]) -> Event:
    # very forgiving parser; if missing, default to now → now+1h
    now = _now()
    try:
        start_dt = datetime.fromisoformat(start) if start else now
    except Exception:
        start_dt = now
    try:
        end_dt = datetime.fromisoformat(end) if end else (start_dt + timedelta(hours=1))
    except Exception:
        end_dt = start_dt + timedelta(hours=1)

    ev = Event(
        id=str(uuid.uuid4()),
        title=title or "untitled",
        start=start_dt,
        end=end_dt,
        created_at=now,
    )
    with _LOCK:
        _STORE.setdefault(user_sub, []).append(ev)
    return ev

def delete_last(user_sub: str) -> Optional[str]:
    with _LOCK:
        arr = _STORE.get(user_sub, [])
        if not arr:
            return None
        ev = arr.pop()
        return ev.id

def apply_command(user_sub: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accepts either:
      - {"op": "noop"} (does nothing)
      - {"type":"create_event","title":str,"start":str|None,"end":str|None}
      - {"op":"delete_last"}
    Returns a minimal result dict.
    """
    # Legacy op path
    op = payload.get("op")
    if op == "noop":
        return {"ok": True, "op": "noop"}
    if op == "delete_last":
        deleted = delete_last(user_sub)
        return {"ok": True, "deleted_id": deleted}

    # Command path
    cmd_type = payload.get("type")
    if cmd_type == "create_event":
        title = (payload.get("title") or "untitled").strip()
        ev = add_event(user_sub, title, payload.get("start"), payload.get("end"))
        return {"ok": True, "created": ev.to_json()}

    return {"ok": False, "error": "unknown_op_or_command"}
