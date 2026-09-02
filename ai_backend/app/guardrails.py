def apply_safety_guardrails(ai_decision: dict, retry_count: int) -> tuple[dict, str | None]:
    """
    Deterministic safety guardrails that sit AFTER AI generation.
    Returns (final_decision, override_reason).
    """
    override_reason = None

    # 1. Total Cap Limit (RBI Compliance)
    if retry_count >= 3:
        override_reason = "RETRY_CAP_EXCEEDED"
        ai_decision["recommended_action"] = "HARD_FAIL_ABANDON"
        ai_decision["ai_reasoning"] = f"GUARDRAIL: Max retry limit hit ({retry_count}). Abandoning to stay RBI compliant."
        ai_decision["custom_message_payload"] = None
        return ai_decision, override_reason

    # 2. Minimum Confidence Floor
    score = ai_decision.get("confidence_score", 0)
    if isinstance(score, str):
        try:
            score = float(score)
        except:
            score = 0.0
    
    if score < 0.75:
        override_reason = "LOW_CONFIDENCE"
        ai_decision["recommended_action"] = "SOFT_NUDGE_WHATSAPP"
        ai_decision["execution_timestamp_delay_minutes"] = 1440
        ai_decision["ai_reasoning"] = f"GUARDRAIL: Confidence ({score}) below 0.75. Defaulting to T+1 nudge."
        ai_decision["custom_message_payload"] = "Arey! Your payment didn't go through. No worries, your cart is safely saved. Tap here to retry when you're ready!"
        return ai_decision, override_reason

    return ai_decision, override_reason
