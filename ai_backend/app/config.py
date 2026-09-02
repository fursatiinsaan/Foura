import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Razorpay AI Revenue Recovery Agent"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./recovery_agent.db")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "super-secret-key")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    
    # Email Settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")

    class Config:
        env_file = ".env"

settings = Settings()
