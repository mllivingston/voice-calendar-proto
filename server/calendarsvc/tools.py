from __future__ import annotations

from typing import Dict, Any, List, Optional
from dataclasses import asdict, is_dataclass

# Canonical provider (simple in-memory store)
from server.providers.memory import provider

# Command schema (used for types only; code tolerates missing fields defensively)
try:
    from server.ai.schema import Command  # type: ignore
except Exception:  # pragma: no cover - allow import to fail at type-check time
    Command = Any  # type: ignore


__all__ = ["MutateError", "apply", "list_events"]


# ----- Errors -----------------------------------------------------------------
class MutateError(Exception):
    """Raised when a mutation cannot be applied (invalid target/action/params)."""


# ----- Helpers ----------------------------------------------------------------
def _ensure_dict(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if is_dataclass(obj):
        return asdict(obj)
    try:
        # Pydantic models
        return obj.model_dump()  # type: ignore[attr-defined]
    except Exception:
        return dict(obj) if hasattr(obj, "__iter__") else {"value": obj}


def _build_event_from_params(params: Dict[str, Any]) -> Dict[str, Any]:
    title = (params.get("title") or "Untitled").strip()
    start = params.get("start")
    end = params.get("end")
    location = params.get("location")
    attendees = params.get("attendees") or []
    return {
        "title": title,
        "start": start,
        "end": end,
        "location": location,
        "attendees": attendees,
    }


# ----- Public surface expected by routes --------------------------------------
def list_events(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Return a list of events. If user_id is None, return a flattened list
    across all users. (Route code may call without user context.)
    """
    return provider.list(user_id=user_id)


def apply(cmd: Command) -> Dict[str, Any]:
    """
    Apply a mutation Command and return a result dict.

    This function is intentionally tolerant of shape differences to avoid
    startup/import fragility. It accepts either Pydantic objects or plain dicts.
    """
    # Convert possibly-Pydantic model into a dict
    c = _ensure_dict(cmd)

    action = c.get("action")
    target = _ensure_dict(c.get("target"))
    params = _ensure_dict(c.get("params"))

    # For now, default to a global bucket if no per-user context is provided.
    # The calendar route currently doesn't pass user_id through to apply().
    user_id = target.get("user_id") or "global"

    # ----- create_event --------------------------------------------------------
    if action == "create_event":
        event = _build_event_from_params(params)
        created = provider.create(user_id, event)
        return {"created": created}

    # ----- delete_event --------------------------------------------------------
    if action == "delete_event":
        event_id = target.get("match_by_id")
        if not event_id:
            raise MutateError("delete_event requires target.match_by_id")
        ok = provider.delete(user_id, event_id)
        if not ok:
            raise MutateError(f"event not found: {event_id}")
        return {"deleted": event_id}

    # ----- update_event / move_event (minimal) --------------------------------
    if action in ("update_event", "move_event"):
        event_id = target.get("match_by_id")
        if not event_id:
            raise MutateError(f"{action} requires target.match_by_id")
        patch = _build_event_from_params(params)
        updated = provider.update(user_id, event_id, {k: v for k, v in patch.items() if v is not None})
        return {"updated": updated}

    # ----- unsupported actions -------------------------------------------------
    raise MutateError(f"unsupported action: {action!r}")
