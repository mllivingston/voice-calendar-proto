from typing import Dict, Any
from fastapi import HTTPException

from server.calendarsvc.providers import mock as provider  # ✅ canonical absolute import


def apply(cmd: Dict[str, Any], user: Dict[str, Any] | None = None):
    """
    Apply a calendar command (create, update, delete, etc.) for the given user.
    """
    try:
        action = cmd.get("action")
        params = cmd.get("params", {})
        target = cmd.get("target", {})
        user_id = (user or {}).get("id", "dev-bypass")

        if action == "create_event":
            event = {
                "title": params.get("title") or target.get("match_by_text") or "Untitled Event",
                "start": params.get("start"),
                "end": params.get("end"),
                "calendar": target.get("calendar", "primary"),
            }
            ev = provider.create_event(user_id, event)
            return {"status": "ok", "event": ev}

        elif action == "delete_event":
            event_id = target.get("match_by_id")
            if not event_id:
                raise HTTPException(status_code=400, detail="Missing event_id for deletion")
            provider.delete_event(user_id, event_id)
            return {"status": "ok", "deleted": event_id}

        elif action == "update_event":
            event_id = target.get("match_by_id")
            updates = params
            ev = provider.update_event(user_id, event_id, updates)
            return {"status": "ok", "event": ev}

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
