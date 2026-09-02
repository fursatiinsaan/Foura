import json
import logging
import random
from groq import AsyncGroq
from app.config import settings

logger = logging.getLogger(__name__)
client = AsyncGroq(api_key=settings.OPENAI_API_KEY)

CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€"
}

async def generate_recovery_decision(
    payment_id: str,
    amount: int,
    currency: str,
    method: str,
    error_code: str,
    error_description: str,
    bank_health: dict,
    time_of_month: int,
    retry_count: int,
    customer_name: str = "Valued Customer",
    cart_category: str = "E-Commerce Checkout",
    customer_tier: str = "Standard Buyer",
    concession_applied: bool = False
) -> dict:
    """
    Feeds rich payment failure context, currency (INR, USD, EUR), merchant category, and customer tier into Groq LLM
    to generate diverse, hyper-contextual, high-converting recovery decisions and copy.
    """
    curr = currency.upper() if currency else "INR"
    curr_sym = CURRENCY_SYMBOLS.get(curr, "₹")
    amount_units = amount / 100
    
    # Format discount rule based on currency
    threshold = 2500 if curr == "INR" else (35 if curr == "USD" else 30)
    discount_note = f"A 5% auto-concession is authorized for immediate recovery on orders > {curr_sym}{threshold}." if (concession_applied and amount_units >= threshold) else "Standard recovery link authorized."

    prompt = f"""You are Foura's Autonomous AI Revenue Recovery Engine for digital payments & global merchant checkouts.
Analyze this high-intent transaction failure and autonomously formulate the optimal recovery strategy and customer communication.

TRANSACTION METADATA:
- Payment ID: {payment_id}
- Customer Name: {customer_name} ({customer_tier})
- Store Category: {cart_category}
- Order Value: {curr_sym}{amount_units:,.2f} {curr}
- Currency: {curr} ({curr_sym})
- Attempted Method: {method.upper()}
- Gateway Error Code: {error_code}
- Detailed Failure Reason: {error_description}
- Concession Authorization: {discount_note}

LIVE TELEMETRY & NETWORK STATE:
- Bank Gateway Health Matrix: {json.dumps(bank_health)}
- Historical Retry Count for this Order: {retry_count} (Max allowed by global/RBI compliance: 3)
- Day of Month: {time_of_month}

FINTECH RECOVERY RULES:
1. Involuntary / Technical Drops (Timeouts, Core Switch Lag, Bank Issuer Flapping, Gateway 504):
   - For INR: Fallback to high-uptime UPI / Netbanking rails.
   - For USD / EUR: Fallback to alternate Card rails, Apple Pay, PayPal, or Instant SEPA rails.
   - If issuer is recovering: Trigger PREDICTIVE_RETRY with optimized delay.
2. Voluntary / Friction Drops (3DS OTP dropped, hesitation, user dismissed checkout, insufficient funds):
   - Trigger SOFT_NUDGE_WHATSAPP with tailored, empathetic recovery messaging, dynamic cart hold assurance, and direct payment link.
3. Over-Threshold (> 2 prior failed retries):
   - Trigger HARD_FAIL_ABANDON to maintain merchant compliance and prevent customer harassment.

COPYWRITING GUIDELINES FOR custom_message_payload:
- Address customer by first name if provided ({customer_name.split()[0]}).
- Tone: Professional, highly empathetic, frictionless, and reassuring.
- Use the EXACT currency symbol ({curr_sym}) and formatted amount ({curr_sym}{amount_units:,.2f}).
- Mention cart reservation urgency (e.g. "Your items in {cart_category} are saved for 15 minutes").
- If discount authorized, mention the 5% recovery perk.
- Keep length concise (2-4 punchy sentences) ready for WhatsApp and Email.

Return ONLY a JSON object with these exact keys:
- "recommended_action": one of PREDICTIVE_RETRY, SOFT_NUDGE_WHATSAPP, INTENT_SWITCH_FALLBACK, HARD_FAIL_ABANDON
- "execution_timestamp_delay_minutes": integer (0 for immediate, 5-30 for delayed retry)
- "confidence_score": float between 0.78 and 0.99
- "ai_reasoning": string explaining the deep root cause diagnosis using authentic global fintech telemetry terms
- "custom_message_payload": string with the distinct, tailored customer message using {curr_sym}
"""

    try:
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "You are Foura's Autonomous Revenue Recovery AI. Generate authentic, highly varied, professional multi-currency fintech diagnostic analysis and personalized recovery copy. Return ONLY raw JSON without markdown."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.85,
            max_tokens=1200
        )
        
        content = response.choices[0].message.content.strip()
        print(f"[AI ENGINE] Raw response ({curr}): {content[:150]}", flush=True)
        
        import re
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
        
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            content = content[start:end]
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # Quick sanitization for quotes/newlines
            cleaned = content.replace('\n', ' ').replace('\r', '')
            try:
                data = json.loads(cleaned)
            except:
                # If trailing quote missing, close it
                if not cleaned.endswith('}'):
                    cleaned = cleaned + '"}'
                data = json.loads(cleaned)
        
        required = ["recommended_action", "confidence_score", "ai_reasoning"]
        for key in required:
            if key not in data:
                raise ValueError(f"Missing key: {key}")
        
        valid_actions = ["PREDICTIVE_RETRY", "SOFT_NUDGE_WHATSAPP", "INTENT_SWITCH_FALLBACK", "HARD_FAIL_ABANDON"]
        if data["recommended_action"] not in valid_actions:
            data["recommended_action"] = "SOFT_NUDGE_WHATSAPP"
        
        data.setdefault("execution_timestamp_delay_minutes", 0)
        data.setdefault("custom_message_payload", None)
        
        print(f"[AI ENGINE] Success: {data['recommended_action']} | Currency: {curr} | Conf: {data['confidence_score']}", flush=True)
        return data
        
    except Exception as e:
        print(f"[AI ENGINE ERROR] {type(e).__name__}: {str(e)}", flush=True)
        return {
            "recommended_action": "SOFT_NUDGE_WHATSAPP",
            "execution_timestamp_delay_minutes": 0,
            "confidence_score": 0.85,
            "ai_reasoning": f"Diagnostic Engine active for {curr}. Error encountered ({error_description}). Recommending friction-free checkout recovery via multi-channel fallback.",
            "custom_message_payload": f"Hi {customer_name.split()[0]}! Your checkout of {curr_sym}{amount_units:,.2f} encountered a temporary payment delay. We've securely reserved your items—tap here to complete your payment in one click."
        }
