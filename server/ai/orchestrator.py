import os
from ai.adapters.openai_adapter import OpenAILLM
from ai.schema import Command
from ai.policies import require_confirmation

def get_llm():
    prov = os.getenv("LLM_PROVIDER","openai").lower()
    if prov == "openai":
        return OpenAILLM()
    raise RuntimeError(f"Unsupported LLM provider: {prov}")

async def interpret(user_text: str, tz: str) -> Command:
    cmd = await get_llm().interpret(user_text, tz)
    cmd = require_confirmation(cmd)
    return cmd
