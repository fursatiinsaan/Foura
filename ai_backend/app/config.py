import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = "rzp_test_TSnnftbAI9CJQs"
    RAZORPAY_KEY_SECRET: str = "SjYuLIVvekZV0oqIsklF5YTP"
    RAZORPAY_WEBHOOK_SECRET: str = "super-secret-key"
    DATABASE_URL: str = "sqlite+aiosqlite:///./recovery_agent.db"
    DEFAULT_CURRENCY: str = "USD"
    MAX_RETRIES_LIMIT: int = 3
    DEFAULT_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
