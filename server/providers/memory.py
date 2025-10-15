from __future__ import annotations

from typing import Dict, List, Optional
import uuid


class MemoryProvider:
    """
    Minimal in-memory event store used by calendarsvc.tools and routes.
    Structure:
      USER_DB[user_id][event_id] = event_dict
    """

    def __init__(self) -> None:
        self.USER_DB: Dict[str, Dict[str, dict]] = {}

    # internal
    def _bucket(self, user_id: str) -> Dict[str, dict]:
        return self.USER_DB.setdefault(user_id, {})

    # CRUD surface (simple and predictable)
    def create(self, user_id: str, event: dict) -> dict:
        eid = event.get("id") or str(uuid.uuid4())
        stored = {**event, "id": eid}
        self._bucket(user_id)[eid] = stored
        return stored

    def update(self, user_id: str, event_id: str, patch: dict) -> dict:
        bucket = self._bucket(user_id)
        if event_id not in bucket:
            raise KeyError(f"event not found: {event_id}")
        bucket[event_id].update(patch)
        return bucket[event_id]

    def delete(self, user_id: str, event_id: str) -> bool:
        return self._bucket(user_id).pop(event_id, None) is not None

    def list(self, user_id: Optional[str] = None) -> List[dict]:
        if user_id:
            return list(self._bucket(user_id).values())
        # Flatten all users (used by some legacy list paths)
        out: List[dict] = []
        for m in self.USER_DB.values():
            out.extend(m.values())
        return out


# Canonical instance expected by calendarsvc.tools and others
provider = MemoryProvider()

# Legacy export some code relies on
USER_DB = provider.USER_DB
 