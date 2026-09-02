from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, func
from app.database import Base

class PaymentRecoveryEvent(Base):
    __tablename__ = "payment_recovery_events"

    id = Column(String, primary_key=True, index=True)
    amount = Column(Integer, nullable=False)
    currency = Column(String, default="USD")
    method = Column(String, default="card")
    error_code = Column(String, index=True)
    error_description = Column(String)
    customer_contact = Column(String)
    customer_name = Column(String, default="Customer")
    cart_category = Column(String, default="Digital Store")
    customer_tier = Column(String, default="Standard Buyer")
    historical_retry_count = Column(Integer, default=0)
    bank_health_snapshot = Column(JSON)
    recommended_action = Column(String)
    execution_delay_minutes = Column(Integer, default=0)
    confidence_score = Column(Float, default=0.9)
    ai_reasoning = Column(String)
    custom_message = Column(String)
    guardrail_overridden = Column(String, nullable=True)
    is_recovered = Column(Integer, default=0, index=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
