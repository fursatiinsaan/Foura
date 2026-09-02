import random

def analyze_recovery_potential(payment_amount, customer_ltv, customer_successful, customer_failed, failure_reason):
    """
    Advanced Hybrid Recovery Engine: Deterministic logic + contextual LLM prompt structure.
    """
    
    base_score = 50.0
    
    if customer_ltv > 10000: base_score += 20
    elif customer_ltv > 5000: base_score += 10
        
    total_payments = customer_successful + customer_failed
    if total_payments > 0:
        success_ratio = customer_successful / total_payments
        base_score += (success_ratio * 20)
    
    failure_reason_lower = str(failure_reason).lower()
    if "timeout" in failure_reason_lower or "network" in failure_reason_lower:
        base_score += 10 
    elif "insufficient" in failure_reason_lower:
        base_score -= 10 
        
    if payment_amount < 2000:
        base_score += 5 
        
    score = min(max(base_score, 0), 100)
    
    # Advanced Compliance & Stopping Rules
    if customer_failed > 3:
        # Stop rule applied
        probability = "LOW"
        action = "Halt automated recovery. Flag for manual support review."
        discount = False
        message = "Hi, we noticed you've been having trouble completing your payments recently. Our support team will reach out shortly to help you resolve this."
        reasoning = "STOPPING RULE TRIGGERED: Customer has exceeded maximum retry thresholds (Failed > 3). Automated outreach suspended to maintain compliance and avoid spam."
    elif score >= 80:
        probability = "HIGH"
        action = "Send personalized WhatsApp Payment Link (Immediate Retry)"
        discount = False
        message = f"Hey! Your recent payment of ₹{int(payment_amount)} got stuck due to a network timeout. Don't worry, your order is reserved! Complete it securely here: rzpy.io/retry"
        reasoning = f"Customer has high LTV (₹{customer_ltv}) and strong success history. Failure '{failure_reason}' is likely a transient gateway issue. Immediate soft-nudge recommended via WhatsApp."
    elif score >= 50:
        probability = "MEDIUM"
        action = "Send alternate payment method via Email + SMS"
        discount = False
        message = f"Hi, your card payment of ₹{int(payment_amount)} couldn't be processed. Want to try UPI instead? It's faster and has zero extra fees. Tap here: rzpy.io/upi"
        reasoning = f"Moderate risk profile. The '{failure_reason}' suggests a hard block on the current payment method. Switching the payment context (e.g., Card to UPI) has the highest conversion probability."
    else:
        probability = "LOW"
        action = "Trigger dynamic discount recovery (10% Off)"
        discount = True
        message = f"Arey! Looks like your payment of ₹{int(payment_amount)} failed. We really value you, so here is a special 10% OFF code (RECOVER10) to complete your purchase today: rzpy.io/discount"
        reasoning = f"Low recovery probability due to structural failure or low LTV. Triggering dynamic discount incentive to salvage revenue before complete cart abandonment."
        
    return {
        "score": round(score, 1),
        "probability": probability,
        "action": action,
        "discount_required": discount,
        "reasoning": reasoning,
        "personalized_message": message
    }
