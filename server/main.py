from __future__ import annotations
from fastapi import FastAPI
from server.routes import calendar as calendar_routes
from server.routes import ai as ai_routes

app = FastAPI(title="Voice Calendar Proto")

# Mount routers
app.include_router(calendar_routes.router)
app.include_router(ai_routes.router)

@app.get("/healthz")
def healthz():
    import os
    return {
        "ok": True,
        "auth_bypass": os.getenv("AUTH_BYPASS") == "1",
        "has_secret": bool(os.getenv("SUPABASE_JWT_SECRET")),
    }
