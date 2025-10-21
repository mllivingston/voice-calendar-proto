from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from server.auth import get_current_user  # HS256 or bypass per your setup
from server.routes import calendar  # added: mount external calendar router

app = FastAPI(title="Voice Calendar Proto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Event = Dict[str, Any]
Diff = Dict[str, Any]
USER_DB: Dict[str, Dict[str, Event]] = {}
USER_HISTORY: Dict[str, List[Dict[str, Any]]] = {}

def _user_db(uid: str) -> Dict[str, Event]:
    return USER_DB.setdefault(uid, {})

def _hist(uid: str) -> List[Dict[str, Any]]:
    return USER_HISTORY.setdefault(uid, [])

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _ensure_id(e: Event) -> str:
    from uuid import uuid4
    if not e.get("id"):
        e["id"] = str(uuid4())
    return e["id"]

class CreateEventCmd(BaseModel):
    type: Optional[str] = None
    title: Optional[str] = None
    start: str
    end: str
    data: Optional[Dict[str, Any]] = None

class UndoNCmd(BaseModel):
    op: str
    n: int

AnyCmd = Dict[str, Any]

def list_events_for(uid: str) -> List[Event]:
    return list(_user_db(uid).values())

def _apply_create(uid: str, e: Event) -> Diff:
    db = _user_db(uid)
    _ensure_id(e)
    e.setdefault("created_at", _now_iso())
    db[e["id"]] = e
    _hist(uid).append({"kind": "create", "event": e.copy(), "ts": _now_iso()})
    return {"type": "create", "event": e}

def _apply_delete_last(uid: str) -> Diff:
    db = _user_db(uid)
    if not db:
        return {"type": "noop"}
    target_id, latest_ts = None, ""
    for ev in db.values():
        ts = ev.get("created_at") or ""
        if ts > latest_ts:
            latest_ts, target_id = ts, ev["id"]
    if target_id is None:
        target_id = next(reversed(db.keys()))
    removed = db.pop(target_id, None)
    if removed:
        _hist(uid).append({"kind": "delete", "event": removed.copy(), "ts": _now_iso()})
        return {"type": "delete", "event": removed}
    return {"type": "noop"}

def _apply_undo_last(uid: str) -> Diff:
    h = _hist(uid)
    if not h:
        return {"type": "noop"}
    last = h.pop()
    kind = last.get("kind")
    ev = last.get("event") or {}
    if kind == "create":
        eid = ev.get("id")
        if eid and eid in _user_db(uid):
            removed = _user_db(uid).pop(eid)
            return {"type": "undo", "undo_of": "create", "event": removed}
        return {"type": "noop"}
    if kind == "delete":
        eid = ev.get("id")
        if eid:
            _user_db(uid)[eid] = ev
            return {"type": "undo", "undo_of": "delete", "event": ev}
        return {"type": "noop"}
    return {"type": "noop"}

def _apply_undo_n(uid: str, n: int) -> Dict[str, Any]:
    n = max(0, int(n))
    diffs: List[Diff] = []
    for _ in range(n):
        d = _apply_undo_last(uid)
        if d.get("type") == "noop":
            break
        diffs.append(d)
    return {"type": "undo_batch", "count": len(diffs), "diffs": diffs}

class InterpretIn(BaseModel):
    text: Optional[str] = None
    input: Optional[str] = None
    query: Optional[str] = None
    tz: Optional[str] = None

@app.post("/ai/interpret")
def ai_interpret(inp: InterpretIn, user=Depends(get_current_user)) -> Dict[str, Any]:
    text = inp.text or inp.input or inp.query or ""
    if not text:
        raise HTTPException(status_code=400, detail="empty input")
    if "create" in text.lower():
        start = datetime.now(timezone.utc)
        end = start + timedelta(minutes=30)
        return {"command": {"type": "create_event", "title": "AI event", "start": start.isoformat(), "end": end.isoformat()}}
    if "delete last" in text.lower():
        return {"command": {"op": "delete_last"}}
    return {"command": {"op": "noop", "payload": {"text": text}}}

app.include_router(calendar.router)
