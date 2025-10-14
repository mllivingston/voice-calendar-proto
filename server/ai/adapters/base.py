from typing import Protocol
from ai.schema import Command

class LLMAdapter(Protocol):
    async def interpret(self, user_text: str, tz: str) -> Command: ...
