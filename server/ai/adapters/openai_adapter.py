import os, json
from typing import Any, Dict
from openai import AsyncOpenAI
from pydantic import ValidationError
from ai.schema import Command

SYS = """You are a calendar command planner.
Return ONLY JSON per the provided schema. If ambiguous, set needs_clarification=true and include a short clarification_question.
Never invent missing facts. Never free-form text, only JSON.
Rules:
- "target" MUST be a JSON object. If the user mentions a title like "lunch", put it into target.match_by_text.
- "params" MUST be a JSON object (even if empty).
- For actions that set a time (create_event, update_event, move_event), ALWAYS include params.start and params.end as ISO 8601 with timezone (e.g., 2025-10-10T12:00:00-07:00).
- If the user uses relative dates like "today" or "tomorrow", resolve them to an explicit date using the provided timezone.
- If only a single time is given, assume a 30-minute duration unless the user specified a different length.
"""

USER_TMPL = """User timezone: {tz}
Utterance: {text}
Output keys: action, target, params, confidence, needs_clarification, clarification_question
"""

class OpenAILLM:
    def __init__(self, model: str | None = None):
        self.model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set; check server/.env and process env")
        self.client = AsyncOpenAI(api_key=api_key)

    async def interpret(self, user_text: str, tz: str) -> Command:
        msg_user = USER_TMPL.format(tz=tz, text=user_text)
        resp = await self.client.chat.completions.create(
            model=self.model,
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYS},
                {"role": "user", "content": msg_user},
            ],
        )
        raw = resp.choices[0].message.content

        # First attempt: strict parse
        try:
            return Command.model_validate_json(raw)
        except ValidationError:
            # Best-effort normalization for common LLM slips
            data = json.loads(raw)

            # Ensure objects exist
            if isinstance(data.get("target"), str):
                data["target"] = {"match_by_text": data["target"]}
            data.setdefault("target", {})
            data.setdefault("params", {})

            # Fill required top-level keys if missing
            data.setdefault("action", "create_event")
            data.setdefault("confidence", 0.0)
            data.setdefault("needs_clarification", False)

            # If a time-setting action is missing start/end, ask for clarification
            if data.get("action") in {"create_event", "update_event", "move_event"}:
                ps = data.get("params", {})
                if not (ps.get("start") and ps.get("end")):
                    data["needs_clarification"] = True
                    data["clarification_question"] = (
                        "What date and start/end time should I use? "
                        "Please specify both (e.g., 2025-10-10 12:00–12:45, "
                        "America/Los_Angeles)."
                    )

            # Try again
            return Command.model_validate(data)
