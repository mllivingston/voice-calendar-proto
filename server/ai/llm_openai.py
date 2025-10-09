import json
from typing import Dict
from core.config import settings
from openai import OpenAI

SYSTEM = (
    "You are a calendar operator. Return pure JSON with keys: "
    "intent(add|list|delete), title(string|null), start_at(ISO8601|null), "
    "end_at(ISO8601|null), all_day(boolean). If ambiguous, choose reasonable defaults. "
    "Output ONLY JSON."
)

class LLMOpenAI:
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def route(self, user_text: str) -> Dict:
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role":"system","content": SYSTEM}, {"role":"user","content": user_text}],
            temperature=0.2,
        )
        txt = (resp.choices[0].message.content or "{}").strip()
        try:
            return json.loads(txt)
        except Exception:
            return {"intent":"unknown","title":None,"start_at":None,"end_at":None,"all_day":False}
