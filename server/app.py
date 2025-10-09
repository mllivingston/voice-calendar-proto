import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from db.session import init_db
from routers import events, ws, ai

app = FastAPI(title="Voice Calendar Prototype")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(ai.router)
app.include_router(ws.router)

@app.on_event("startup")
def on_startup():
    init_db()

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
