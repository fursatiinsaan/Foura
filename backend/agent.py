import random
import time

def run_autonomous_agent(payment_amount, customer_ltv, failure_reason):
    """
    Simulates a dynamic autonomous AI agent negotiating and recovering revenue.
    Generates varied conversation trees so no two recoveries look exactly the same.
    """
    logs = []
    
    logs.append({"type": "system", "text": f"Agent awakened: Detected failed payment of ₹{payment_amount}"})
    logs.append({"type": "think", "text": f"Context Analysis: LTV=₹{customer_ltv}, Reason='{failure_reason}'"})
    
    # 1. Randomized Customer Profiles & Moods
    is_high_value = customer_ltv > 5000
    customer_mood = random.choice(["confused", "frustrated", "silent", "bargaining"])
    
    # 2. Dynamic Opening Strategy
    if is_high_value:
        logs.append({"type": "think", "text": "High LTV detected. Prioritizing white-glove retention strategy. Zero discount initially."})
        openers = [
            f"Hi! We noticed your ₹{int(payment_amount)} payment got interrupted. Your items are safe! Want to complete the checkout?",
            f"Hey there, your recent transaction of ₹{int(payment_amount)} didn't go through. We're here to help if you faced any issues!",
            f"Hello! It looks like there was a glitch with your payment of ₹{int(payment_amount)}. Need a quick alternate link?"
        ]
        logs.append({"type": "action", "text": "Dispatching personalized WhatsApp nudge."})
        logs.append({"type": "message_out", "text": random.choice(openers)})
    else:
        logs.append({"type": "think", "text": "Standard LTV. High cart abandonment risk. Authorizing immediate incentive if needed."})
        logs.append({"type": "action", "text": "Dispatching SMS with urgency trigger."})
        logs.append({"type": "message_out", "text": f"Oops, your payment of ₹{int(payment_amount)} failed! Complete your order in the next 10 mins to secure your items: rzpy.io/retry"})

    # 3. Dynamic Customer Responses & Agent Pivots
    if customer_mood == "silent":
        logs.append({"type": "system", "text": "Waiting for customer response... (No reply after 5 mins)"})
        logs.append({"type": "think", "text": "Customer is unresponsive. Escalating to Voice Bot / Follow-up SMS."})
        logs.append({"type": "action", "text": "Triggering automated follow-up sequence with incentive."})
        logs.append({"type": "message_out", "text": "Still having trouble? Use code SAVE5 for 5% off if you complete your payment now: rzpy.io/save5"})
        logs.append({"type": "message_in", "text": "Done, thanks."})
        
    elif customer_mood == "frustrated":
        logs.append({"type": "message_in", "text": random.choice([
            "My card was charged but it says failed!",
            "Your payment page keeps crashing.",
            "I tried 3 times, it's not working!"
        ])})
        logs.append({"type": "think", "text": "High friction detected. Bypassing standard payment methods. Generating fallback UPI/Link."})
        logs.append({"type": "message_out", "text": "Apologies for the hassle! Any deducted amount will be refunded in 24 hrs. Please use this direct UPI link which skips the gateway page: rzpy.io/direct-upi"})
        logs.append({"type": "message_in", "text": "Okay, paying via UPI now."})
        
    elif customer_mood == "bargaining":
        logs.append({"type": "message_in", "text": "Payment failed. Can I get a discount?"})
        if is_high_value:
            logs.append({"type": "think", "text": "Customer requesting discount. LTV permits small margin sacrifice to close sale."})
            logs.append({"type": "message_out", "text": "Since you've been a great customer, here is a special 10% OFF link: rzpy.io/vip10"})
        else:
            logs.append({"type": "think", "text": "Customer requesting discount. LTV does not support high discount. Offering minimal incentive."})
            logs.append({"type": "message_out", "text": "We can't offer a discount right now, but we can offer free shipping! Use link: rzpy.io/freeship"})
        logs.append({"type": "message_in", "text": "Works for me."})
        
    else: # confused
        logs.append({"type": "message_in", "text": f"Why did it fail? It says {failure_reason}."})
        logs.append({"type": "think", "text": "Customer confused by error code. Providing simplified explanation and alternative."})
        logs.append({"type": "message_out", "text": f"It looks like a temporary issue with your bank/network. Don't worry, you can easily pay via a different method here: rzpy.io/alt-pay"})

    # 4. Resolution
    logs.append({"type": "system", "text": "Monitoring webhook for payment.captured..."})
    logs.append({"type": "success", "text": f"Webhook received: order.paid. Revenue of ₹{int(payment_amount)} successfully recovered!"})
    
    return logs
