from __future__ import annotations

import json
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from server.auth import get_current_user, AuthUser

# OpenAI client (expects OPENAI_API_KEY in env; already used elsewhere in this repo)
try:
    from openai import OpenAI
    _openai_client = OpenAI()
except Exception as e:
    _openai_client = None

router = APIRouter(prefix="/ai", tags=["ai"])

SYSTEM_PROMPT = """You are a calendar command generator.
Return ONLY a JSON object that matches one of these shapes:

1) Create:
{
  "type": "create_event",
  "title": "<short title>",
  "start": "<ISO8601 with timezone, e.g. 2025-10-16T09:30:00-07:00>",
  "end":   "<ISO8601 with timezone>"
}

2) Delete last:
{ "op": "delete_last" }

Rules:
- If the user says "delete last", use the delete shape.
- Otherwise assume create.
- Use the user's timezone and current date context provided to you.
- Never return null for start or end. If duration is spoken (e.g., "for 30 minutes"), compute end; otherwise default duration = 30 minutes.
- If no title is provided, use "untitled".
- Do NOT include extra top-level properties. Do NOT wrap the object in another key.
"""

def _llm_interpret(text: str, tz: str, now_iso: str) -> Dict[str, Any]:
    if _openai_client is None:
        raise HTTPException(status_code=500, detail="LLM client not available on server")

    user_context = f"""User timezone: {tz}
Current datetime (ISO): {now_iso}
User said: {text}"""

    resp = _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_context},
        ],
    )
    raw = resp.choices[0].message.content or "{}"
    try:
        cmd = json.loads(raw)
        if not isinstance(cmd, dict):
            raise ValueError("not an object")
    except Exception:
        raise HTTPException(status_code=422, detail="Interpreter returned non-JSON")

    # Validate minimal fields and normalize to backend contract
    if cmd.get("op") == "delete_last":
        return {"op": "delete_last"}

    # create_event defaulting
    if cmd.get("type") != "create_event":
        cmd["type"] = "create_event"
    cmd.setdefault("title", "untitled")

    # ensure start/end are present and ISO strings
    if not cmd.get("start") or not cmd.get("end"):
        raise HTTPException(status_code=422, detail="Interpreter missing start/end")
    if not isinstance(cmd["start"], str) or not isinstance(cmd["end"], str):
        raise HTTPException(status_code=422, detail="Interpreter produced invalid datetimes")

    return cmd

@router.post("/interpret")
def interpret(body: Dict[str, Any], user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Body accepted from the frontend: { "text": str, "tz": str }
    Returns { "command": <create_event|delete_last>, "user": {...} }
    """
    text = (body.get("text") or "").strip()
    tz = (body.get("tz") or "America/Los_Angeles").strip() or "America/Los_Angeles"
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    # Use server-side current timestamp (ISO) just for grounding
    from datetime import datetime
    now_iso = datetime.now().astimezone().isoformat()

    cmd = _llm_interpret(text=text, tz=tz, now_iso=now_iso)
    return {
        "command": cmd,
        "user": {"sub": user.sub, "email": user.email},
    }
