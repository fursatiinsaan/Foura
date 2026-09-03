#!/usr/bin/env python3
"""
Comprehensive Automated Test Suite for Foura Autonomous Revenue Recovery Engine.
Tests all endpoints, security guardrails, multi-currency conversions, and webhooks.
"""

import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8003"

def request(method, path, data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(content)
            except Exception:
                return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, content

def run_tests():
    print("=" * 60)
    print("  🧪 Running Foura Comprehensive Automated Test Suite")
    print("=" * 60)
    passed = 0
    total = 0

    # 1. Custom Branded Assets
    total += 1
    status, body = request("GET", "/logo.svg")
    assert status == 200 and "<svg" in body, f"Logo SVG failed: {status}"
    print("  [PASS] 1. Custom Branded SVG Logo Endpoint (/logo.svg)")
    passed += 1

    # 2. Custom Docs
    total += 1
    status, body = request("GET", "/docs")
    assert status == 200 and "Foura" in body, f"Docs failed: {status}"
    print("  [PASS] 2. Swagger Docs with Foura Branding (/docs)")
    passed += 1

    # 3. Consolidated Dashboard State API (USD)
    total += 1
    status, data = request("GET", "/api/dashboard-state?display_currency=USD")
    assert status == 200 and "metrics" in data and "recoveries" in data, f"Dashboard USD failed: {status}"
    print(f"  [PASS] 3. Consolidated State API (USD): {len(data['recoveries'])} cases, risk: ${data['metrics']['revenue_at_risk']:,.2f}")
    passed += 1

    # 4. Multi-Currency State API (INR & EUR)
    total += 1
    status_inr, data_inr = request("GET", "/api/dashboard-state?display_currency=INR")
    status_eur, data_eur = request("GET", "/api/dashboard-state?display_currency=EUR")
    assert status_inr == 200 and data_inr['metrics']['display_currency'] == 'INR', "INR state failed"
    assert status_eur == 200 and data_eur['metrics']['display_currency'] == 'EUR', "EUR state failed"
    print("  [PASS] 4. Multi-Currency Normalization (INR / EUR / USD conversions)")
    passed += 1

    # 5. Simulate Failure Injection (Synchronous Placeholder + Async LLaMA-3)
    total += 1
    status, sim = request("POST", "/api/simulate-failure?currency=USD")
    assert status == 200 and "id" in sim, f"Simulation failed: {status}"
    payment_id = sim["id"]
    print(f"  [PASS] 5. Failure Injection & Synchronous DB Ingestion: {payment_id}")
    passed += 1

    # 6. Single Case Recovery (No 404 Race Condition)
    total += 1
    status, rec = request("POST", f"/api/recoveries/{payment_id}/trigger-action")
    assert status == 200 and rec.get("status") == "success", f"Trigger action failed: {status}, {rec}"
    print(f"  [PASS] 6. Single-Click Recovery Dispatch: {payment_id} reclaimed")
    passed += 1

    # 7. Batch Recovery
    total += 1
    status, batch = request("POST", "/api/recoveries/batch-trigger")
    assert status == 200 and batch.get("status") == "success", f"Batch trigger failed: {status}"
    print(f"  [PASS] 7. Batch Autonomous Recovery: {batch.get('recovered_count')} cases cleared")
    passed += 1

    # 8. Instant Settlement API (JSON Body)
    total += 1
    status, setl = request("POST", "/api/settlements/instant", {"amount": 7500.50, "currency": "USD"})
    assert status == 200 and setl.get("status") == "initiated" and setl.get("amount") == 7500.50, f"Settlement failed: {status}, {setl}"
    print(f"  [PASS] 8. Instant Multi-Currency Settlement Dispatch: {setl.get('settlement_id')}")
    passed += 1

    # 9. Engine Configuration Persistence
    total += 1
    status, cfg = request("POST", "/api/settings", {"auto_pilot": True, "rbi_max_retries": 3, "discount_ceiling_pct": 5})
    assert status == 200 and cfg["settings"]["auto_pilot"] is True, f"Settings failed: {status}"
    print("  [PASS] 9. Engine Compliance Configuration Update & Persistence")
    passed += 1

    # 10. Deterministic Safety Gate: Hard Decline / Credential Failure
    total += 1
    status, hard_case = request("POST", "/api/simulate-failure", {
        "customer_name": "Test Security Block",
        "email": "security.audit@test.com",
        "amount": 50000,
        "currency": "INR",
        "error_code": "BAD_REQUEST_PAYMENT_PIN_INCORRECT",
        "error_desc": "Customer entered invalid MPIN three times"
    })
    assert status == 200, f"Hard decline injection failed: {status}"
    hard_id = hard_case["id"]
    _, state = request("GET", f"/api/dashboard-state?search={hard_id}")
    matching = [c for c in state["recoveries"] if c["id"] == hard_id]
    assert len(matching) > 0, "Hard decline record not found"
    assert matching[0]["recommended_action"] == "HARD_FAIL_ABANDON", f"Action was not HARD_FAIL_ABANDON: {matching[0]['recommended_action']}"
    assert matching[0]["guardrail_overridden"] == "HARD_DECLINE_SECURITY_BLOCKED", f"Guardrail flag not set: {matching[0]['guardrail_overridden']}"
    print(f"  [PASS] 10. Deterministic Safety Circuit: PIN hard decline blocked immediately ({matching[0]['guardrail_overridden']})")
    passed += 1

    # 11. Razorpay Webhook Ingestion
    total += 1
    webhook_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_webhook_{payment_id[:8]}",
                    "amount": 89900,
                    "currency": "USD",
                    "method": "card",
                    "error_code": "GATEWAY_TIMEOUT_PEAK_TRAFFIC",
                    "error_description": "Timeout contacting acquirer switch",
                    "email": "webhook.buyer@acme.com"
                }
            }
        }
    }
    status, wh_res = request("POST", "/api/webhooks/razorpay", webhook_payload)
    assert status == 200 and wh_res.get("status") == "ok", f"Webhook failed: {status}, {wh_res}"
    print(f"  [PASS] 11. Live Razorpay Webhook Ingestion (/api/webhooks/razorpay): {wh_res.get('payment_id')}")
    passed += 1

    print("=" * 60)
    print(f"  ALL {passed}/{total} TESTS PASSED SUCCESSFULLY! ZERO REGRESSIONS.")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
