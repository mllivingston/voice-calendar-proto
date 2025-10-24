from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import List, Optional, Literal, Dict, Any
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI(title="Voice Calendar Proto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev-only; hardened in Phase 9/17
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Auth (HS256 mock verify toggle)
# -----------------------------------------------------------------------------
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", "false").lower() == "true"
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

class User(BaseModel):
    sub: str
    email: Optional[str] = None

def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[User]:
    if not AUTH_REQUIRED:
        return User(sub="dev-user")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    # Minimal HS256 decode (by contract from earlier phases). Real verify is in Phase 9/17.
    import base64, json
    try:
        # naive split; we only need payload (index 1)
        parts = token.split(".")
        if len(parts) < 2:
            raise ValueError("bad token")
        payload = parts[1] + "=="
        data = json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
        return User(sub=data.get("sub", "unknown"), email=data.get("email"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# -----------------------------------------------------------------------------
# In-memory event store (per-user mock)
# -----------------------------------------------------------------------------
class Event(BaseModel):
    id: str
    title: Optional[str] = None
    start: datetime
    end: datetime

# user_id -> list[Event]
EVENTS: Dict[str, List[Event]] = {}

def events_for(user: User) -> List[Event]:
    return EVENTS.setdefault(user.sub, [])

# -----------------------------------------------------------------------------
# AI schemas
# -----------------------------------------------------------------------------
class Command(BaseModel):
    op: Literal["create", "update", "delete", "move"] = "create"
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    target_id: Optional[str] = None
    confidence: float = 1.0
    needs_clarify: bool = False
    clarify_prompt: Optional[str] = None
    clarify_options: Optional[List[str]] = None

class InterpretRequest(BaseModel):
    utterance: str

class InterpretResponse(BaseModel):
    command: Command

class ClarifyOption(BaseModel):
    text: str
    # Optionally include structured patches in future iterations
    patch: Optional[Dict[str, Any]] = None

class ClarifyRequest(BaseModel):
    utterance: str
    options: List[ClarifyOption]
    selection_index: int = Field(ge=0)

class ClarifyResult(BaseModel):
    confirmed: bool
    command: Command

# -----------------------------------------------------------------------------
# /ai/interpret — returns Command; low confidence triggers clarify flow
# -----------------------------------------------------------------------------
@app.post("/ai/interpret", response_model=InterpretResponse)
def ai_interpret(body: InterpretRequest, user: Optional[User] = Depends(get_current_user)):
    text = body.utterance.strip().lower()

    # Extremely small heuristic for Phase 6 bring-up; replaced in later phases by real LLM adapter.
    now = datetime.now()
    default_start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    default_end = default_start + timedelta(hours=1)

    command = Command(
        op="create",
        title=None,
        start=None,
        end=None,
        confidence=0.55,
        needs_clarify=True,
        clarify_prompt="I found multiple ways to interpret this. Which did you mean?",
        clarify_options=[
            "Create a one-hour event starting next hour",
            "Create a 30-minute event starting in 30 minutes",
            "Discard",
        ],
    )

    # Simple fast-path: if the utterance is explicit enough, auto-apply later.
    if "tomorrow" in text and "at" in text:
        command.needs_clarify = False
        command.confidence = 0.9
        command.title = body.utterance
        # naive parse: tomorrow at 9 → 09:00 local
        # (Phase 6 focuses on dialog; robust NLP remains in the LLM adapter)
        command.start = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
        command.end = command.start + timedelta(hours=1)

    return InterpretResponse(command=command)

# -----------------------------------------------------------------------------
# /ai/clarify — confirm a selected option → returns finalized Command
# -----------------------------------------------------------------------------
@app.post("/ai/clarify", response_model=ClarifyResult)
def ai_clarify(body: ClarifyRequest, user: Optional[User] = Depends(get_current_user)):
    if body.selection_index < 0 or body.selection_index >= len(body.options):
        raise HTTPException(status_code=400, detail="selection_index out of range")

    choice = body.options[body.selection_index].text.strip().lower()
    now = datetime.now()

    start = None
    end = None
    title = body.utterance

    if "one-hour event starting next hour" in choice:
        start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=1)
    elif "30-minute event starting in 30 minutes" in choice:
        start = (now + timedelta(minutes=30)).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=30)
    elif "discard" in choice:
        return ClarifyResult(
            confirmed=False,
            command=Command(op="create", title=None, start=None, end=None, confidence=0.0, needs_clarify=False),
        )
    else:
        # Fallback: accept utterance as title with a default window
        start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=1)

    cmd = Command(
        op="create",
        title=title,
        start=start,
        end=end,
        confidence=0.95,
        needs_clarify=False,
    )
    return ClarifyResult(confirmed=True, command=cmd)

# -----------------------------------------------------------------------------
# /calendar/mutate — minimal mock to apply Command
# -----------------------------------------------------------------------------
class MutationRequest(BaseModel):
    command: Command

class MutateDiff(BaseModel):
    type: Literal["create", "update", "delete", "move"]
    event: Optional[Event] = None
    target_id: Optional[str] = None

class MutationResponse(BaseModel):
    status: Literal["ok", "error"]
    diff: Optional[MutateDiff] = None
    message: Optional[str] = None

@app.post("/calendar/mutate", response_model=MutationResponse)
def calendar_mutate(body: MutationRequest, user: User = Depends(get_current_user)):
    cmd = body.command

    if cmd.op == "create":
        if not cmd.start or not cmd.end:
            return MutationResponse(status="error", message="Missing start/end for create")
        ev = Event(id=str(uuid4()), title=cmd.title, start=cmd.start, end=cmd.end)
        events_for(user).append(ev)
        return MutationResponse(status="ok", diff=MutateDiff(type="create", event=ev))

    if cmd.op == "delete":
        if not cmd.target_id:
            return MutationResponse(status="error", message="Missing target_id for delete")
        lst = events_for(user)
        before = len(lst)
        lst[:] = [e for e in lst if e.id != cmd.target_id]
        if len(lst) == before:
            return MutationResponse(status="error", message="Not found")
        return MutationResponse(status="ok", diff=MutateDiff(type="delete", target_id=cmd.target_id))

    if cmd.op == "move":
        if not cmd.target_id or not cmd.start or not cmd.end:
            return MutationResponse(status="error", message="Missing fields for move")
        for e in events_for(user):
            if e.id == cmd.target_id:
                e.start, e.end = cmd.start, cmd.end
                return MutationResponse(status="ok", diff=MutateDiff(type="move", event=e))
        return MutationResponse(status="error", message="Not found")

    if cmd.op == "update":
        if not cmd.target_id:
            return MutationResponse(status="error", message="Missing target_id for update")
        for e in events_for(user):
            if e.id == cmd.target_id:
                if cmd.title is not None:
                    e.title = cmd.title
                if cmd.start is not None:
                    e.start = cmd.start
                if cmd.end is not None:
                    e.end = cmd.end
                return MutationResponse(status="ok", diff=MutateDiff(type="update", event=e))
        return MutationResponse(status="error", message="Not found")

    return MutationResponse(status="error", message=f"Unsupported op {cmd.op}")

# -----------------------------------------------------------------------------
# /calendar/list — tiny helper for manual checks (used by dev pages)
# -----------------------------------------------------------------------------
class ListResponse(BaseModel):
    events: List[Event]

@app.get("/calendar/list", response_model=ListResponse)
def calendar_list(user: User = Depends(get_current_user)):
    return ListResponse(events=events_for(user))
