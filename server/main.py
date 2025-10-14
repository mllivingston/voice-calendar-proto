from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Use package-absolute imports so running from repo root works
from server.routes import ai as ai_routes
from server.routes import calendar as calendar_routes

app = FastAPI(title="Voice Calendar Proto")

# Local dev CORS (safe for localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(ai_routes.router, prefix="/ai")
app.include_router(calendar_routes.router, prefix="/calendar")

@app.get("/health")
def health():
    return {"ok": True}
