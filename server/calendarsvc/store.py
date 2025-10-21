from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
import threading
import uuid

# =========================
# Models
# =========================

@dataclass
class Event:
    id: str
    title: str
    start: str  # ISO string (e.g. 2025-10-21T17:18:01Z)
    end: str    # ISO string or "" if unknown
    data: Dict[str, Any]
    created_at: str  # ISO with offset

    def to_json(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "start": self.start,
            "end": self.end,
            "data": self.data,
            "created_at": self.created_at,
        }

# =========================
# Per-user in-memory state
# =========================
# Current event list (derived from the operation log)
_STORE: Dict[str, List[Event]] = {}

# Operation log (newest-last). Each entry:
#   { "kind": "create", "event": <event_json>, "ts": <iso> }
# We prune this log on undo/replay so history reflects the current timeline.
_OPLOG: Dict[str, List[Dict[str, Any]]] = {}

# IMPORTANT: use a re-entrant lock to avoid deadlock when a locked function
# calls another function that also reads the same structures.
_LOCK = threading.RLock()

# =========================
# Helpers
# =========================

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _default_end_from(start_iso: str) -> str:
    try:
        dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        return (dt + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    except Exception:
        return ""

def _ensure_user(user_id: str) -> None:
    if user_id not in _STORE:
        _STORE[user_id] = []
    if user_id not in _OPLOG:
        _OPLOG[user_id] = []

def _rebuild_from_log(user_id: str) -> None:
    """Recompute the current event list from the pruned operation log."""
    events: List[Event] = []
    for entry in _OPLOG[user_id]:
        if entry.get("kind") == "create":
            d = entry["event"]
            events.append(Event(
                id=str(d.get("id")),
                title=str(d.get("title", "untitled")),
                start=str(d.get("start", "")),
                end=str(d.get("end", "")),
                data=dict(d.get("data") or {}),
                created_at=str(d.get("created_at") or _now_iso()),
            ))
    _STORE[user_id] = events

def _events_json_unlocked(user_id: str) -> List[Dict[str, Any]]:
    """Return events JSON without acquiring the lock (caller already holds it)."""
    return [e.to_json() for e in _STORE[user_id]]

def _history_newest_first(user_id: str, limit: int) -> Dict[str, Any]:
    items = list(reversed(_OPLOG[user_id]))[: max(1, min(500, limit))]
    return {
        "user_id": user_id,
        "limit": limit,
        "items": items,  # [{kind:"create", event:{...}, ts}]
        "total": len(_OPLOG[user_id]),
    }

# =========================
# Public read API
# =========================

def list_events(user_id: str) -> List[Dict[str, Any]]:
    with _LOCK:
        _ensure_user(user_id)
        return _events_json_unlocked(user_id)

def history(user_id: str, limit: int = 50) -> Dict[str, Any]:
    with _LOCK:
        _ensure_user(user_id)
        return _history_newest_first(user_id, limit)

# =========================
# Mutations
# =========================

def _create_event(user_id: str, title: str, start: Optional[str], end: Optional[str]) -> Dict[str, Any]:
    start_iso = (start or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    end_iso = (end if end is not None and end != "" else _default_end_from(start_iso))
    ev = Event(
        id=str(uuid.uuid4()),
        title=title or "untitled",
        start=start_iso,
        end=end_iso,
        data={},
        created_at=_now_iso(),
    )
    _OPLOG[user_id].append({"kind": "create", "event": ev.to_json(), "ts": _now_iso()})
    _rebuild_from_log(user_id)
    return {
        "status": "ok",
        "diff": {"type": "create", "event": ev.to_json()},
        "events": _events_json_unlocked(user_id),
    }

def _delete_last(user_id: str) -> Dict[str, Any]:
    # Legacy single-step undo = remove the last create operation
    if not _OPLOG[user_id]:
        _STORE[user_id] = []
        return {"status": "ok", "diff": {"type": "undo", "undo_of": "noop"}, "events": []}
    last = _OPLOG[user_id].pop()
    deleted_event = last.get("event")
    _rebuild_from_log(user_id)
    return {
        "status": "ok",
        "diff": {"type": "undo", "undo_of": "create", "event": deleted_event},
        "events": _events_json_unlocked(user_id),
    }

def _undo_n(user_id: str, n: int) -> Dict[str, Any]:
    if n <= 0 or not _OPLOG[user_id]:
        return {"status": "ok", "diff": {"type": "undo_batch", "count": 0, "diffs": []}, "events": list_events(user_id)}
    count = min(n, len(_OPLOG[user_id]))
    diffs: List[Dict[str, Any]] = []
    for _ in range(count):
        entry = _OPLOG[user_id].pop()
        diffs.append({"type": "undo", "undo_of": entry.get("kind", "create"), "event": entry.get("event")})
    _rebuild_from_log(user_id)
    return {
        "status": "ok",
        "diff": {"type": "undo_batch", "count": count, "diffs": diffs},
        "events": _events_json_unlocked(user_id),
    }

def _replay_n(user_id: str, n: int) -> Dict[str, Any]:
    # For this legacy contract, "replay_n" means restore to the state n steps before the latest.
    return _undo_n(user_id, n)

def _replay_to_ts(user_id: str, ts_iso: str) -> Dict[str, Any]:
    # Restore to the latest state whose operation timestamp <= ts_iso
    if not ts_iso:
        return {"status": "error", "error": "missing_ts", "events": list_events(user_id)}
    pruned: List[Dict[str, Any]] = []
    for entry in _OPLOG[user_id]:
        ts = str(entry.get("ts", ""))
        if ts <= ts_iso:
            pruned.append(entry)
    _OPLOG[user_id] = pruned
    _rebuild_from_log(user_id)
    return {"status": "ok", "diff": {"type": "replay", "to_ts": ts_iso}, "events": _events_json_unlocked(user_id)}

def apply_command(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    op = str(payload.get("op") or "").strip()
    cmd_type = payload.get("type")

    with _LOCK:
        _ensure_user(user_id)

        if op == "noop":
            return {"status": "ok", "diff": {"type": "noop"}, "events": _events_json_unlocked(user_id)}

        if op in {"delete_last", "undo_last"}:
            return _delete_last(user_id)

        if op == "undo_n":
            n = int(payload.get("n") or 1)
            return _undo_n(user_id, n)

        if op == "replay_n":
            n = int(payload.get("n") or 1)
            return _replay_n(user_id, n)

        if op == "replay_to_ts":
            ts = str(payload.get("ts") or "")
            return _replay_to_ts(user_id, ts)

        if cmd_type == "create_event":
            title = (payload.get("title") or "untitled").strip()
            start = payload.get("start")
            end = payload.get("end")
            return _create_event(user_id, title, start, end)

        return {"status": "error", "error": "unsupported command", "events": _events_json_unlocked(user_id)}
