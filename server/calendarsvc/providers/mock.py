from __future__ import annotations
from typing import Any, Dict, List, Optional
from collections import defaultdict
import uuid

# Per-user in-memory store: USER_DB[user_id][event_id] = event dict
USER_DB: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

def list_events(user_id: str) -> List[Dict[str, Any]]:
    db = USER_DB[user_id]
    return list(db.values())

def create_event(user_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    db = USER_DB[user_id]
    eid = event.get("id") or str(uuid.uuid4())
    ev = dict(event)
    ev["id"] = eid
    db[eid] = ev
    return ev

def update_event(user_id: str, event_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    db = USER_DB[user_id]
    if event_id not in db:
        raise KeyError("event not found")
    db[event_id].update(patch)
    return db[event_id]

def delete_event(user_id: str, event_id: str) -> None:
    db = USER_DB[user_id]
    if event_id in db:
        del db[event_id]
