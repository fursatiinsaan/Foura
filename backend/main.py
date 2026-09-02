from flask import Flask, request, jsonify
from flask_cors import CORS
import hmac
import hashlib
import json
import datetime
import random
import uuid

from database import engine, Base, SessionLocal
import models
from engine import analyze_recovery_potential
from agent import run_autonomous_agent

# Create tables
models.Base.metadata.create_all(bind=engine)

app = Flask(__name__)
CORS(app) # Allow frontend to access

RAZORPAY_WEBHOOK_SECRET = "my_super_secret_webhook_key"

def verify_razorpay_signature(request_body: bytes, signature: str) -> bool:
    expected_signature = hmac.new(
        key=RAZORPAY_WEBHOOK_SECRET.encode(),
        msg=request_body,
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature)

@app.route("/api/webhooks/razorpay", methods=["POST"])
def razorpay_webhook():
    db = SessionLocal()
    body = request.get_data()
    signature = request.headers.get('x-razorpay-signature', '')
    
    if signature and not verify_razorpay_signature(body, signature):
        db.close()
        return jsonify({"error": "Invalid signature"}), 400

    try:
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError:
        db.close()
        return jsonify({"error": "Invalid JSON"}), 400

    event_type = payload.get('event')
    
    if event_type == 'payment.failed':
        payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        payment_id = payment_entity.get('id')
        
        existing = db.query(models.PaymentFailure).filter(models.PaymentFailure.id == payment_id).first()
        if not existing:
            mock_ltv = random.choice([2000, 45000, 15000, 800])
            mock_success = random.choice([0, 1, 10, 5])
            mock_fail = random.choice([0, 1, 3])
            
            analysis = analyze_recovery_potential(
                payment_amount=payment_entity.get('amount', 0) / 100.0,
                customer_ltv=mock_ltv,
                customer_successful=mock_success,
                customer_failed=mock_fail,
                failure_reason=payment_entity.get('error_description', 'Unknown error')
            )
            
            new_failure = models.PaymentFailure(
                id=payment_id,
                amount=payment_entity.get('amount', 0) / 100.0,
                currency=payment_entity.get('currency', 'INR'),
                status='failed',
                failure_reason=payment_entity.get('error_description', 'Unknown error'),
                customer_id=payment_entity.get('customer_id', 'cust_mock123'),
                customer_email=payment_entity.get('email', 'customer@example.com'),
                customer_contact=payment_entity.get('contact', '+919876543210'),
                customer_ltv=mock_ltv,
                customer_successful_payments=mock_success,
                customer_failed_payments=mock_fail,
                recovery_score=analysis['score'],
                recovery_probability=analysis['probability'],
                recommended_action=analysis['action'],
                discount_required=analysis['discount_required'],
                ai_reasoning=analysis['reasoning'],
                personalized_message=analysis['personalized_message']
            )
            db.add(new_failure)
            db.commit()

    elif event_type in ['order.paid', 'payment.captured']:
        payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        cust_email = payment_entity.get('email')
        if cust_email:
            failure = db.query(models.PaymentFailure).filter(
                models.PaymentFailure.customer_email == cust_email,
                models.PaymentFailure.is_recovered == False
            ).order_by(models.PaymentFailure.created_at.desc()).first()
            
            if failure:
                failure.is_recovered = True
                failure.recovered_at = datetime.datetime.utcnow()
                db.commit()
    db.close()
    return jsonify({"status": "ok"})

@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    db = SessionLocal()
    all_failures = db.query(models.PaymentFailure).all()
    
    total_failed = len(all_failures)
    revenue_at_risk = sum(f.amount for f in all_failures if not f.is_recovered)
    revenue_recovered = sum(f.amount for f in all_failures if f.is_recovered)
    
    recovery_rate = (sum(1 for f in all_failures if f.is_recovered) / total_failed * 100) if total_failed > 0 else 0
    
    db.close()
    return jsonify({
        "total_failed": total_failed,
        "revenue_at_risk": revenue_at_risk,
        "revenue_recovered": revenue_recovered,
        "recovery_rate": round(recovery_rate, 1)
    })

@app.route("/api/recoveries", methods=["GET"])
def get_recoveries():
    db = SessionLocal()
    failures = db.query(models.PaymentFailure).order_by(models.PaymentFailure.created_at.desc()).all()
    
    results = []
    for f in failures:
        results.append({
            "id": f.id,
            "amount": f.amount,
            "currency": f.currency,
            "failure_reason": f.failure_reason,
            "customer_email": f.customer_email,
            "customer_ltv": f.customer_ltv,
            "customer_successful_payments": f.customer_successful_payments,
            "customer_failed_payments": f.customer_failed_payments,
            "recovery_score": f.recovery_score,
            "recovery_probability": f.recovery_probability,
            "recommended_action": f.recommended_action,
            "discount_required": f.discount_required,
            "ai_reasoning": f.ai_reasoning,
            "personalized_message": getattr(f, 'personalized_message', None),
            "agent_logs": json.loads(f.agent_logs) if getattr(f, 'agent_logs', None) else [],
            "is_recovered": f.is_recovered
        })
    db.close()
    return jsonify(results)

@app.route("/api/simulate-failure", methods=["POST"])
def simulate_failure():
    db = SessionLocal()
    mock_id = f"pay_{uuid.uuid4().hex[:14]}"
    mock_amount = random.choice([49900, 199900, 499900])
    reasons = ["UPI timeout", "Insufficient funds", "Card network declined"]
    
    payment_entity = {
        "id": mock_id,
        "amount": mock_amount,
        "currency": "INR",
        "error_description": random.choice(reasons),
        "email": f"user_{random.randint(100,999)}@example.com",
        "contact": "+919876543210"
    }
    
    mock_ltv = random.choice([2000, 45000, 15000, 800])
    mock_success = random.choice([0, 1, 10, 5])
    mock_fail = random.choice([0, 1, 3])
    
    analysis = analyze_recovery_potential(
        payment_amount=payment_entity['amount'] / 100.0,
        customer_ltv=mock_ltv,
        customer_successful=mock_success,
        customer_failed=mock_fail,
        failure_reason=payment_entity['error_description']
    )
    
    new_failure = models.PaymentFailure(
        id=payment_entity['id'],
        amount=payment_entity['amount'] / 100.0,
        currency=payment_entity['currency'],
        status='failed',
        failure_reason=payment_entity['error_description'],
        customer_email=payment_entity['email'],
        customer_ltv=mock_ltv,
        customer_successful_payments=mock_success,
        customer_failed_payments=mock_fail,
        recovery_score=analysis['score'],
        recovery_probability=analysis['probability'],
        recommended_action=analysis['action'],
        discount_required=analysis['discount_required'],
        ai_reasoning=analysis['reasoning'],
        personalized_message=analysis['personalized_message'],
        agent_logs=json.dumps(run_autonomous_agent(payment_entity['amount']/100.0, mock_ltv, payment_entity['error_description']))
    )
    db.add(new_failure)
    db.commit()
    db.close()
    return jsonify({"status": "simulated", "id": mock_id})

@app.route("/api/recoveries/<payment_id>/trigger-action", methods=["POST"])
def trigger_action(payment_id):
    db = SessionLocal()
    failure = db.query(models.PaymentFailure).filter(models.PaymentFailure.id == payment_id).first()
    if not failure:
        db.close()
        return jsonify({"error": "Not found"}), 404
    
    if failure.is_recovered:
        db.close()
        return jsonify({"status": "already_recovered"})
        
    failure.is_recovered = True
    failure.recovered_at = datetime.datetime.utcnow()
    db.commit()
    db.close()
    
    return jsonify({"status": "success", "message": f"Action triggered and payment recovered for {payment_id}"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
