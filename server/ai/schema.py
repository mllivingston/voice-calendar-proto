from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal

Action = Literal[
    "create_event", "update_event", "delete_event",
    "move_event", "invite_attendees", "set_reminder", "undo"
]

class TimeWindow(BaseModel):
    date: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    tz: Optional[str] = None

class Target(BaseModel):
    calendar: Optional[str] = "primary"
    match_by_id: Optional[str] = None
    match_by_text: Optional[str] = None
    match_by_time: Optional[TimeWindow] = None

class Reminder(BaseModel):
    method: Literal["popup","email"] = "popup"
    minutes: int = 10

class Params(BaseModel):
    title: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[List[str]] = None
    recurrence: Optional[str] = None
    reminders: Optional[List[Reminder]] = None

class Command(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Action
    target: Target = Field(default_factory=Target)
    params: Params = Field(default_factory=Params)
    confidence: float = 0.0
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
# Forward all symbols to the canonical module
from server.ai.schema import *  # type: ignore
