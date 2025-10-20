from __future__ import annotations
from fastapi import FastAPI
from server.routes import calendar as calendar_routes
from server.routes import ai as ai_routes

# 🔎 Observability (tiny, additive)
from server.observability import attach_observability, startup_banner

app = FastAPI(title="Voice Calendar Proto")

# Mount routers (routers already include their own prefixes)
app.include_router(calendar_routes.router)
app.include_router(ai_routes.router)

# Attach tiny request logger and print a startup banner
attach_observability(app)
startup_banner(app)


@app.get("/healthz")
def healthz():
    import os
    return {
        "ok": True,
        "auth_bypass": os.getenv("AUTH_BYPASS") in {"1", "true", "yes", "y"},
        "has_secret": bool(os.getenv("SUPABASE_JWT_SECRET")),
    }
