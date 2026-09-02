import hmac
import hashlib
import json
import random
import uuid
import asyncio
from typing import Optional, List
from pydantic import BaseModel
from fastapi import FastAPI, Depends, Request, HTTPException, BackgroundTasks, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.config import settings
from app.database import engine, Base, get_db
from app.models import PaymentRecoveryEvent
from app.ai_engine import generate_recovery_decision
from app.guardrails import apply_safety_guardrails
from app.actions import generate_recovery_payment_link
from app.email_service import send_recovery_email

app = FastAPI(title="Foura AI Revenue Recovery Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket Connection Manager ───────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, event: str, data: dict = None):
        msg = json.dumps({"event": event, "data": data or {}})
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            try: self.active.remove(ws)
            except: pass

ws_manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# App In-Memory Settings Cache
SYSTEM_SETTINGS = {
    "auto_pilot": False,
    "rbi_max_retries": 3,
    "discount_ceiling_pct": 5,
    "default_channel": "multi_channel", # "multi_channel" | "whatsapp" | "email"
    "test_mode": True,
    "webhook_url": "http://localhost:8003/api/webhooks/razorpay"
}

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[STARTUP] Foura Multi-Currency AI Engine Initialized. (INR, USD, EUR active).", flush=True)

# ─── REALISTIC MULTI-CURRENCY FAILURE SCENARIO MATRIX ───────────────────────────

FAILURE_SCENARIOS = [
    # ── USD ($) Scenarios ──
    {
        "customer_name": "Alexander Hayes",
        "email": "alex.hayes@cloudscale.io",
        "category": "SaaS Cloud Infrastructure",
        "tier": "Enterprise VIP",
        "amount": 29900,  # $299.00
        "currency": "USD",
        "method": "card",
        "error_code": "ISSUER_HIGH_VALUE_VELOCITY_CHECK",
        "error_desc": "US issuing bank triggered high-velocity authorization check on corporate credit card",
        "bank_health": {"card": 0.62, "apple_pay": 0.99, "ach": 0.96},
        "concession": True
    },
    {
        "customer_name": "Sophia Bennett",
        "email": "sophia.b@fashionstudio.com",
        "category": "Luxury Designer Boutique",
        "tier": "Loyal Repeat Buyer",
        "amount": 14500,  # $145.00
        "currency": "USD",
        "method": "card",
        "error_code": "3DS_OTP_CHALLENGE_TIMEOUT",
        "error_desc": "Customer 3DS SMS authentication challenge timed out during international checkout",
        "bank_health": {"card": 0.89, "apple_pay": 0.98, "paypal": 0.97},
        "concession": True
    },
    {
        "customer_name": "Liam Davis",
        "email": "liam.davis@workspace.net",
        "category": "AI Developer Platform",
        "tier": "Pro Member",
        "amount": 4900,  # $49.00
        "currency": "USD",
        "method": "card",
        "error_code": "INSUFFICIENT_FUNDS_BALANCE_LOW",
        "error_desc": "Declined by processor due to insufficient available card credit limit",
        "bank_health": {"card": 0.96, "apple_pay": 0.99, "paypal": 0.95},
        "concession": False
    },
    
    # ── EUR (€) Scenarios ──
    {
        "customer_name": "Claire Dubois",
        "email": "claire.dubois@maisonmode.fr",
        "category": "Haute Couture & Accessories",
        "tier": "VIP High-LTV Buyer",
        "amount": 28000,  # €280.00
        "currency": "EUR",
        "method": "card",
        "error_code": "CHECKOUT_DISMISSED_PRICE_HESITATION",
        "error_desc": "User abandoned European checkout modal at 3DS2 biometric confirmation step",
        "bank_health": {"card": 0.94, "sepa": 0.99, "ideal": 0.98},
        "concession": True
    },
    {
        "customer_name": "Jan Van Der Beek",
        "email": "jan.beek@amsterdamtech.nl",
        "category": "Fintech Analytics API",
        "tier": "Enterprise Tier",
        "amount": 19900,  # €199.00
        "currency": "EUR",
        "method": "card",
        "error_code": "GATEWAY_TIMEOUT_PEAK_TRAFFIC",
        "error_desc": "European acquirer switch experienced packet loss during peak midday settlements",
        "bank_health": {"card": 0.51, "sepa": 0.98, "sofort": 0.96},
        "concession": True
    },
    {
        "customer_name": "Matteo Rossi",
        "email": "matteo.rossi@milano.it",
        "category": "Travel & Flight Booking",
        "tier": "High-Intent Checkout",
        "amount": 42000,  # €420.00
        "currency": "EUR",
        "method": "card",
        "error_code": "3DS2_FRICTIONLESS_REJECTED",
        "error_desc": "SCA strong customer authentication requirement failed on Italian debit card",
        "bank_health": {"card": 0.72, "sepa": 0.97, "apple_pay": 0.99},
        "concession": True
    },

    # ── INR (₹) Scenarios ──
    {
        "customer_name": "Rohan Sharma",
        "email": "rohan.sharma@gmail.com",
        "category": "Consumer Electronics",
        "tier": "VIP High-LTV Buyer",
        "amount": 2499900,  # ₹24,999
        "currency": "INR",
        "method": "card",
        "error_code": "3DS_OTP_CHALLENGE_TIMEOUT",
        "error_desc": "Customer bank OTP challenge window timed out during 3D Secure verification",
        "bank_health": {"card": 0.88, "upi": 0.98, "netbanking": 0.92},
        "concession": True
    },
    {
        "customer_name": "Priya Nair",
        "email": "priya.nair@gmail.com",
        "category": "Designer Footwear & Bags",
        "tier": "VIP High-LTV Buyer",
        "amount": 540000,  # ₹5,400
        "currency": "INR",
        "method": "card",
        "error_code": "CHECKOUT_DISMISSED_PRICE_HESITATION",
        "error_desc": "User paused at OTP screen and dismissed browser tab due to final price hesitation",
        "bank_health": {"card": 0.94, "upi": 0.98, "netbanking": 0.96},
        "concession": True
    },
    {
        "customer_name": "Vikram Malhotra",
        "email": "vikram.m@techcorp.in",
        "category": "High-End Luxury Apparel",
        "tier": "Loyal Repeat Customer",
        "amount": 875000,  # ₹8,750
        "currency": "INR",
        "method": "netbanking",
        "error_code": "BANK_NPCI_SWITCH_DEGRADED",
        "error_desc": "HDFC / SBI core banking switch experienced intermittent gateway packet loss",
        "bank_health": {"card": 0.92, "upi": 0.99, "netbanking": 0.42},
        "concession": True
    },
    {
        "customer_name": "Sneha Verma",
        "email": "sneha.v@gmail.com",
        "category": "Quick-Commerce & Lifestyle",
        "tier": "First-Time Buyer",
        "amount": 184900,  # ₹1,849
        "currency": "INR",
        "method": "upi",
        "error_code": "UPI_PSP_APP_NOT_RESPONDING",
        "error_desc": "Google Pay / PhonePe collect request expired before user entered UPI MPIN",
        "bank_health": {"card": 0.95, "upi": 0.72, "netbanking": 0.94},
        "concession": False
    }
]

# ─── WEBHOOK ────────────────────────────────────────────────────────────────────

@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Ingests live payment failure webhooks across INR, USD, and EUR."""
    body = await request.body()
    body_str = body.decode("utf-8")
    
    print(f"[WEBHOOK] Received {len(body_str)} bytes", flush=True)
    
    try:
        data = json.loads(body_str)
    except:
        print("[WEBHOOK] Invalid JSON", flush=True)
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event = data.get("event", "")
    print(f"[WEBHOOK] Event: {event}", flush=True)
    
    if event != "payment.failed":
        return {"status": "ignored", "event": event}
    
    payload = data.get("payload", {})
    payment = payload.get("payment", {}).get("entity", {})
    payment_link_entity = payload.get("payment_link", {}).get("entity", {})
    pl_customer = payment_link_entity.get("customer", {})
    notes = payment.get("notes", {}) or payment_link_entity.get("notes", {})
    
    payment_id = payment.get("id", f"pay_{uuid.uuid4().hex[:14]}")
    amount = payment.get("amount") or payment_link_entity.get("amount", 0)
    currency = (payment.get("currency") or payment_link_entity.get("currency") or "INR").upper()
    method = payment.get("method", "unknown")
    error_code = payment.get("error_code", "GATEWAY_ERROR")
    error_desc = payment.get("error_description", "Payment transaction interrupted")
    
    email = payment.get("email") or pl_customer.get("email") or notes.get("email") or "customer@example.com"
    name = pl_customer.get("name") or notes.get("name") or "Valued Customer"
    category = notes.get("category") or "Online Checkout"
    
    print(f"[WEBHOOK] Ingested: {payment_id} | {currency} {amount/100} | {method} | Customer: {name}", flush=True)
    
    bank_health = {"card": round(random.uniform(0.4, 0.98), 2), "upi": round(random.uniform(0.85, 0.99), 2), "netbanking": round(random.uniform(0.5, 0.95), 2)}
    time_of_month = random.randint(1, 31)
    retry_count = random.randint(0, 2)
    
    background_tasks.add_task(
        _process_recovery, payment_id, amount, currency, method,
        error_code, error_desc, email, name, category, "High-Intent Checkout", False,
        bank_health, time_of_month, retry_count, db
    )
    
    return {"status": "ok", "payment_id": payment_id, "currency": currency}

async def _process_recovery(
    payment_id, amount, currency, method, error_code, error_desc, 
    contact_email, customer_name, cart_category, customer_tier, concession,
    bank_health, time_of_month, retry_count, db
):
    """Deep AI Diagnostic -> Guardrail Enforcement -> Real-Time Multi-Currency Recovery Dispatch"""
    curr = currency.upper() if currency else "INR"
    print(f"[RECOVERY] Analyzing {payment_id} ({customer_name} | {curr} {amount/100} | {cart_category})...", flush=True)
    
    ai_decision = await generate_recovery_decision(
        payment_id=payment_id, amount=amount, currency=curr, method=method,
        error_code=error_code, error_description=error_desc,
        bank_health=bank_health, time_of_month=time_of_month, retry_count=retry_count,
        customer_name=customer_name, cart_category=cart_category, customer_tier=customer_tier,
        concession_applied=concession
    )
    
    final_decision, override = apply_safety_guardrails(ai_decision, retry_count)
    
    if override:
        print(f"[GUARDRAIL] Triggered: {override}", flush=True)

    payment_link = ""
    if final_decision["recommended_action"] != "HARD_FAIL_ABANDON":
        payment_link = generate_recovery_payment_link(
            amount=amount,
            currency=curr,
            customer_email=contact_email,
            customer_contact="+919876543210",
            description=f"Foura Recovery for order {payment_id}"
        )
        
        custom_msg = final_decision.get("custom_message_payload") or "Your payment was interrupted. Tap below to complete it safely."
        subject = f"Action needed for your {cart_category} order"
        await send_recovery_email(
            to_email=contact_email,
            subject=subject,
            body_text=custom_msg,
            amount_inr=amount / 100,
            payment_link=payment_link,
            ai_reasoning=final_decision.get("ai_reasoning", "Autonomous recovery intervention")
        )
    
    event = PaymentRecoveryEvent(
        id=payment_id, amount=amount, currency=curr, method=method,
        error_code=error_code, error_description=error_desc, customer_contact=contact_email,
        historical_retry_count=retry_count, bank_health_snapshot=bank_health,
        recommended_action=final_decision["recommended_action"],
        execution_delay_minutes=final_decision.get("execution_timestamp_delay_minutes", 0),
        confidence_score=float(final_decision.get("confidence_score", 0.9)),
        ai_reasoning=final_decision.get("ai_reasoning", ""),
        custom_message=final_decision.get("custom_message_payload"),
        guardrail_overridden=override,
        customer_name=customer_name,
        cart_category=cart_category,
        customer_tier=customer_tier,
        is_recovered=0
    )
    
    db.add(event)
    await db.commit()
    print(f"[RECOVERY] Reclaimed {payment_id} -> {final_decision['recommended_action']} ({curr})", flush=True)
    
    # Push real-time update to all connected clients
    await ws_manager.broadcast("new_case", {
        "id": payment_id,
        "customer_name": customer_name,
        "amount": amount / 100,
        "currency": curr,
        "error_code": error_code,
        "recommended_action": final_decision["recommended_action"],
        "ai_reasoning": final_decision.get("ai_reasoning", ""),
        "recovery_score": int(float(final_decision.get("confidence_score", 0.9)) * 100),
    })

# ─── SIMULATION & INJECTION API ─────────────────────────────────────────────────

class CustomFailurePayload(BaseModel):
    customer_name: Optional[str] = "Alexander Hayes"
    email: Optional[str] = "alex.hayes@cloudscale.io"
    category: Optional[str] = "SaaS Infrastructure"
    tier: Optional[str] = "Enterprise VIP"
    amount: Optional[int] = 29900
    currency: Optional[str] = "USD"
    error_code: Optional[str] = "3DS_OTP_CHALLENGE_TIMEOUT"
    error_desc: Optional[str] = "Customer 3DS verification window timed out"
    concession: Optional[bool] = True

@app.post("/api/simulate-failure")
async def simulate_failure(
    payload: Optional[CustomFailurePayload] = None,
    currency: Optional[str] = Query(None, description="Filter simulation currency: INR, USD, EUR"),
    background_tasks: BackgroundTasks = None, 
    db: AsyncSession = Depends(get_db)
):
    """Injects a realistic checkout failure scenario filtered or custom-crafted."""
    payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    time_of_month = random.randint(1, 31)
    retry_count = random.choice([0, 0, 1, 1, 2])
    
    if payload:
        cust_name = payload.customer_name or "Alexander Hayes"
        cust_email = payload.email or "customer@example.com"
        category = payload.category or "Digital Store"
        tier = payload.tier or "Enterprise VIP"
        curr = (payload.currency or "USD").upper()
        amount = payload.amount or 29900
        error_code = payload.error_code or "3DS_OTP_CHALLENGE_TIMEOUT"
        error_desc = payload.error_desc or "Payment authorization session timed out"
        concession = payload.concession if payload.concession is not None else True
        method = "card" if curr in ["USD", "EUR"] else "upi"
        bank_health = {"card": 0.88, "upi": 0.98, "sepa": 0.96}
    else:
        pool = FAILURE_SCENARIOS
        if currency:
            filtered = [s for s in FAILURE_SCENARIOS if s.get("currency", "INR").upper() == currency.upper()]
            if filtered:
                pool = filtered
                
        scenario = random.choice(pool)
        cust_name = scenario['customer_name']
        cust_email = scenario['email']
        category = scenario['category']
        tier = scenario['tier']
        curr = scenario.get("currency", "INR").upper()
        amount = scenario['amount']
        error_code = scenario['error_code']
        error_desc = scenario['error_desc']
        concession = scenario['concession']
        method = scenario['method']
        bank_health = scenario['bank_health']
    
    print(f"[SIMULATE] Injected {payment_id} | {cust_name} | {curr} {amount/100} | {error_code}", flush=True)
    
    background_tasks.add_task(
        _process_recovery, 
        payment_id, 
        amount, 
        curr, 
        method,
        error_code, 
        error_desc, 
        cust_email, 
        cust_name, 
        category, 
        tier, 
        concession,
        bank_health, 
        time_of_month, 
        retry_count, 
        db
    )
    
    return {
        "status": "simulated", 
        "id": payment_id, 
        "currency": curr,
        "customer": cust_name, 
        "category": category,
        "amount": amount / 100
    }

# ─── CONSOLIDATED DASHBOARD STATE API (1-CALL EFFICIENCY) ───────────────────────

EXCHANGE_RATES_TO_INR = {
    "INR": 1.0,
    "USD": 87.5,
    "EUR": 95.0
}

@app.get("/api/dashboard-state")
async def get_dashboard_state(
    display_currency: Optional[str] = Query("USD"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Consolidated single-call endpoint for metrics, recoveries, and engine settings."""
    result = await db.execute(select(PaymentRecoveryEvent).order_by(PaymentRecoveryEvent.created_at.desc()))
    all_f = result.scalars().all()
    total = len(all_f)
    
    target_curr = (display_currency or "USD").upper()
    rate_to_inr = EXCHANGE_RATES_TO_INR.get(target_curr, 87.5)
    
    risk_in_target = 0.0
    recovered_in_target = 0.0
    recoveries_list = []
    
    for f in all_f:
        item_curr = (f.currency or "INR").upper()
        item_amount = f.amount / 100
        amount_in_inr = item_amount * EXCHANGE_RATES_TO_INR.get(item_curr, 1.0)
        amount_in_target = amount_in_inr / rate_to_inr
        
        if f.is_recovered:
            recovered_in_target += amount_in_target
        else:
            risk_in_target += amount_in_target

        c_name = getattr(f, 'customer_name', None) or "Customer"
        c_category = getattr(f, 'cart_category', None) or "Digital Checkout"

        if search:
            s = search.lower()
            if s not in f.id.lower() and s not in c_name.lower() and s not in c_category.lower() and s not in f.error_code.lower():
                continue

        recoveries_list.append({
            "id": f.id,
            "amount": f.amount / 100,
            "currency": item_curr,
            "method": f.method,
            "failure_reason": f.error_description,
            "error_code": f.error_code,
            "customer_email": f.customer_contact,
            "customer_name": c_name,
            "cart_category": c_category,
            "customer_tier": getattr(f, 'customer_tier', None) or "Standard Buyer",
            "customer_ltv": 28000,
            "recovery_score": int(f.confidence_score * 100) if f.confidence_score else 88,
            "recommended_action": f.recommended_action,
            "ai_reasoning": f.ai_reasoning,
            "personalized_message": f.custom_message,
            "guardrail_overridden": f.guardrail_overridden,
            "is_recovered": bool(f.is_recovered)
        })

    rate = (sum(1 for f in all_f if f.is_recovered) / total * 100) if total > 0 else 0

    return {
        "metrics": {
            "total_failed": total,
            "revenue_at_risk": risk_in_target,
            "revenue_recovered": recovered_in_target,
            "recovery_rate": round(rate, 1),
            "display_currency": target_curr
        },
        "recoveries": recoveries_list,
        "settings": SYSTEM_SETTINGS
    }


@app.get("/api/metrics")
async def get_metrics(
    display_currency: Optional[str] = Query("USD", description="Requested display currency: INR, USD, EUR"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PaymentRecoveryEvent))
    all_f = result.scalars().all()
    total = len(all_f)
    
    target_curr = display_currency.upper() if display_currency else "USD"
    rate_to_inr = EXCHANGE_RATES_TO_INR.get(target_curr, 87.5)
    
    risk_in_target = 0.0
    recovered_in_target = 0.0
    
    for f in all_f:
        item_curr = (f.currency or "INR").upper()
        item_amount = f.amount / 100
        amount_in_inr = item_amount * EXCHANGE_RATES_TO_INR.get(item_curr, 1.0)
        amount_in_target = amount_in_inr / rate_to_inr
        
        if f.is_recovered:
            recovered_in_target += amount_in_target
        else:
            risk_in_target += amount_in_target
            
    rate = (sum(1 for f in all_f if f.is_recovered) / total * 100) if total > 0 else 0
    
    return {
        "total_failed": total, 
        "revenue_at_risk": risk_in_target, 
        "revenue_recovered": recovered_in_target, 
        "recovery_rate": round(rate, 1),
        "display_currency": target_curr
    }

@app.get("/api/recoveries")
async def get_recoveries(
    status: Optional[str] = Query(None, description="Filter by status: pending, recovered, all"),
    search: Optional[str] = Query(None, description="Search term"),
    currency: Optional[str] = Query(None, description="Filter currency"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PaymentRecoveryEvent).order_by(PaymentRecoveryEvent.created_at.desc()))
    failures = result.scalars().all()
    out = []
    for f in failures:
        curr = (f.currency or "INR").upper()
        if currency and curr != currency.upper():
            continue
        if status == "pending" and f.is_recovered:
            continue
        if status == "recovered" and not f.is_recovered:
            continue
            
        c_name = getattr(f, 'customer_name', None) or "Customer"
        c_category = getattr(f, 'cart_category', None) or "Online Store Checkout"
        
        if search:
            s = search.lower()
            if s not in f.id.lower() and s not in c_name.lower() and s not in c_category.lower() and s not in f.error_code.lower():
                continue
                
        out.append({
            "id": f.id, 
            "amount": f.amount / 100, 
            "currency": curr,
            "method": f.method,
            "failure_reason": f.error_description, 
            "error_code": f.error_code,
            "customer_email": f.customer_contact,
            "customer_name": c_name,
            "cart_category": c_category,
            "customer_tier": getattr(f, 'customer_tier', None) or "Standard Buyer",
            "customer_ltv": 28000, 
            "recovery_score": int(f.confidence_score * 100) if f.confidence_score else 88,
            "recommended_action": f.recommended_action, 
            "ai_reasoning": f.ai_reasoning,
            "personalized_message": f.custom_message, 
            "guardrail_overridden": f.guardrail_overridden,
            "is_recovered": bool(f.is_recovered)
        })
    return out

@app.post("/api/recoveries/{payment_id}/trigger-action")
async def trigger_action(payment_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PaymentRecoveryEvent).where(PaymentRecoveryEvent.id == payment_id))
    failure = result.scalar_one_or_none()
    if not failure:
        raise HTTPException(status_code=404)
    failure.is_recovered = 1
    await db.commit()
    await ws_manager.broadcast("recovered", {"id": payment_id})
    return {"status": "success", "id": payment_id}

@app.post("/api/recoveries/batch-trigger")
async def batch_trigger_action(db: AsyncSession = Depends(get_db)):
    """Recovers all pending cases in one click."""
    result = await db.execute(select(PaymentRecoveryEvent).where(PaymentRecoveryEvent.is_recovered == 0))
    pending = result.scalars().all()
    count = 0
    for f in pending:
        f.is_recovered = 1
        count += 1
    await db.commit()
    await ws_manager.broadcast("batch_recovered", {"count": count})
    return {"status": "success", "recovered_count": count}

# ─── SETTINGS API ───────────────────────────────────────────────────────────────

class SettingsPayload(BaseModel):
    auto_pilot: Optional[bool] = None
    rbi_max_retries: Optional[int] = None
    discount_ceiling_pct: Optional[int] = None
    default_channel: Optional[str] = None
    test_mode: Optional[bool] = None

@app.get("/api/settings")
async def get_settings():
    return SYSTEM_SETTINGS

@app.post("/api/settings")
async def update_settings(payload: SettingsPayload):
    if payload.auto_pilot is not None:
        SYSTEM_SETTINGS["auto_pilot"] = payload.auto_pilot
    if payload.rbi_max_retries is not None:
        SYSTEM_SETTINGS["rbi_max_retries"] = payload.rbi_max_retries
    if payload.discount_ceiling_pct is not None:
        SYSTEM_SETTINGS["discount_ceiling_pct"] = payload.discount_ceiling_pct
    if payload.default_channel is not None:
        SYSTEM_SETTINGS["default_channel"] = payload.default_channel
    if payload.test_mode is not None:
        SYSTEM_SETTINGS["test_mode"] = payload.test_mode
    return {"status": "updated", "settings": SYSTEM_SETTINGS}

# ─── INSTANT SETTLEMENT API ─────────────────────────────────────────────────────

@app.post("/api/settlements/instant")
async def instant_settlement(amount: float = 5000, currency: str = "USD"):
    return {
        "status": "initiated",
        "settlement_id": f"setl_{uuid.uuid4().hex[:12]}",
        "amount": amount,
        "currency": currency,
        "payout_eta": "Instant (under 2 minutes)",
        "destination": "Registered Bank Account (**4892)"
    }
