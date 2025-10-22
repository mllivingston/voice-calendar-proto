# server/calendarsvc/__init__.py
from __future__ import annotations
import os

_backend = (os.getenv("CAL_STORE_BACKEND") or "memory").strip().lower()

if _backend == "sqlite":
    # SQLite-backed durable store
    from . import store_sqlite as store  # re-export as module name "store"
else:
    # Default to in-memory store (existing behavior)
    from . import store as store  # type: ignore

__all__ = ["store"]
