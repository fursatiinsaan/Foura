# Foura — AI Revenue Recovery Engine

> Built for [Razorpay AI Buildathon](https://razorpay.com/buildathon/) · **Track 03: AI Revenue Recovery**

Foura is an autonomous AI agent that intercepts failed digital payments in real-time, diagnoses the root cause using LLaMA-3, and executes bounded recovery workflows — all within compliance guardrails — to win back revenue that would otherwise be lost.

![White & Black UI](https://img.shields.io/badge/UI-White%20%26%20Black-111111?style=flat-square) ![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square) ![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square) ![LLaMA-3](https://img.shields.io/badge/LLM-LLaMA--3-7C3AED?style=flat-square)

---

## What It Does

1. **Intercepts** `payment.failed` webhook events across Card, UPI, and SEPA rails
2. **Diagnoses** the root cause (3DS timeout, bank switch degradation, price hesitation, etc.) using LLaMA-3 via Groq
3. **Formulates** a personalized recovery strategy with multi-currency messaging (USD, EUR, INR)
4. **Enforces guardrails** — hard-coded 3-attempt retry cap, discount ceiling validation, spam prevention
5. **Dispatches** recovery via WhatsApp/Email with one-click payment links

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, Framer Motion, Lucide Icons |
| Backend | Python 3.11, FastAPI, SQLite (aiosqlite), SQLAlchemy |
| AI Engine | LLaMA-3 70B via Groq API |
| Payments | Razorpay Test Mode SDK |
| Design | Minimal white & black monochrome theme |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- A free [Groq API key](https://console.groq.com)

### Setup

```bash
# Clone
git clone https://github.com/fursatiinsaan/Foura.git
cd Foura

# Frontend dependencies
npm install

# Backend setup
cd ai_backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Add your API keys
cp .env.example .env
# Edit .env with your Groq + Razorpay keys

cd ..
```

### Run (one command)

```bash
chmod +x start.sh
./start.sh
```

Or manually:

```bash
# Terminal 1 — Backend
cd ai_backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8003

# Terminal 2 — Frontend
npm run dev
```

Open **http://localhost:5173**

---

## Project Structure

```
Foura/
├── src/
│   ├── App.jsx          # Full React UI — all 10 views
│   └── index.css        # Clean minimal CSS
├── ai_backend/
│   ├── app/
│   │   ├── main.py      # FastAPI routes & simulation engine
│   │   └── ai_engine.py # LLaMA-3 prompt engineering & recovery logic
│   ├── requirements.txt
│   └── .env.example
├── start.sh             # One-command launcher (frontend + backend)
├── run.py               # Python launcher alternative
└── package.json
```

---

## Problems I Faced Building This

### 1. Getting the AI to not hallucinate financial amounts
The biggest problem. LLaMA-3 would sometimes generate wrong currency symbols, invent discount percentages, or make up order IDs. I had to build what I call the **"AI Sandwich Architecture"** — the LLM only handles reasoning and message copywriting, while every number, currency conversion, discount cap, and retry count is computed by deterministic Python code *before and after* the LLM call. The AI is sandwiched between hard-coded safety layers.

### 2. Multi-currency formatting hell
Supporting USD ($), EUR (€), and INR (₹) simultaneously sounds simple until you realize `Intl.NumberFormat` behaves differently for each locale, INR uses lakhs grouping, and the backend has to normalize everything to cents/paise internally while displaying in the user's chosen currency. Took multiple iterations to get conversion rates, symbol placement, and decimal precision right across both frontend and backend.

### 3. Real-time simulation without a real payment gateway
Since this is a buildathon demo, there's no live Razorpay integration processing real cards. I had to build a realistic simulation engine that generates diverse failure scenarios — 3DS timeouts, UPI collect expiry, SEPA switch degradation, price hesitation — with realistic customer personas, cart categories, and amounts across 3 currencies. Making it feel "real" without real transactions was harder than expected.

### 4. The UI kept getting cluttered
Every time I added a feature (live terminal stream, latency radar, execution stepper, filter chips, notification bell, mode toggles), the dashboard got noisier. I rewrote the entire frontend twice. The first version had frosted glass cards, neon glow effects, and animated pulse rings everywhere — it looked like a sci-fi movie but was unusable. The final version is radically stripped down: white background, black text, minimal borders, lots of whitespace. Less is more.

### 5. JSX string escaping gotchas
Lost time to a build-breaking bug because of an apostrophe in a JSX string (`We've` inside single quotes). Vite's parser choked on it silently during HMR and only showed the error on production build. Small thing, but annoying when you're iterating fast.

### 6. Port conflicts and process management
Running both a Vite dev server and a FastAPI/Uvicorn server simultaneously led to constant port collision issues. Ports 5173 and 8003 would stay occupied after crashes, and the next `npm run dev` would silently pick a different port (5174), breaking the API proxy. Had to build `start.sh` to kill stale processes on both ports before launching.

### 7. Making the recovery loop feel autonomous
The core product claim is "autonomous recovery" but making a button click *feel* autonomous (vs just "I clicked recover") required the execution stepper animation, the auto-pilot mode, background traffic injection every 14 seconds, and the live telemetry pulse bar. The perception of autonomy needed as much engineering as the actual logic.

### 8. Groq API token limits and prompt engineering
LLaMA-3 70B via Groq is fast but has tight context windows. The initial prompts were too verbose — I was stuffing full transaction history, customer profiles, and bank switch states into every call. Had to trim prompts aggressively and build a token repair layer that catches truncated JSON responses and patches them before parsing.

---

## Features

- **10 interactive views**: Recovery Deck, Overview, Transactions, Settlements, Customers, AI Pipeline, Injection Studio, Rail Radar, ROI Calculator, Settings
- **Multi-currency**: USD, EUR, INR with live conversion
- **Auto-Pilot mode**: Continuous autonomous recovery loop
- **Batch recovery**: One-click recover all pending transactions
- **Failure injection studio**: Custom edge-case testing with configurable personas, error codes, currencies
- **WhatsApp/Email preview**: See exactly what the customer receives
- **CSV export**: Audit trail of all recovered transactions
- **Instant settlements**: Multi-currency payout simulation
- **Global rail radar**: Live payment network health monitoring with latency jitter
- **ROI calculator**: Interactive GMV slider showing recovered revenue projections

---

## License

MIT

---

*Built with sleep deprivation and too much chai for the Razorpay AI Buildathon 2026.*
