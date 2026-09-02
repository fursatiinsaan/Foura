from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from database import Base
import datetime

class PaymentFailure(Base):
    __tablename__ = "payment_failures"

    id = Column(String, primary_key=True, index=True) # Payment ID from Razorpay
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    status = Column(String, default="failed")
    failure_reason = Column(String, nullable=True)
    customer_id = Column(String, nullable=True) # Razorpay Customer ID or internal
    customer_email = Column(String, nullable=True)
    customer_contact = Column(String, nullable=True)
    
    # Context (simulated or real from DB)
    customer_ltv = Column(Float, default=0.0)
    customer_successful_payments = Column(Integer, default=0)
    customer_failed_payments = Column(Integer, default=0)
    
    # Engine output
    recovery_score = Column(Float, nullable=True)
    recovery_probability = Column(String, nullable=True) # HIGH, MEDIUM, LOW
    recommended_action = Column(String, nullable=True)
    discount_required = Column(Boolean, default=False)
    ai_reasoning = Column(String, nullable=True)
    personalized_message = Column(String, nullable=True)
    agent_logs = Column(String, nullable=True) # JSON serialized logs
    
    # Recovery Status
    is_recovered = Column(Boolean, default=False)
    recovered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
