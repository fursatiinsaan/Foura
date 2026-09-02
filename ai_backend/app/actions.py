import uuid
import time
import razorpay
from app.config import settings

def get_razorpay_client():
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET and not settings.RAZORPAY_KEY_ID.startswith("rzp_test_xxxx"):
        try:
            return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        except Exception as e:
            print(f"[RAZORPAY CLIENT] Error initializing client: {e}", flush=True)
    return None

def generate_recovery_payment_link(amount: int, currency: str, customer_email: str, customer_contact: str, description: str) -> str:
    """Generates an official Razorpay live payment link with fallback."""
    client = get_razorpay_client()
    curr = currency.upper() if currency else "INR"
    
    if client and curr == "INR":
        try:
            link_payload = {
                "amount": int(amount), # amount in paise
                "currency": "INR",
                "accept_partial": False,
                "description": description,
                "customer": {
                    "name": customer_email.split('@')[0].capitalize(),
                    "email": customer_email,
                    "contact": customer_contact
                },
                "notify": {
                    "sms": False,
                    "email": True
                },
                "reminder_enable": True,
                "notes": {
                    "recovery_agent": "Foura_AI_Track_03",
                    "idempotency_token": uuid.uuid4().hex[:12]
                }
            }
            rzp_link = client.payment_link.create(link_payload)
            if "short_url" in rzp_link:
                print(f"[RAZORPAY LIVE LINK] Generated: {rzp_link['short_url']}", flush=True)
                return rzp_link["short_url"]
        except Exception as e:
            print(f"[RAZORPAY SDK] Live API link generation fallback: {e}", flush=True)

    order_token = uuid.uuid4().hex[:12]
    return f"https://pay.foura.io/recover/{order_token}?curr={curr}&amt={amount/100:.2f}"

def calculate_concession_amount(original_amount: int, discount_pct: float) -> int:
    multiplier = (100.0 - min(discount_pct, 5.0)) / 100.0
    return int(round(original_amount * multiplier))

