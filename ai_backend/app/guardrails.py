# Bounded AI Sandwich Safety Guardrails
# Ensures 100% deterministic compliance before any money rail action is executed.

def apply_safety_guardrails(ai_decision: dict, retry_count: int) -> tuple[dict, str | None]:
    if retry_count >= 3:
        return {
            "recommended_action": "HARD_FAIL_ABANDON",
            "execution_timestamp_delay_minutes": 0,
            "confidence_score": 1.0,
            "ai_reasoning": "RBI & Network stopping rule enforced: Maximum 3 attempts exceeded.",
            "custom_message_payload": "We noticed repeated issues with your transaction. To protect your card, retries have been paused."
        }, "RBI_3_RETRY_LIMIT_BREACH"

    discount = ai_decision.get("discount_pct", 0)
    if discount > 5:
        ai_decision["discount_pct"] = 5
        ai_decision["guardrail_note"] = "Discount capped at 5% merchant margin ceiling."

    return ai_decision, None
