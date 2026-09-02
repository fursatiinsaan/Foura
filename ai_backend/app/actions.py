import razorpay
import time
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Razorpay Client
rzp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

def generate_recovery_payment_link(amount: int, currency: str, customer_email: str, customer_contact: str, description: str) -> str:
    """
    Calls the actual Razorpay API to generate a new Payment Link for recovery.
    amount should be in paise (e.g. 50000 for 500 INR).
    """
    try:
        if "yourkeyid" in settings.RAZORPAY_KEY_ID:
            # Fallback for dev mode when API keys aren't set
            return "https://rzp.io/i/mock-test-link"
            
        payment_link_data = {
            "amount": amount,
            "currency": currency,
            "accept_partial": False,
            "description": description,
            "customer": {
                "name": "Customer",
                "email": customer_email,
                "contact": customer_contact
            },
            "notify": {
                "sms": True, # Automatically sends SMS via Razorpay
                "email": True
            },
            "reminder_enable": True,
            "expire_by": int(time.time()) + (24 * 60 * 60) # Expires in 24 hours
        }
        
        response = rzp_client.payment_link.create(payment_link_data)
        return response.get('short_url')
        
    except Exception as e:
        logger.error(f"Failed to create Razorpay Payment Link: {str(e)}")
        return "https://rzp.io/i/fallback-link"
