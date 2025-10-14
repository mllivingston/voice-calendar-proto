from fastapi import APIRouter
from pydantic import BaseModel
from ai.orchestrator import interpret
from ai.schema import Command

router = APIRouter(prefix="/ai", tags=["ai"])

class InterpretIn(BaseModel):
    text: str
    tz: str | None = None

@router.post("/interpret", response_model=Command)
async def post_interpret(body: InterpretIn):
    tz = body.tz or "America/Los_Angeles"
    return await interpret(body.text, tz)
