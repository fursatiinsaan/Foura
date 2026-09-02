from pydantic import BaseModel
from typing import Optional, Dict, Any

class TelemetryEventSchema(BaseModel):
    payment_id: str
    amount: int
    currency: str
    method: str
    error_code: str
    error_description: Optional[str] = None
    customer_email: str
    customer_name: Optional[str] = None
    cart_category: Optional[str] = None
    customer_tier: Optional[str] = None
    bank_health_snapshot: Optional[Dict[str, float]] = None

class RecoveryActionResponse(BaseModel):
    status: str
    id: str
    action_taken: str
    timestamp: str
