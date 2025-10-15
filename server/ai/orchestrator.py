from typing import Any, Dict, Optional
import os

def interpret(text: str, *, model: Optional[str] = None) -> Dict[str, Any]:
    """
    Deterministic, startup-safe orchestrator.

    Startup reliability design:
    - Import the OpenAI adapter *inside* the function so module import never fails.
    - If the adapter is missing OR errors, provide a predictable fallback in AUTH_BYPASS mode.
    - Return a minimal Command-shaped dict the rest of the pipeline can consume.
    """
    # Fast path: dev fallback when AUTH_BYPASS is set
    if os.environ.get("AUTH_BYPASS") == "1":
        return {
            "action": "create_event",
            "title": (text or "Untitled").strip()[:120],
            "start": {"iso": None},
            "end": {"iso": None},
            "meta": {"source": "fallback", "text": text},
        }

    # Production path: try the OpenAI LLM adapter (import deferred)
    try:
        # Absolute canonical path; no bare `ai.*`
        from server.ai.adapters.openai_adapter import OpenAILLM  # type: ignore

        llm = OpenAILLM(model=model)
        return llm.interpret(text)
    except Exception as e:
        raise RuntimeError(
            f"LLM adapter failed in orchestrator: {type(e).__name__}: {e}. "
            "Ensure server/ai/adapters/openai_adapter.py exists and its dependencies are installed."
        )
