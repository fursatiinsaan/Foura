# Bounded AI Sandwich Safety Guardrails
# Ensures 100% deterministic compliance before any money rail action is executed.

HARD_DECLINE_ERROR_CODES = {
    "BAD_REQUEST_PAYMENT_PIN_INCORRECT",
    "UPI_INCORRECT_MPIN",
    "INCORRECT_PIN",
    "PIN_INCORRECT",
    "BAD_REQUEST_PAYMENT_CARD_EXPIRED",
    "CARD_EXPIRED",
    "FRAUD_SUSPICIOUS_DEVICE",
    "STOLEN_CARD_PICKUP",
    "TRANSACTION_NOT_PERMITTED"
}

def apply_safety_guardrails(ai_decision: dict, retry_count: int, error_code: str = "") -> tuple[dict, str | None]:
    """
    Deterministic safety circuit that intercepts and overrides LLM proposals
    if they violate regulatory compliance, security policies, or hard decline rules.
    """
    err = (error_code or "").upper().strip()

    # Rule 1: Hard Authentication / Fraud Declines (e.g. Incorrect UPI PIN, Expired Card)
    # The LLM may want to re-engage, but deterministic policy MUST block auto-retries to prevent harassment & security lockouts.
    if any(code in err for code in HARD_DECLINE_ERROR_CODES):
        return {
            "recommended_action": "HARD_FAIL_ABANDON",
            "execution_timestamp_delay_minutes": 0,
            "confidence_score": 1.0,
            "ai_reasoning": f"Deterministic Safety Gate Intercepted: '{err}' is a permanent user authentication/credential failure. Automated retry & link creation blocked to prevent user spamming.",
            "custom_message_payload": "Your bank declined the transaction due to an incorrect security credential. Please verify your PIN with your issuing bank before re-attempting."
        }, "HARD_DECLINE_SECURITY_BLOCKED"

    # Rule 2: RBI & Global Network Max-Retry Stopping Rule
    if retry_count >= 3:
        return {
            "recommended_action": "HARD_FAIL_ABANDON",
            "execution_timestamp_delay_minutes": 0,
            "confidence_score": 1.0,
            "ai_reasoning": "RBI & Network stopping rule enforced: Maximum 3 attempts exceeded. Halting automated loop.",
            "custom_message_payload": "We noticed repeated issues with your transaction. To protect your card from issuer velocity blocks, automated retries have been paused."
        }, "RBI_3_RETRY_LIMIT_BREACH"

    # Rule 3: Merchant Margin Floor Protection (Cap concessions to max 5%)
    discount = ai_decision.get("discount_pct", 0)
    if discount > 5:
        ai_decision["discount_pct"] = 5
        ai_decision["guardrail_note"] = "Discount capped at 5% merchant gross margin ceiling."

    return ai_decision, None
