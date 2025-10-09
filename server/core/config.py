from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    cors_origins: List[str] = ["http://localhost:3000"]
    database_url: str = "sqlite:///./calendar.db"
    # LLM (optional)
    llm_provider: Optional[str] = None   # e.g., "openai"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"

settings = Settings()
