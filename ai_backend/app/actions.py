import uuid
import time

def generate_recovery_payment_link(amount: int, currency: str, customer_email: str, customer_contact: str, description: str) -> str:
    """Generates a secure checkout payment link for recovered transactions."""
    order_token = uuid.uuid4().hex[:12]
    return f"https://pay.foura.io/recover/{order_token}?curr={currency}&amt={amount/100:.2f}"

def calculate_concession_amount(original_amount: int, discount_pct: float) -> int:
    multiplier = (100.0 - min(discount_pct, 5.0)) / 100.0
    return int(round(original_amount * multiplier))
