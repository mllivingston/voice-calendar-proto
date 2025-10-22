from __future__ import annotations
import os, sqlite3, threading, uuid, json
from datetime import datetime
from typing import Any, Dict, List

_DB_PATH = os.getenv("CAL_DB_PATH") or os.path.join("server", "data", "app.db")
os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)

_LOCK = threading.RLock()

def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def _init():
    with _LOCK, _conn() as cx:
        cx.execute("""
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT,
          start TEXT,
          end TEXT,
          created_at TEXT NOT NULL
        )""")
        cx.execute("""
        CREATE TABLE IF NOT EXISTS op_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          ts TEXT NOT NULL,
          kind TEXT NOT NULL,
          payload TEXT
        )""")
        cx.commit()

_init()

def _now_iso() -> str:
    return datetime.now().astimezone().isoformat()

def list_events(user_id: str) -> List[Dict[str, Any]]:
    with _LOCK, _conn() as cx:
        rows = cx.execute(
            "SELECT id, title, start, end, created_at FROM events WHERE user_id=? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]

def history(user_id: str, limit: int = 50) -> Dict[str, Any]:
    with _LOCK, _conn() as cx:
        rows = cx.execute(
            "SELECT id, ts, kind, payload FROM op_log WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
        items = []
        for r in rows:
            payload = None
            try:
                payload = json.loads(r["payload"]) if r["payload"] else None
            except Exception:
                payload = r["payload"]
            items.append({"id": r["id"], "ts": r["ts"], "kind": r["kind"], "payload": payload})
        return {"user_id": user_id, "limit": limit, "items": items, "total": len(items)}

def apply_command(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    kind = "noop"
    diff: Dict[str, Any] = {"type": "noop"}
    with _LOCK, _conn() as cx:
        if payload.get("op") == "noop":
            kind = "noop"
        elif payload.get("op") == "delete_last":
            row = cx.execute(
                "SELECT id FROM events WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
                (user_id,)
            ).fetchone()
            if row:
                ev_id = row["id"]
                cx.execute("DELETE FROM events WHERE id=? AND user_id=?", (ev_id, user_id))
                diff = {"type": "delete", "id": ev_id}
                kind = "delete_last"
        elif (payload.get("type") or "").lower() in {"create_event", "create"}:
            ev_id = str(uuid.uuid4())
            title = payload.get("title") or "(untitled)"
            start = payload.get("start")
            end = payload.get("end")
            ts = _now_iso()
            cx.execute(
                "INSERT INTO events (id, user_id, title, start, end, created_at) VALUES (?,?,?,?,?,?)",
                (ev_id, user_id, title, start, end, ts)
            )
            diff = {"type": "create", "event": {"id": ev_id, "title": title, "start": start, "end": end, "created_at": ts}}
            kind = "create"
        else:
            kind = "noop"

        try:
            cx.execute(
                "INSERT INTO op_log (user_id, ts, kind, payload) VALUES (?,?,?,?)",
                (user_id, _now_iso(), kind, json.dumps(payload, ensure_ascii=False))
            )
        except Exception:
            pass

        cx.commit()

    return {"status": "ok", "diff": diff, "events": list_events(user_id)}
