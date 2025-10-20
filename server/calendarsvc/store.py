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
# Per-user operation history for undo; newest at end
# Each entry = {"kind":"create","id":str} OR {"kind":"delete","event":Event}
_HISTORY: Dict[str, List[Dict[str, Any]]] = {}

_LOCK = threading.Lock()

def _now() -> datetime:
    return datetime.now(timezone.utc)

def _bucket(user_sub: str) -> List[Event]:
    return _STORE.setdefault(user_sub, [])

def _history(user_sub: str) -> List[Dict[str, Any]]:
    return _HISTORY.setdefault(user_sub, [])

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
        _bucket(user_sub).append(ev)
        _history(user_sub).append({"kind": "create", "id": ev.id})
    return ev

def _delete_by_id_unlogged(user_sub: str, event_id: str) -> bool:
    """Delete event by id without writing to history (used by undo for 'create')."""
    bucket = _bucket(user_sub)
    for i in range(len(bucket) - 1, -1, -1):
        if bucket[i].id == event_id:
            bucket.pop(i)
            return True
    return False

def delete_last(user_sub: str) -> Optional[str]:
    with _LOCK:
        arr = _bucket(user_sub)
        if not arr:
            _history(user_sub).append({"kind": "delete", "event": None})
            return None
        ev = arr.pop()
        _history(user_sub).append({"kind": "delete", "event": ev})
        return ev.id

def undo_last(user_sub: str) -> Dict[str, Any]:
    """
    Reverse the most recent mutation in this simple model:
      - If last op was {"kind":"create","id":...} → delete that event id (best-effort).
      - If last op was {"kind":"delete","event":Event|None} → re-append the saved Event (if present).
    Returns {"ok": True, "undone": "create"|"delete", "id": <str|None>} (best-effort no-throw).
    """
    with _LOCK:
        hist = _history(user_sub)
        if not hist:
            return {"ok": True, "undone": None, "id": None}

        entry = hist.pop()  # newest
        kind = entry.get("kind")
        if kind == "create":
            eid = entry.get("id")
            _delete_by_id_unlogged(user_sub, eid)  # best-effort
            return {"ok": True, "undone": "create", "id": eid}
        if kind == "delete":
            ev: Optional[Event] = entry.get("event")
            if ev is not None:
                _bucket(user_sub).append(ev)
                return {"ok": True, "undone": "delete", "id": ev.id}
            # delete of None (no-op deletion) — nothing to restore
            return {"ok": True, "undone": "delete", "id": None}

        # Unknown entry (shouldn't happen)
        return {"ok": True, "undone": None, "id": None}

def apply_command(user_sub: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Accepts either:
      - {"op": "noop"} (does nothing)
      - {"op": "delete_last"}
      - {"op": "undo_last"}             ← NEW
      - {"type":"create_event","title":str,"start":str|None,"end":str|None}
    Returns a minimal result dict.
    """
    # Legacy op path
    op = payload.get("op")
    if op == "noop":
        return {"ok": True, "op": "noop"}
    if op == "delete_last":
        deleted = delete_last(user_sub)
        return {"ok": True, "deleted_id": deleted}
    if op == "undo_last":
        undone = undo_last(user_sub)
        return {**undone}

    # Command path
    cmd_type = payload.get("type")
    if cmd_type == "create_event":
        title = (payload.get("title") or "untitled").strip()
        ev = add_event(user_sub, title, payload.get("start"), payload.get("end"))
        return {"ok": True, "created": ev.to_json()}

    return {"ok": False, "error": "unknown_op_or_command"}
