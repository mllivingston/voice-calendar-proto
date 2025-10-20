from __future__ import annotations

import os
import time
from typing import Callable, Awaitable

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in {"1", "true", "yes", "y"}


class _RequestLogMiddleware(BaseHTTPMiddleware):
    """
    Tiny, dependency-free request logger.

    Logs one line per request:
      method path status ms user

    'user' is best-effort; in bypass dev it emits 'dev-bypass',
    otherwise '-' (we don’t dig into dependencies to read auth state).
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable]):
        t0 = time.perf_counter()
        try:
            response = await call_next(request)
            status = response.status_code
        except Exception:
            status = 500
            raise
        finally:
            dt_ms = int((time.perf_counter() - t0) * 1000)
            user = "dev-bypass" if _truthy(os.getenv("AUTH_BYPASS")) else "-"
            # Compact one-liner for easy grepping
            print(f"[REQ] {request.method} {request.url.path} {status} {dt_ms}ms user={user}")
        return response


def attach_observability(app: FastAPI) -> FastAPI:
    """
    Adds the lightweight request logger middleware.
    Safe to call multiple times (middleware stacking is idempotent for this class).
    """
    app.add_middleware(_RequestLogMiddleware)
    return app


def startup_banner(app: FastAPI) -> None:
    """
    Prints a short banner on startup: bypass mode, JWT secret presence, and route count.
    """
    auth_bypass = _truthy(os.getenv("AUTH_BYPASS"))
    has_secret = bool(os.getenv("SUPABASE_JWT_SECRET"))
    route_count = len(app.router.routes)

    print("—" * 72)
    print(" Voice Calendar Proto — Backend Startup")
    print(f"  AUTH_BYPASS: {'ON' if auth_bypass else 'OFF'}")
    print(f"  SUPABASE_JWT_SECRET set: {'yes' if has_secret else 'no'}")
    print(f"  Registered routes: {route_count}")
    print("—" * 72)
