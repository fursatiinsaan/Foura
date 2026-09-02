import asyncio

async def send_recovery_email(to_email: str, subject: str, body_text: str, amount_inr: float, payment_link: str, ai_reasoning: str):
    """Simulates instantaneous transactional email delivery."""
    print(f"[EMAIL DISPATCH] Sent to {to_email} | Subject: {subject}", flush=True)
    return {"status": "delivered", "recipient": to_email, "link": payment_link}
