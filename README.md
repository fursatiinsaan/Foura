<div align="center">

# ⚡ Foura — Autonomous AI Revenue Recovery Engine

**Turn Payment Failures into Completed Checkouts in Sub-Second SLAs**

*Built for the [Razorpay AI Buildathon 2026](https://razorpay.com/buildathon/) · Track 03: AI Revenue Recovery*

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Tests-11%2F11%20Passing-10B981?style=flat-square)](tests/test_e2e_suite.py)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%208-61DAFB?style=flat-square&logo=react)](package.json)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11-009688?style=flat-square&logo=fastapi)](ai_backend/app/main.py)
[![LLM](https://img.shields.io/badge/LLM-LLaMA--3%20via%20Groq-7C3AED?style=flat-square)](ai_backend/app/ai_engine.py)
[![Payments](https://img.shields.io/badge/Payments-Razorpay%20SDK%20Test%20Mode-0080FF?style=flat-square)](https://razorpay.com)
[![Code Quality](https://img.shields.io/badge/Oxlint-0%20Warnings-10B981?style=flat-square)](package.json)

```
======================================================================================
  [F] F O U R A   ·   A U T O N O M O U S   R E V E N U E   R E C O V E R Y
======================================================================================
```

</div>

---

## 📑 Table of Contents
1. [The Problem: The $260B Payment Failure Void](#the-problem-the-260b-payment-failure-void)
2. [The Solution: Foura Autonomous Engine](#the-solution-foura-autonomous-engine)
3. [Architecture: The Bounded AI Sandwich](#architecture-the-bounded-ai-sandwich)
4. [Multi-Agent DAG Workflow](#multi-agent-dag-workflow)
5. [Key Technical Innovations](#key-technical-innovations)
6. [Quick Start (One-Command Boot)](#quick-start-one-command-boot)
7. [API Configuration Guide](#api-configuration-guide)
8. [Dashboard Walkthrough & Navigation](#dashboard-walkthrough--navigation)
9. [API & WebSocket Reference](#api--websocket-reference)
10. [Deterministic Safety Guardrails](#deterministic-safety-guardrails)
11. [Automated Verification & Test Suite](#automated-verification--test-suite)
12. [Razorpay Buildathon Track 03 Alignment](#razorpay-buildathon-track-03-alignment)

---

## The Problem: The $260B Payment Failure Void

Across global e-commerce and digital checkouts, **over 20% of high-intent transactions fail** before completion:
- **Core Banking Switch Degradation**: NPCI / HDFC / Visa switches drop packets during peak spikes (ISO 8583: `91`, `96`).
- **3D Secure Friction**: 3DS OTP challenge SMS delays or biometric popups timeout before user authorization (ISO: `68`).
- **Card & MPIN Credential Errors**: Shoppers mistype their UPI PIN or card expiry, triggering automatic card issuer lockouts.
- **Cart Abandonment & Hesitation**: Shoppers pause at checkout due to shipping fee spikes or sudden price hesitation.

### The Failure of Traditional Recovery:
- **Dumb Cron Retries**: Blindly re-attempting failed card transactions triggers card issuer fraud velocity blocks and inflates gateway interchange fees.
- **Generic Email Follow-ups**: Traditional cart recovery emails arrive 2 to 6 hours later—long after the shopper has purchased from a competitor.
- **Unconstrained AI Hallucinations**: Standard LLMs hallucinate financial amounts, invent discount codes that obliterate merchant gross margins, or spam customers who entered wrong PINs.

---

## The Solution: Foura Autonomous Engine

**Foura** is an autonomous multi-currency AI revenue recovery agent that intercepts digital checkout failures in **real time**, performs root-cause diagnostics using **LLaMA-3 via Groq**, verifies non-negotiable **deterministic compliance guardrails**, and dispatches tailored recovery interventions in **<0.82 seconds**—faster than an SMS OTP can be delivered.

```
+-------------------------------------------------------------------------------+
|  CUSTOMER DROPS CHECKOUT  -->  INTERCEPTED IN <12ms  -->  LLaMA-3 DIAGNOSIS   |
|         |                                                      |              |
|         v                                                      v              |
|  HARD DECLINE? (PIN/EXPIRED) ---> BLOCK RETRY            DETERMINISTIC GATES  |
|         |                                                (RBI 3-CAP / 5% CEIL)|
|         v                                                      |              |
|  100% REGULATORY SAFE                                          v              |
|                                                     WHATSAPP / RAIL DISPATCH  |
|                                                                |              |
|                                                                v              |
|                                                     CAPITAL SECURED (0.82s)   |
+-------------------------------------------------------------------------------+
```

---

## Architecture: The Bounded AI Sandwich

Money movement demands 100% mathematical determinism. Foura enforces an **AI Sandwich Architecture** where probabilistic LLM reasoning is strictly bounded between deterministic Python safety layers:

```
                  ┌──────────────────────────────────────────────┐
                  │ 1. Telemetry Ingestion (Deterministic Python)│
                  │ - Webhook / Failure Ingestion (<12ms)        │
                  │ - Synchronous SQLite placeholder creation    │
                  │ - Hard Decline Safety Gate (PIN / Expiry)    │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │ 2. Cognitive Layer (LLaMA-3 / Groq Cloud)    │
                  │ - ISO 8583 Error Code & Switch Synthesizer   │
                  │ - Buyer Propensity & Persona Classifier      │
                  │ - Empathetic, Personalized Copywriting       │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │ 3. Safety & Action Rail (Deterministic)      │
                  │ - RBI 3-Attempt Max Stopping Rule Enforcement│
                  │ - Merchant 5% Gross Margin Concession Floor  │
                  │ - Official Razorpay Live Payment Link SDK    │
                  │ - Real-Time WebSocket Telemetry Broadcast    │
                  └──────────────────────────────────────────────┘
```

---

## Multi-Agent DAG Workflow

Foura executes recovery decisions across a 4-node Directed Acyclic Graph (DAG):

| Node | Name | Function | SLA |
|---|---|---|---|
| **Node 01** | `Telemetry Classifier` | Ingests webhook payload, normalizes ISO 8583 error packets, and snapshots bank switch latency matrix. | `<12ms` |
| **Node 02** | `LLaMA-3 Diagnostician` | Feeds failure metadata, cart category, customer tier, and currency into LLaMA-3 to formulate root-cause diagnosis. | `~380ms` |
| **Node 03** | `Guardrail Circuit` | Enforces hard decline blocks (e.g. incorrect MPIN), RBI 3-retry ceilings, and margin discounts (capped at 5%). | `<2ms` |
| **Node 04** | `Idempotent Dispatcher` | Generates cryptographically signed Razorpay payment recovery links and pushes updates via WebSockets. | `<350ms` |

---

## Key Technical Innovations

### 1. Zero Race-Condition Ingestion Pattern
In high-throughput fintech APIs, background async tasks often create records after the API caller requests state, producing intermittent `404 Not Found` errors. Foura eliminates this by **synchronously committing an indexed placeholder record** to SQLite at the ingestion boundary before spawning the background LLaMA-3 diagnostics task, ensuring 100% immediate addressability.

### 2. Multi-Armed Bandit (UCB1) Optimization
Foura dynamically balances exploration and exploitation across recovery policies (Predictive Backoff, WhatsApp Concierge, Smart UPI Fallback) using Upper Confidence Bound (UCB1) mathematics:
$$\text{Score}(\text{Policy}_i) = \mu_i + c \cdot \sqrt{\frac{2 \ln N}{n_i}}$$

### 3. Native Multi-Currency Normalization (USD, EUR, INR)
Real-time normalization engine supporting:
- **USD ($)**: ACH Fedwire, Apple Pay, Visa Direct rails.
- **EUR (€)**: SEPA Instant Credit Transfer, iDEAL, Sofort.
- **INR (₹)**: UPI Intent, HDFC/SBI Netbanking, IMPS instant settlement.
Currency toggling instantly re-calculates all GMV metrics, risk exposures, and historical ledgers.

### 4. Interactive WhatsApp Concierge Preview
Real-time customer preview displaying the exact WhatsApp recovery message, cart reservation countdown, and direct 1-click Razorpay payment link.

### 5. Multi-Sensory Feedback Engine
- **Web Audio Synthesizer**: Pure Web Audio API producing an `E5 → B5 → E6` major triad chord upon successful recovery without external audio files.
- **Canvas Physics Confetti**: 45-particle canvas blast upon capital reclamation.

---

## Quick Start (One-Command Boot)

Foura includes a **cross-platform, self-healing orchestrator** (`run.py`) that manages the entire lifecycle.

### Prerequisites
- **Python 3.9+** (Python 3.11 recommended)
- **Node.js 18+** and **npm**
- **Git**

### Installation

```bash
# 1. Clone repository
git clone https://github.com/fursatiinsaan/Foura.git
cd Foura

# 2. Start the application (One command!)
python3 run.py
```

*(On macOS/Linux, `./start.sh` is also available)*

### What the Launcher Does Automatically:
1. Validates Python and Node.js versions.
2. Creates `ai_backend/venv` with an active interpreter health check.
3. Automatically installs backend dependencies from `requirements.txt`.
4. Automatically installs frontend dependencies via `npm install`.
5. Clears any zombie processes occupying ports `8003` or `5173`.
6. Launches FastAPI Backend on `http://localhost:8003`.
7. Launches Vite Frontend on `http://localhost:5173`.

---

## API Configuration Guide

Foura runs out-of-the-box with intelligent fallback simulation. To enable live LLaMA-3 diagnostics and genuine Razorpay link generation:

```bash
cp ai_backend/.env.example ai_backend/.env
```

Edit `ai_backend/.env`:

```env
# 1. Groq API Key (Free instant signup: https://console.groq.com/keys)
OPENAI_API_KEY=gsk_your_groq_api_key_here

# 2. Razorpay Test Mode Keys (From: https://dashboard.razorpay.com/app/keys)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key

# 3. Razorpay Webhook Secret (Matches webhook configuration in Razorpay Dashboard)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# 4. Database (SQLite - no changes needed for local development)
DATABASE_URL=sqlite+aiosqlite:///./recovery_agent.db
```

### How to obtain free test keys:
- **Groq API Key**: Sign up at [console.groq.com](https://console.groq.com) → Click **API Keys** → **Create Key**. Provides free access to LLaMA-3 inference.
- **Razorpay Test Keys**: Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com) → Switch toggle to **Test Mode** → Go to **Settings** → **API Keys** → Generate Test Key.

---

## Dashboard Walkthrough & Navigation

The interface is structured into **3 core operational views**:

<div align="center">

| Hub | Purpose | Key Features |
|---|---|---|
| **1. Recovery Hub** | Real-time Cockpit & Testing | Live telemetry ticker, 4 KPI cards, synthetic failure injector, pending queue, LLaMA-3 forensic inspector, WhatsApp preview, auto-pilot toggle. |
| **2. Transactions & Payouts** | Immutable Audit Ledger | Searchable transaction table, inline expandable forensic accordions, multi-currency payouts (USD Fedwire, EUR SEPA, INR IMPS), 1-click CSV audit export. |
| **3. Engine Architecture & ROI** | Intelligence & Compliance | Multi-agent DAG visualizer, UCB1 bandit formulas, live rail latency radar, interactive GMV profit lift slider, RBI compliance controls. |

</div>

---

## API & WebSocket Reference

### HTTP Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard-state` | Consolidated single-call API returning metrics, recoveries list, and engine settings. |
| `POST` | `/api/simulate-failure` | Injects synthetic multi-currency checkout failure scenarios (Card, UPI, Netbanking). |
| `POST` | `/api/recoveries/{id}/trigger-action` | Executes recovery policy on a specific transaction and dispatches payment link. |
| `POST` | `/api/recoveries/batch-trigger` | One-click autonomous recovery of all pending payment drops. |
| `POST` | `/api/settlements/instant` | Simulates on-demand same-day merchant payout across USD, EUR, or INR banking rails. |
| `POST` | `/api/settings` | Updates RBI retry cap limits and margin concession floors. |
| `POST` | `/api/webhooks/razorpay` | Ingestion endpoint for official Razorpay `payment.failed` webhook payloads. |
| `GET` | `/docs` | Custom-branded Swagger UI documentation with Foura SVG emblem. |
| `GET` | `/logo.svg` | Official Razorpay-inspired geometric F logo asset. |

### Real-Time WebSocket (`ws://localhost:8003/ws`)
Broadcasts real-time events to all connected clients:
- `new_case`: Emitted immediately when a transaction failure is intercepted.
- `recovered`: Emitted when an individual payment is reclaimed.
- `batch_recovered`: Emitted when batch autonomous recovery completes.

---

## Deterministic Safety Guardrails

Security and compliance rules enforced in `ai_backend/app/guardrails.py`:

```
+-------------------------------------------------------------------------------+
| ERROR CODE TRIGGER          ACTION ENFORCED           REGULATORY RATIONALE    |
+-------------------------------------------------------------------------------+
| BAD_REQUEST_PAYMENT_PIN_*   HARD_FAIL_ABANDON         Prevents credential     |
| UPI_INCORRECT_MPIN          (Blocked Retries)         harassment & bank locks |
+-------------------------------------------------------------------------------+
| RETRY_COUNT >= 3            HARD_FAIL_ABANDON         RBI / Global Network    |
|                             (Max Retry Ceil)          velocity rules          |
+-------------------------------------------------------------------------------+
| DISCOUNT_PCT > 5%           CAP AT 5.0%               Protects merchant gross |
|                             (Margin Floor)            margin profitability    |
+-------------------------------------------------------------------------------+
```

---

## Automated Verification & Test Suite

Run the full automated test suite against the running engine:

```bash
python3 tests/test_e2e_suite.py
```

### Verified Test Matrix:
```
============================================================
  🧪 Running Foura Comprehensive Automated Test Suite
============================================================
  [PASS] 1. Custom Branded SVG Logo Endpoint (/logo.svg)
  [PASS] 2. Swagger Docs with Foura Branding (/docs)
  [PASS] 3. Consolidated State API (USD): 17 cases, risk: $904.71
  [PASS] 4. Multi-Currency Normalization (INR / EUR / USD conversions)
  [PASS] 5. Failure Injection & Synchronous DB Ingestion: pay_...
  [PASS] 6. Single-Click Recovery Dispatch: pay_... reclaimed
  [PASS] 7. Batch Autonomous Recovery: 2 cases cleared
  [PASS] 8. Instant Multi-Currency Settlement Dispatch: setl_...
  [PASS] 9. Engine Compliance Configuration Update & Persistence
  [PASS] 10. Deterministic Safety Circuit: PIN hard decline blocked immediately (HARD_DECLINE_SECURITY_BLOCKED)
  [PASS] 11. Live Razorpay Webhook Ingestion (/api/webhooks/razorpay): pay_webhook_...
============================================================
  ALL 11/11 TESTS PASSED SUCCESSFULLY! ZERO REGRESSIONS.
============================================================
```

### Static Analysis & Build Verification:
```bash
npm run lint    # Oxlint — 0 errors, 0 warnings
npm run build   # Production Vite bundle — built in 125ms
```

---

## Razorpay Buildathon Track 03 Alignment

| Buildathon Requirement | Foura Implementation |
|---|---|
| **Autonomous Interception** | Real-time webhook ingestion (`/api/webhooks/razorpay`) and background traffic listener in <12ms. |
| **Root Cause Diagnosis** | Groq-accelerated LLaMA-3 synthesizing ISO 8583 codes, bank health, and customer personas. |
| **Compliance & Guardrails** | Deterministic Python sandwich: RBI 3-retry ceiling, hard PIN decline stop, 5% margin floor. |
| **Actionable Recovery** | Official Razorpay Payment Link SDK generation + interactive WhatsApp Concierge preview. |
| **Multi-Currency Support** | Native USD ($), EUR (€), and INR (₹) conversions with same-day settlement simulation. |
| **Quantified Merchant ROI** | Real-time recovery rates, revenue recovered KPI, and interactive GMV profit lift calculator. |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Built with dedication for the **Razorpay AI Buildathon 2026** by [fursatiinsaan](https://github.com/fursatiinsaan).
