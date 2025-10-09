from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime
import uuid

class Event(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True)
    title: str
    start_at: Optional[str] = None   # ISO string
    end_at: Optional[str] = None
    all_day: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
