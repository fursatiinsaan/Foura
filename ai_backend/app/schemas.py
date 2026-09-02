from pydantic import BaseModel, Field, EmailStr
from enum import Enum
from typing import Optional, Dict

class WebhookPaymentEntity(BaseModel):
    id: str = "pay_unknown"
    amount: int = 0
    currency: str = "INR"
    method: str = "unknown"
    error_code: Optional[str] = "UNKNOWN_ERROR"
    error_description: Optional[str] = "Payment failed"
    email: Optional[str] = "customer@example.com"
    contact: Optional[str] = "+910000000000"

class WebhookPayload(BaseModel):
    payment: Dict[str, WebhookPaymentEntity]

class RazorpayFailureWebhook(BaseModel):
    event: str
    payload: WebhookPayload

class SystemTelemetryState(BaseModel):
    bank_gateway_health: Dict[str, float] = Field(
        description="Current success rate (0.0-1.0) of specific banks/methods"
    )
    time_of_month: int = Field(ge=1, le=31, description="Day of the month, affects liquidity patterns")
    historical_retry_count: int = Field(ge=0, description="Number of times this specific payment has been retried")

class RecommendedActionEnum(str, Enum):
    PREDICTIVE_RETRY = "PREDICTIVE_RETRY"
    SOFT_NUDGE_WHATSAPP = "SOFT_NUDGE_WHATSAPP"
    INTENT_SWITCH_FALLBACK = "INTENT_SWITCH_FALLBACK"
    HARD_FAIL_ABANDON = "HARD_FAIL_ABANDON"

class AIDecisionOutput(BaseModel):
    recommended_action: RecommendedActionEnum = Field(
        description="The chosen recovery action strategy."
    )
    execution_timestamp_delay_minutes: int = Field(
        description="How many minutes to delay the execution of the action. 0 for immediate."
    )
    confidence_score: float = Field(
        ge=0.0, le=1.0, description="AI's confidence in this recovery strategy."
    )
    ai_reasoning: str = Field(
        description="Explicit explanation of the decision linking failure context, telemetry, and action."
    )
    custom_message_payload: Optional[str] = Field(
        default=None, description="Localized, personalized message to send to the user if applicable."
    )
