from sqlalchemy import Column, String, Integer, Float, DateTime, JSON
from datetime import datetime, timezone
from app.database import Base

class PaymentRecoveryEvent(Base):
    __tablename__ = "payment_recovery_events"

    id = Column(String, primary_key=True, index=True)
    amount = Column(Integer, nullable=False)
    currency = Column(String, default="INR")
    method = Column(String, nullable=False)
    error_code = Column(String, nullable=False)
    error_description = Column(String, nullable=False)
    customer_contact = Column(String, nullable=True)
    
    historical_retry_count = Column(Integer, default=0)
    bank_health_snapshot = Column(JSON, nullable=True)
    
    recommended_action = Column(String, nullable=True)
    execution_delay_minutes = Column(Integer, default=0)
    confidence_score = Column(Float, nullable=True)
    ai_reasoning = Column(String, nullable=True)
    custom_message = Column(String, nullable=True)
    
    guardrail_overridden = Column(String, nullable=True)
    customer_name = Column(String, default="Valued Customer")
    cart_category = Column(String, default="E-Commerce Checkout")
    customer_tier = Column(String, default="Standard Buyer")
    is_recovered = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
