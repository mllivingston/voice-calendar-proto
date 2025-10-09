from fastapi import APIRouter, Depends
from ai.orchestrator import Orchestrator
from services.events import EventsService
from utils.connections import manager
from auth.deps import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])
orc = Orchestrator(EventsService(), manager)

@router.post("/command")
async def ai_command(payload: dict, user=Depends(get_current_user)):
    text = payload.get("text", "")
    out = await orc.handle_text(user["user_id"], text)
    return out
