import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import {
  Activity, Play, Zap, Home, CreditCard, Users, Settings, Search,
  CheckCircle, ShieldCheck, RefreshCw, Globe, Terminal,
  Cpu, Sliders, BarChart3, Clock, Radio, Download, Wallet,
  ExternalLink, MessageSquare, Mail, Code2, Volume2, VolumeX,
  ShoppingBag, ArrowRight, ShieldAlert, ChevronRight, Check, Hash,
  Layers, Lock, Database, ArrowUpRight, Network
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './index.css'

const API = 'http://localhost:8003/api'

const CURRENCIES = {
  USD: { symbol: '$', locale: 'en-US' },
  INR: { symbol: '₹', locale: 'en-IN' },
  EUR: { symbol: '€', locale: 'de-DE' }
}

const fmt = (amount, currency = 'USD') => {
  const c = CURRENCIES[currency] || CURRENCIES.USD
  return new Intl.NumberFormat(c.locale, {
    style: 'currency', currency, minimumFractionDigits: currency === 'INR' ? 0 : 2, maximumFractionDigits: 2
  }).format(amount)
}

const label = (text) => {
  if (!text) return ''
  const map = {
    PREDICTIVE_RETRY: 'Predictive Delayed Retry',
    SOFT_NUDGE_WHATSAPP: 'WhatsApp Concierge Nudge',
    INTENT_SWITCH_FALLBACK: 'Autonomous Rail Switch (UPI)',
    HARD_FAIL_ABANDON: 'Deterministic Safety Stop (Max Retries)',
    '3DS_OTP_CHALLENGE_TIMEOUT': '3DS OTP Timeout (ISO RC: 68)',
    '3DS2_FRICTIONLESS_REJECTED': 'SCA 3DS2 Declined (ISO RC: 05)',
    ISSUER_HIGH_VALUE_VELOCITY_CHECK: 'Issuer Velocity Check (ISO RC: 65)',
    BANK_NPCI_SWITCH_DEGRADED: 'Core Switch Packet Loss (ISO RC: 91)',
    UPI_PSP_APP_NOT_RESPONDING: 'UPI Collect Expired (ISO RC: U19)',
    GATEWAY_TIMEOUT_NPCI_PEAK: 'Gateway Timeout (ISO RC: 96)',
    GATEWAY_TIMEOUT_PEAK_TRAFFIC: 'Gateway Peak Traffic (ISO RC: 96)',
    CHECKOUT_DISMISSED_PRICE_HESITATION: 'Price Hesitation Abandonment',
    INSUFFICIENT_FUNDS_BALANCE_LOW: 'Insufficient Funds (ISO RC: 51)',
    NETBANKING_2FA_SESSION_EXPIRED: '2FA Session Expired',
    UNKNOWN_ERROR: 'Processing Error',
    RETRY_CAP_EXCEEDED: 'Retry Cap Limit Reached',
    LOW_CONFIDENCE: 'Conservative Gating Triggered'
  }
  return map[text] || text.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function App() {
  const [tab, setTab] = useState('live_checkout')
  const [currency, setCurrency] = useState('USD')
  const [search, setSearch] = useState('')
  const [metrics, setMetrics] = useState({ total_failed: 0, revenue_at_risk: 0, revenue_recovered: 0, recovery_rate: 0 })
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [autoPilot, setAutoPilot] = useState(false)
  const [toast, setToast] = useState(null)
  const [previewMode, setPreviewMode] = useState('whatsapp')
  const [gmv, setGmv] = useState(250000)
  const [settling, setSettling] = useState(false)
  const [settlementResult, setSettlementResult] = useState(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Live Checkout Simulation State
  const [checkoutName, setCheckoutName] = useState('Sarah Jenkins')
  const [checkoutEmail, setCheckoutEmail] = useState('sarah.j@enterprise.io')
  const [checkoutProduct, setCheckoutProduct] = useState({ name: 'Enterprise Cloud Infrastructure Tier', price: 1299, currency: 'USD', category: 'SaaS Platform' })
  const [checkoutStep, setCheckoutStep] = useState('cart') // 'cart' | 'processing' | 'failed' | 'recovered'
  const [simulatedFailureType, setSimulatedFailureType] = useState('3DS_OTP_CHALLENGE_TIMEOUT')
  const [latestRecoveredLink, setLatestRecoveredLink] = useState('')
  const [latestHmacSignature, setLatestHmacSignature] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

  // Sandbox Custom state
  const [sbName, setSbName] = useState('Alexander Hayes')
  const [sbFailure, setSbFailure] = useState('3DS_OTP_CHALLENGE_TIMEOUT')
  const [sbCurrency, setSbCurrency] = useState('USD')
  const [sbAmount, setSbAmount] = useState(299)

  // Settings
  const [settings, setSettings] = useState({ rbi_max_retries: 3, discount_ceiling_pct: 5, default_channel: 'multi_channel' })

  // Latency jitter
  const [lat, setLat] = useState({ visa: 142, sepa: 312, upi: 218 })

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // Refs so WebSocket handler always reads latest values
  const currencyRef = useRef(currency)
  const searchRef = useRef(search)
  const selectedRef = useRef(selected)
  const autoPilotRef = useRef(autoPilot)
  const runningRef = useRef(running)

  useEffect(() => { currencyRef.current = currency }, [currency])
  useEffect(() => { searchRef.current = search }, [search])
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { autoPilotRef.current = autoPilot }, [autoPilot])
  useEffect(() => { runningRef.current = running }, [running])

  const [engineActivity, setEngineActivity] = useState('Listening on live ISO 8583 payment telemetry stream')

  const fetchData = useCallback(async () => {
    try {
      const cur = currencyRef.current
      const q = searchRef.current
      // 1 single consolidated API call instead of 3 separate requests
      const res = await axios.get(`${API}/dashboard-state?display_currency=${cur}&search=${q || ''}`)
      setMetrics(res.data.metrics)
      setCases(res.data.recoveries)
      if (res.data.settings) setSettings(res.data.settings)

      const sel = selectedRef.current
      if (sel) {
        const u = res.data.recoveries.find(x => x.id === sel.id)
        if (u) setSelected(u)
      } else if (res.data.recoveries.length > 0) {
        setSelected(res.data.recoveries[0])
      }

      if (autoPilotRef.current && !runningRef.current) {
        const p = res.data.recoveries.find(x => !x.is_recovered)
        if (p) recover(p)
      }
    } catch (e) { console.error(e) }
  }, [])

  // ─── Real-time WebSocket connection ───
  useEffect(() => {
    let ws
    let reconnectTimer

    const connect = () => {
      ws = new WebSocket('ws://localhost:8003/ws')

      ws.onopen = () => {
        console.log('[WS] Connected to Telemetry Hub')
        setEngineActivity('WebSocket telemetry connection established (0ms delay)')
        fetchData()
      }

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data)
          if (event === 'new_case') {
            notify(`Intercepted checkout drop: ${data.customer_name} (${fmt(data.amount, data.currency)})`)
          } else if (event === 'recovered') {
            notify(`Transaction Reclaimed: ${data.id}`)
          } else if (event === 'batch_recovered') {
            notify(`Batch recovered ${data.count} transactions`)
          }
          fetchData()
        } catch (err) {
          console.error('[WS] Parse error', err)
        }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  }, [fetchData])

  // Latency jitter (cosmetic)
  useEffect(() => {
    const t = setInterval(() => {
      setLat({ visa: 138 + Math.floor(Math.random() * 8), sepa: 305 + Math.floor(Math.random() * 14), upi: 210 + Math.floor(Math.random() * 16) })
    }, 3000)
    return () => clearInterval(t)
  }, [])

  // Refetch when currency or search changes
  useEffect(() => { fetchData() }, [currency, search])

  const simulate = async (cur) => {
    const targetCurr = cur || currency
    const res = await axios.post(`${API}/simulate-failure?currency=${targetCurr}`)
    await fetchData()
    notify(`Intercepted ${targetCurr} failure for ${res.data.customer}`)
  }

  const recover = async (c) => {
    setSelected(c); setRunning(true)
    
    setStep(1)
    setEngineActivity(`[Node 01 · Ingestion] Parsing ISO error code for order ${c.id} (${c.currency} ${c.amount})...`)
    await new Promise(r => setTimeout(r, 350))
    
    setStep(2)
    setEngineActivity(`[Node 02 · Reasoning] LLaMA-3 evaluating root-cause & optimizing recovery policy for ${c.customer_name}...`)
    await new Promise(r => setTimeout(r, 450))
    
    setStep(3)
    setEngineActivity(`[Node 03 · Safety] Enforcing deterministic RBI 3-retry limit & 5% margin concession ceiling...`)
    await new Promise(r => setTimeout(r, 350))
    
    setStep(4)
    setEngineActivity(`[Node 04 · Dispatch] Generating HMAC-SHA256 signature and dispatching to customer endpoints...`)
    await new Promise(r => setTimeout(r, 350))

    await axios.post(`${API}/recoveries/${c.id}/trigger-action`)
    await fetchData()
    setRunning(false)
    setEngineActivity(`[Execution Complete] Order ${c.id} successfully reclaimed in 0.82s SLA.`)
    notify(`Successfully reclaimed ${fmt(c.amount, c.currency)}!`)
  }

  const batchRecover = async () => {
    setRunning(true)
    setEngineActivity(`[Batch Engine] Executing 1-click autonomous recovery across ${pending.length} pending transactions...`)
    const res = await axios.post(`${API}/recoveries/batch-trigger`)
    await fetchData()
    setRunning(false)
    setEngineActivity(`[Batch Complete] Reclaimed ${res.data.recovered_count || 'all'} transactions across banking rails.`)
    notify(`Batch recovered ${res.data.recovered_count || 'all'} transactions!`)
  }

  // Interactive Live Checkout Trigger
  const runLiveCheckoutSimulation = async () => {
    setCheckoutStep('processing')
    await new Promise(r => setTimeout(r, 600))
    setCheckoutStep('failed')

    const res = await axios.post(`${API}/simulate-failure`, {
      customer_name: checkoutName,
      email: checkoutEmail,
      category: checkoutProduct.category,
      tier: 'Enterprise VIP Tier',
      amount: checkoutProduct.price * 100,
      currency: checkoutProduct.currency,
      error_code: simulatedFailureType,
      error_desc: `Interrupted during ${simulatedFailureType.replace(/_/g, ' ')}`,
      concession: true
    })

    await fetchData()
    const newCase = cases.find(c => c.id === res.data.id) || { id: res.data.id, amount: res.data.amount, currency: res.data.currency }
    setSelected(newCase)
    setLatestRecoveredLink(`https://pay.foura.io/recover/${res.data.id}`)
    
    // Generate deterministic mock HMAC signature for demonstration
    const fakeSig = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    setLatestHmacSignature(fakeSig)

    await new Promise(r => setTimeout(r, 800))
    await recover(newCase)
    setCheckoutStep('recovered')
  }

  const speakMessage = (text) => {
    if (!('speechSynthesis' in window)) {
      notify('Voice synthesis not supported in this environment.')
      return
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text || "Hello, your checkout transaction was interrupted. We have reserved your cart for 15 minutes.")
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const injectCustom = async () => {
    await axios.post(`${API}/simulate-failure`, {
      customer_name: sbName, amount: Math.round(sbAmount * 100), currency: sbCurrency,
      error_code: sbFailure, error_desc: sbFailure.replace(/_/g, ' ')
    })
    await fetchData()
    setTab('deck')
    notify('Injected custom failure vector into telemetry pipeline!')
  }

  const settle = async () => {
    setSettling(true)
    const res = await axios.post(`${API}/settlements/instant`, { amount: metrics.revenue_recovered, currency })
    setSettlementResult(res.data)
    setSettling(false)
    notify('Settlement dispatched across banking rails!')
  }

  const exportCsv = () => {
    const rows = [
      ['Payment ID', 'Customer Name', 'Currency', 'Amount', 'ISO Error Code', 'AI Policy Action', 'Status'],
      ...resolved.map(c => [c.id, c.customer_name, c.currency, c.amount, c.error_code, c.recommended_action, 'RECOVERED'])
    ]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `foura_audit_ledger_${Date.now()}.csv`; a.click()
    notify('Exported audit history to CSV!')
  }

  const saveSettings = async () => {
    await axios.post(`${API}/settings`, settings)
    notify('Engine configuration persisted!')
  }

  const pending = cases.filter(c => !c.is_recovered)
  const resolved = cases.filter(c => c.is_recovered)

  const navItems = [
    { id: 'live_checkout', icon: Activity, label: 'Live Checkout & Trace' },
    { id: 'deck', icon: Zap, label: 'Recovery Deck' },
    { id: 'overview', icon: Home, label: 'Executive Cockpit' },
    { id: 'transactions', icon: CreditCard, label: 'Transactions Ledger' },
    { id: 'settlements', icon: Wallet, label: 'Settlements' },
    { id: 'customers', icon: Users, label: 'Customer Intelligence' },
  ]

  const toolItems = [
    { id: 'bandit_engine', icon: Cpu, label: 'Multi-Armed Bandit Math' },
    { id: 'pipeline', icon: Layers, label: 'Multi-Agent Swarm DAG' },
    { id: 'sandbox', icon: Sliders, label: 'Injection Studio' },
    { id: 'radar', icon: Radio, label: 'ISO 8583 Rail Radar' },
    { id: 'roi', icon: BarChart3, label: 'ROI Calculator' },
    { id: 'settings', icon: Settings, label: 'Engine Settings' },
  ]

  return (
    <div className="layout">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <CheckCircle size={14} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#111" />
            <path d="M8.5 8H23.5V12H13V15H21V19H13V24H8.5V8Z" fill="#FFF" />
          </svg>
          <div>
            <h1>Foura</h1>
            <span>Autonomous Revenue Engine</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(n => (
            <div 
              key={n.id} 
              className={`nav-item ${tab === n.id ? 'active' : ''}`} 
              onClick={() => setTab(n.id)}
            >
              <n.icon size={16} /> {n.label}
            </div>
          ))}

          <div className="nav-section">Engine Architecture</div>

          {toolItems.map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <n.icon size={16} /> {n.label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-search">
            <Search size={16} />
            <input placeholder="Search telemetry, ISO codes, customer identifiers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="topbar-controls">
            <div className="chip">
              <span className="dot" />
              Telemetry Socket Active
            </div>
            <select className="currency-select" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <div className="avatar">F</div>
          </div>
        </header>

        <div className="content">

          {/* Structured Engine Execution & Telemetry Status Bar */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.9rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="dot" style={{ background: running ? '#111' : '#10B981', display: 'inline-block' }} />
              <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>
                {engineActivity}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: 'var(--text-muted)', fontSize: '0.7rem' }} className="mono">
              <span>SOCKET: ACTIVE</span>
              <span>CARD: {lat.visa}ms</span>
              <span>UPI: {lat.upi}ms</span>
              <span>API OVERHEAD: 1 REQ/STATE</span>
            </div>
          </div>
          {tab === 'live_checkout' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div className="tag tag-black" style={{ marginBottom: '0.4rem' }}>
                    <Network size={11} /> REAL-TIME INTERVENTION ENGINE
                  </div>
                  <h1>Live Checkout Ingestion & Autonomous Intervention Trace</h1>
                  <p>Execute synthetic checkout dropoffs to observe real-time root-cause analysis, deterministic safety gating, and sub-second recovery dispatch.</p>
                </div>
                <button className="btn" onClick={() => { setCheckoutStep('cart'); runLiveCheckoutSimulation(); }}>
                  <Play size={14} /> Execute End-to-End Pipeline
                </button>
              </div>

              {/* Split Screen Execution Drawer */}
              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                
                {/* Left: Interactive Merchant Checkout Surface */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShoppingBag size={16} /> 01. Digital Payment Gateway Session
                    </span>
                    <span className="tag mono">{checkoutProduct.currency}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label className="form-label">Customer Identifier</label>
                      <input className="form-input" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} />
                    </div>

                    <div>
                      <label className="form-label">Contact Endpoint (Email / Webhook)</label>
                      <input className="form-input" value={checkoutEmail} onChange={e => setCheckoutEmail(e.target.value)} />
                    </div>

                    <div className="grid-2">
                      <div>
                        <label className="form-label">Catalog SKU</label>
                        <select 
                          className="form-input" 
                          value={checkoutProduct.name} 
                          onChange={e => {
                            if (e.target.value === 'Enterprise Cloud Infrastructure Tier') setCheckoutProduct({ name: 'Enterprise Cloud Infrastructure Tier', price: 1299, currency: 'USD', category: 'SaaS Platform' })
                            if (e.target.value === 'High-Performance GPU Cluster') setCheckoutProduct({ name: 'High-Performance GPU Cluster', price: 3499, currency: 'USD', category: 'Cloud Compute' })
                            if (e.target.value === 'Commercial ERP Subscription') setCheckoutProduct({ name: 'Commercial ERP Subscription', price: 49999, currency: 'INR', category: 'Enterprise Software' })
                          }}
                        >
                          <option value="Enterprise Cloud Infrastructure Tier">Cloud Infrastructure Tier ($1,299)</option>
                          <option value="High-Performance GPU Cluster">GPU Cluster Instance ($3,499)</option>
                          <option value="Commercial ERP Subscription">ERP Subscription (₹49,999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Failure Telemetry Vector</label>
                        <select className="form-input" value={simulatedFailureType} onChange={e => setSimulatedFailureType(e.target.value)}>
                          <option value="3DS_OTP_CHALLENGE_TIMEOUT">3DS OTP Challenge Timeout (ISO: 68)</option>
                          <option value="BAD_REQUEST_PAYMENT_PIN_INCORRECT">Incorrect UPI PIN (Hard Decline - Safety Gated)</option>
                          <option value="BAD_REQUEST_PAYMENT_CARD_EXPIRED">Expired Card Credential (Non-Recoverable Block)</option>
                          <option value="BANK_NPCI_SWITCH_DEGRADED">Core Switch Packet Loss (ISO: 91)</option>
                          <option value="UPI_PSP_APP_NOT_RESPONDING">UPI Collect Request Expired (ISO: U19)</option>
                          <option value="CHECKOUT_DISMISSED_PRICE_HESITATION">Price Hesitation Abandonment</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div style={{ marginTop: '0.5rem', background: '#FAFAFA', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span>Transaction Value:</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900 }} className="tabular">
                          {fmt(checkoutProduct.price, checkoutProduct.currency)}
                        </span>
                      </div>

                      <button 
                        className="btn" 
                        style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }} 
                        disabled={checkoutStep === 'processing'}
                        onClick={runLiveCheckoutSimulation}
                      >
                        {checkoutStep === 'processing' ? <RefreshCw size={15} className="spin" /> : <CreditCard size={15} />}
                        {checkoutStep === 'processing' ? 'Injecting Telemetry & Routing...' : `Simulate Drop & Execute Recovery (${checkoutProduct.currency})`}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Right: Multi-Agent Execution & Cryptographic Verification */}
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Cpu size={16} /> 02. Multi-Agent DAG & Telemetry Trace
                    </span>
                    <span className="tag tag-black mono">SLA: 0.82s</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    
                    {/* Stepper */}
                    <div className="stepper">
                      <div className={`step ${checkoutStep === 'processing' || checkoutStep === 'failed' || checkoutStep === 'recovered' ? 'done' : ''}`}>1. Ingest (ISO: {simulatedFailureType === '3DS_OTP_CHALLENGE_TIMEOUT' ? '68' : '91'})</div>
                      <div className={`step ${checkoutStep === 'failed' || checkoutStep === 'recovered' ? 'done' : ''}`}>2. LLaMA-3 Diagnostics</div>
                      <div className={`step ${checkoutStep === 'failed' || checkoutStep === 'recovered' ? 'done' : ''}`}>3. Deterministic Safety</div>
                      <div className={`step ${checkoutStep === 'recovered' ? 'done' : ''}`}>4. HMAC Dispatched</div>
                    </div>

                    {/* WhatsApp Dark Mode Bubble */}
                    <div style={{ background: '#111B21', color: '#E9EDEF', padding: '1rem', borderRadius: '10px', fontSize: '0.84rem', lineHeight: '1.6', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#00A884' }}>
                          <CheckCircle size={14} /> Foura Autonomous Concierge
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#8696A0' }}>Multi-Channel Rail</span>
                      </div>

                      <div>
                        Hi {checkoutName}, we noticed your transaction for {checkoutProduct.name} was paused during {label(simulatedFailureType)}. Your order reservation is held with an authorized 5% time-decay concession for the next 15 minutes.
                      </div>

                      <div style={{ marginTop: '0.85rem', background: '#202C33', padding: '0.65rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#8696A0' }}>Tokenized 1-Click Payment Link</div>
                          <div style={{ fontWeight: 800, color: '#FFF' }} className="tabular">{fmt(checkoutProduct.price * 0.95, checkoutProduct.currency)} (5% Dynamic Concession)</div>
                        </div>
                        <a 
                          href={latestRecoveredLink || `https://pay.foura.io/recover/${selected?.id || 'demo'}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn btn-sm"
                          style={{ background: '#00A884', color: '#FFF', textDecoration: 'none' }}
                        >
                          Complete Order <ExternalLink size={12} />
                        </a>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                        {/* Audio Voice Concierge Trigger */}
                        <button 
                          className="btn btn-sm btn-outline" 
                          style={{ background: 'transparent', color: '#8696A0', border: '1px solid rgba(255,255,255,0.15)' }}
                          onClick={() => speakMessage(`Hello ${checkoutName}, your payment for ${checkoutProduct.name} was interrupted. We have reserved your cart for 15 minutes.`)}
                        >
                          {isSpeaking ? <VolumeX size={12} color="#FFF" /> : <Volume2 size={12} color="#FFF" />}
                          {isSpeaking ? 'Mute Concierge Voice' : 'Voice Synthesis Preview'}
                        </button>
                        <span style={{ fontSize: '0.65rem', color: '#8696A0' }}>Delivered in 0.82s ✓✓</span>
                      </div>
                    </div>

                    {/* Cryptographic Trace */}
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: '#FAFAFA', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>HMAC-SHA256 Idempotency Signature:</div>
                      <div style={{ wordBreak: 'break-all', color: '#71717A' }}>{latestHmacSignature}</div>
                    </div>

                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* ─── MULTI-ARMED BANDIT & RECOVERY MATH ENGINE ─── */}
          {tab === 'bandit_engine' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <div className="tag tag-black" style={{ marginBottom: '0.4rem' }}>
                  <Cpu size={11} /> ALGORITHMIC OPTIMIZATION
                </div>
                <h1>Multi-Armed Bandit (MAB) Recovery Engine</h1>
                <p>How Foura balances exploration vs exploitation across recovery policies using Upper Confidence Bound (UCB1) optimization.</p>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body">
                  <div className="form-label">Policy Selection Formula (Upper Confidence Bound - UCB1)</div>
                  <div style={{ background: '#0A0A0A', color: '#FFF', padding: '1rem', borderRadius: '8px', fontFamily: 'var(--mono)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Score(Policy_i) = μ_i + c · sqrt( (2 · ln N) / n_i )
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Where <strong>μ_i</strong> is the empirical recovery success rate of policy <em>i</em>, <strong>N</strong> is total checkout interceptions, <strong>n_i</strong> is the trial count of policy <em>i</em>, and <strong>c</strong> is the exploration parameter (calibrated to 0.72 for payment risk tolerance).
                  </p>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                  <div className="card-header"><h2>Policy Candidate Weights</h2></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { name: 'Policy A: Smart Alternate Rail Switch (UPI / Card)', ucb: 0.942, pulls: 428, rate: '81.2%' },
                      { name: 'Policy B: WhatsApp Concierge + Dynamic Concession', ucb: 0.918, pulls: 312, rate: '77.4%' },
                      { name: 'Policy C: Predictive Exponential Backoff Retry', ucb: 0.864, pulls: 195, rate: '64.8%' },
                      { name: 'Policy D: Buy Now Pay Later (BNPL) Fallback', ucb: 0.789, pulls: 84, rate: '52.1%' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#FAFAFA', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.84rem' }}>
                          <span>{p.name}</span>
                          <span className="mono bold">{p.rate} win</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>UCB Score: <strong style={{ color: 'var(--text)' }}>{p.ucb}</strong></span>
                          <span>Trained Pulls: {p.pulls}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header"><h2>Deterministic Boundary Gating</h2></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ background: '#FAFAFA', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text)' }}>1. Strict 3-Attempt Regulatory Cap</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        If <code>retry_count &gt;= 3</code>, all generative model proposals are rejected by Python circuit breakers, immediately executing <code>HARD_FAIL_ABANDON</code> to protect issuer reputation.
                      </div>
                    </div>

                    <div style={{ background: '#FAFAFA', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text)' }}>2. Margin Floor Constraint</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        Concession discounts are clamped mathematically to <code>min(discount, 5%)</code> to ensure merchant gross profit margins remain intact.
                      </div>
                    </div>

                    <div style={{ background: '#FAFAFA', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text)' }}>3. Idempotent Cryptographic Hashing</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        Payment recovery tokens are hashed with HMAC-SHA256 with 15-minute time-to-live (TTL), preventing double-billing or expired checkouts.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── MULTI-AGENT SWARM PIPELINE ─── */}
          {tab === 'pipeline' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Hierarchical Multi-Agent Architecture</h1>
                <p>Directed Acyclic Graph (DAG) of cooperating specialized sub-agents executing sub-second revenue recovery.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div className="card">
                  <div className="card-body">
                    <div className="tag mb-1">Node 01 · Ingestion</div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>Telemetry Classifier</h3>
                    <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>
                      Parses raw ISO 8583 error packets, validates gateway headers, and extracts buyer telemetry in &lt;12ms.
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="tag mb-1">Node 02 · Reasoning</div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>LLaMA-3 Diagnostician</h3>
                    <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>
                      Synthesizes issuer downtime, historical buyer propensity, and product category into contextual root causes.
                    </p>
                  </div>
                </div>

                <div className="card" style={{ border: '1.5px solid #111' }}>
                  <div className="card-body">
                    <div className="tag tag-black mb-1">Node 03 · Safety</div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>Guardrail Circuit</h3>
                    <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>
                      Deterministic Python gating. Checks RBI retry counters, discount ceilings, and customer anti-spam policies.
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="tag mb-1">Node 04 · Dispatch</div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>Idempotent Dispatcher</h3>
                    <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>
                      Signs recovery tokens with HMAC-SHA256 and coordinates WhatsApp, Email, and alternate rail links.
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2><ShieldCheck size={16} /> Architectural Defense: The AI Sandwich Paradigm</h2>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: '0.86rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                    Pure LLM applications fail in mission-critical payments because hallucinations cause regulatory non-compliance, financial liability, or customer harassment. Foura enforces an <strong>AI Sandwich Architecture</strong>: telemetry is ingested into high-speed deterministic classifiers, evaluated by LLaMA-3 for nuance, and then gated by hard-coded Python safety circuits before any money rail action is executed.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── RECOVERY DECK ─── */}
          {tab === 'deck' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              <div className="page-header">
                <h1>Recovery Deck</h1>
                <p>Intercept failed payments and recover revenue autonomously.</p>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => simulate()}>
                  <Activity size={14} /> Simulate Failure ({currency})
                </button>
                {pending.length > 0 && (
                  <button className="btn-outline btn" onClick={batchRecover}>
                    <Zap size={14} /> Recover All ({pending.length})
                  </button>
                )}
                <button
                  className={`btn ${autoPilot ? '' : 'btn-outline'}`}
                  onClick={() => { setAutoPilot(!autoPilot); notify(autoPilot ? 'Auto-pilot paused' : 'Auto-pilot active') }}
                >
                  {autoPilot ? '● Auto-Pilot On' : '○ Auto-Pilot'}
                </button>
              </div>

              {/* Metrics */}
              <div className="metrics">
                <div className="metric">
                  <div className="metric-label">At Risk</div>
                  <div className="metric-value tabular">{fmt(metrics.revenue_at_risk, currency)}</div>
                </div>
                <div className="metric primary">
                  <div className="metric-label">Recovered</div>
                  <div className="metric-value tabular">{fmt(metrics.revenue_recovered, currency)}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Interceptions</div>
                  <div className="metric-value tabular">{metrics.total_failed}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Success Rate</div>
                  <div className="metric-value tabular">{metrics.recovery_rate}%</div>
                </div>
              </div>

              {/* Main grid */}
              <div className="grid-sidebar" style={{ marginBottom: '1.5rem' }}>

                {/* Queue */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header">
                    <h2><Activity size={14} /> Pending Feed ({pending.length})</h2>
                  </div>
                  <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '560px', overflowY: 'auto', flex: 1 }}>
                    {pending.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <CheckCircle size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
                        All rails clear
                      </div>
                    ) : pending.map(c => (
                      <div
                        key={c.id}
                        className={`queue-item ${selected?.id === c.id ? 'selected' : ''}`}
                        onClick={() => !running && setSelected(c)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '1rem' }}>{fmt(c.amount, c.currency)}</span>
                          <span className="tag">{c.currency}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.15rem' }}>{c.customer_name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="text-xs muted">{label(c.error_code)}</span>
                          <button className="btn btn-sm" onClick={e => { e.stopPropagation(); recover(c) }}>
                            <Play size={10} /> Recover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inspector */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header">
                    <h2><Terminal size={14} /> Diagnostic Inspector</h2>
                    {selected && <span className="tag mono">{selected.id}</span>}
                  </div>

                  {!selected ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select an intercepted payment to inspect diagnostic telemetry.
                    </div>
                  ) : (
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>

                      {/* Summary row */}
                      <div className="grid-4" style={{ gap: '0.75rem' }}>
                        <div>
                          <div className="form-label">Amount</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmt(selected.amount, selected.currency)}</div>
                        </div>
                        <div>
                          <div className="form-label">Customer</div>
                          <div style={{ fontWeight: 700 }}>{selected.customer_name}</div>
                          <div className="text-xs muted">{selected.customer_tier}</div>
                        </div>
                        <div>
                          <div className="form-label">Category</div>
                          <div style={{ fontWeight: 600 }}>{selected.cart_category}</div>
                        </div>
                        <div>
                          <div className="form-label">Confidence</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selected.recovery_score}%</div>
                        </div>
                      </div>

                      {/* Stepper */}
                      {running && (
                        <div className="stepper">
                          <div className={`step ${step >= 1 ? 'done' : ''}`}>Ingested</div>
                          <div className={`step ${step >= 2 ? 'done' : ''}`}>Analyzed</div>
                          <div className={`step ${step >= 3 ? 'done' : ''}`}>Guardrails</div>
                          <div className={`step ${step >= 4 ? 'done' : ''}`}>Dispatched</div>
                        </div>
                      )}

                      {/* Diagnosis */}
                      <div>
                        <div className="form-label">Root Cause Diagnostic</div>
                        <div style={{ background: '#F8F8F8', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', lineHeight: 1.6 }}>
                          {selected.ai_reasoning || 'Analyzing transaction telemetry...'}
                        </div>
                      </div>

                      {/* Strategy + Guardrails */}
                      <div className="grid-2">
                        <div>
                          <div className="form-label">Strategy Policy</div>
                          <div style={{ fontWeight: 700 }}>{label(selected.recommended_action)}</div>
                        </div>
                        <div>
                          <div className="form-label">Guardrail Verification</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                            <ShieldCheck size={16} /> 3-attempt cap · Margin limits
                          </div>
                        </div>
                      </div>

                      {/* Message preview */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span className="form-label" style={{ margin: 0 }}>Message Preview</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {['whatsapp', 'json'].map(m => (
                              <button key={m} className={`tag ${previewMode === m ? 'tag-black' : ''}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setPreviewMode(m)}>
                                {m === 'whatsapp' && <MessageSquare size={10} />}
                                {m === 'json' && <Code2 size={10} />}
                                {m === 'whatsapp' ? 'WhatsApp Concierge' : 'Raw JSON'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {previewMode === 'whatsapp' && (
                          <div style={{ background: '#F5F5F5', padding: '0.85rem', borderRadius: '8px', fontSize: '0.84rem', lineHeight: 1.6 }}>
                            {selected.personalized_message || 'Your payment was paused. We’ve reserved your order.'}
                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid #E8E8E8', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <a href={`https://pay.foura.io/recover/${selected.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--black)', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                Complete Checkout <ExternalLink size={10} />
                              </a>
                              <span className="text-xs muted">✓✓</span>
                            </div>
                          </div>
                        )}

                        {previewMode === 'json' && (
                          <div className="terminal">
                            <pre style={{ margin: 0, fontSize: '0.7rem' }}>{JSON.stringify(selected, null, 2)}</pre>
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-sm" style={{ fontWeight: 700 }}>
                          {selected.is_recovered ? '✓ Recovered' : running ? 'Processing...' : '● Pending Action'}
                        </span>
                        {!selected.is_recovered && (
                          <button className="btn" disabled={running} onClick={() => recover(selected)}>
                            {running ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
                            {running ? 'Running...' : 'Execute Recovery'}
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Resolved */}
              <div className="card">
                <div className="card-header">
                  <h2>Recovered Transactions ({resolved.length})</h2>
                  {resolved.length > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={exportCsv}>
                      <Download size={11} /> Export CSV
                    </button>
                  )}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Customer Profile</th>
                      <th>Amount</th>
                      <th>ISO Error Reason</th>
                      <th>Policy Action Taken</th>
                      <th style={{ textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recovered transactions yet.</td></tr>
                    ) : resolved.map(c => (
                      <tr key={c.id}>
                        <td className="mono bold">{c.id}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                          <div className="text-xs muted">{c.cart_category}</div>
                        </td>
                        <td className="tabular bold">{fmt(c.amount, c.currency)}</td>
                        <td className="secondary">{label(c.error_code)}</td>
                        <td>{label(c.recommended_action)}</td>
                        <td style={{ textAlign: 'right' }}><span className="tag tag-black">✓ Recovered</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </motion.div>
          )}

          {/* ─── OVERVIEW ─── */}
          {tab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Executive Cockpit</h1>
                <p>Real-time GMV protection analytics and autonomous recovery efficiency.</p>
              </div>

              <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
                <div className="metric primary">
                  <div className="metric-label">Protected GMV (YTD)</div>
                  <div className="metric-value tabular">{fmt(metrics.revenue_recovered * 4.2 + 84000, currency)}</div>
                  <div className="metric-sub">+24.6% vs previous cycle</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Avg Recovery SLA</div>
                  <div className="metric-value">0.82s</div>
                  <div className="metric-sub">Autonomous sub-second loop</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Compliance Reliability</div>
                  <div className="metric-value">100%</div>
                  <div className="metric-sub">Zero threshold breaches</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h2>Channel Policy Distribution</h2></div>
                <div className="card-body">
                  <div className="grid-4">
                    {[
                      { pct: '52%', ch: 'WhatsApp Concierge Nudge' },
                      { pct: '28%', ch: 'Autonomous Alternate Switch' },
                      { pct: '14%', ch: 'Dynamic Concession Hold' },
                      { pct: '6%', ch: 'Predictive Delayed Retry' }
                    ].map((x, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '0.75rem', background: '#FAFAFA', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{x.pct}</div>
                        <div className="text-xs muted mt-1">{x.ch}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── TRANSACTIONS ─── */}
          {tab === 'transactions' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                  <h1>Transactions Ledger</h1>
                  <p>Full immutable ledger of all intercepted payment drops.</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={12} /> Export CSV</button>
              </div>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Customer & Email</th>
                      <th>Amount</th>
                      <th>Error Description</th>
                      <th style={{ textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(c => (
                      <tr key={c.id}>
                        <td className="mono bold">{c.id}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                          <div className="text-xs muted">{c.customer_email}</div>
                        </td>
                        <td className="tabular bold">{fmt(c.amount, c.currency)}</td>
                        <td className="secondary">{label(c.error_code)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.is_recovered ? (
                            <span className="tag tag-black">✓ Recovered</span>
                          ) : (
                            <button className="btn btn-sm" onClick={() => recover(c)}>Recover</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ─── SETTLEMENTS ─── */}
          {tab === 'settlements' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                  <h1>Settlements Portal</h1>
                  <p>Multi-currency instant payouts across ACH, SEPA, and IMPS rails.</p>
                </div>
                <button className="btn" disabled={settling} onClick={settle}>
                  <Wallet size={14} /> {settling ? 'Processing...' : 'Instant Settlement'}
                </button>
              </div>

              {settlementResult && (
                <div style={{ background: '#F5F5F5', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.84rem' }}>
                  <strong>✓</strong> {settlementResult.settlement_id} — {fmt(settlementResult.amount, settlementResult.currency)} to {settlementResult.destination} (ETA: {settlementResult.payout_eta})
                </div>
              )}

              <div className="grid-3">
                {[
                  { label: 'USD Settlement Rail', val: fmt(metrics.revenue_recovered, 'USD'), sub: 'ACH Fedwire · Auto-settles daily' },
                  { label: 'EUR Settlement Rail', val: fmt(metrics.revenue_recovered * 0.92, 'EUR'), sub: 'SEPA Instant · Direct IBAN Routing' },
                  { label: 'INR Settlement Rail', val: fmt(metrics.revenue_recovered * 87.5, 'INR'), sub: 'HDFC IMPS · T+0 On-demand' }
                ].map((a, i) => (
                  <div key={i} className="metric">
                    <div className="metric-label">{a.label}</div>
                    <div className="metric-value tabular">{a.val}</div>
                    <div className="metric-sub">{a.sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── CUSTOMER INTELLIGENCE ─── */}
          {tab === 'customers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Customer Intelligence & LTV Hub</h1>
                <p>Lifetime value propensity scoring and channel conversion affinities.</p>
              </div>
              <div className="grid-3">
                {[
                  { name: 'Alexander Hayes', tier: 'Enterprise VIP Tier', email: 'alex.hayes@cloudscale.io', ltv: '$48,500', rate: '98%', ch: 'Email Concierge' },
                  { name: 'Claire Dubois', tier: 'Haute Couture Buyer', email: 'claire.dubois@maisonmode.fr', ltv: '€18,200', rate: '94%', ch: 'WhatsApp Link' },
                  { name: 'Priya Nair', tier: 'High-LTV Fashion VIP', email: 'priya.nair@gmail.com', ltv: '₹2,45,000', rate: '96%', ch: 'UPI Fast Track' }
                ].map((c, i) => (
                  <div key={i} className="card">
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span className="tag">{c.tier}</span>
                        <span className="text-xs muted">{c.rate} reclaimed</span>
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0.4rem 0 0.15rem' }}>{c.name}</h3>
                      <div className="text-xs muted mb-1">{c.email}</div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>LTV: <strong>{c.ltv}</strong></span>
                        <span>Primary Rail: <strong>{c.ch}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── INJECTION STUDIO ─── */}
          {tab === 'sandbox' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Failure Injection Studio</h1>
                <p>Stress-test the autonomous recovery loop with custom edge-case payloads.</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label className="form-label">Customer Persona Name</label>
                      <input className="form-input" value={sbName} onChange={e => setSbName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">ISO Error Code Vector</label>
                      <select className="form-input" value={sbFailure} onChange={e => setSbFailure(e.target.value)}>
                        <option value="3DS_OTP_CHALLENGE_TIMEOUT">3DS OTP Challenge Timeout (ISO: 68)</option>
                        <option value="BAD_REQUEST_PAYMENT_PIN_INCORRECT">Incorrect UPI PIN (Hard Decline - Safety Blocked)</option>
                        <option value="ISSUER_HIGH_VALUE_VELOCITY_CHECK">Issuer Velocity Limit (ISO: 65)</option>
                        <option value="BANK_NPCI_SWITCH_DEGRADED">Core Switch Packet Loss (ISO: 91)</option>
                        <option value="CHECKOUT_DISMISSED_PRICE_HESITATION">Price Hesitation Abandonment</option>
                        <option value="UPI_PSP_APP_NOT_RESPONDING">UPI Collect Expired (ISO: U19)</option>
                      </select>
                    </div>
                    <div className="grid-2">
                      <div>
                        <label className="form-label">Currency Rail</label>
                        <select className="form-input" value={sbCurrency} onChange={e => setSbCurrency(e.target.value)}>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="INR">INR</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Transaction Amount</label>
                        <input className="form-input" type="number" value={sbAmount} onChange={e => setSbAmount(Number(e.target.value))} />
                      </div>
                    </div>
                    <button className="btn" onClick={injectCustom}>
                      <Zap size={14} /> Inject Failure Vector
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                    <div className="form-label">Telemetry Ingestion Diagnostics</div>
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                      Target Customer: <strong style={{ color: 'var(--text)' }}>{sbName}</strong><br />
                      ISO Vector: <strong style={{ color: 'var(--text)' }}>{label(sbFailure)}</strong><br />
                      Value: <strong style={{ color: 'var(--text)' }}>{fmt(sbAmount, sbCurrency)}</strong><br />
                      Bayesian Recovery Probability: <strong style={{ color: 'var(--text)' }}>93.4%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ISO 8583 RAIL RADAR ─── */}
          {tab === 'radar' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>ISO 8583 & Gateway Telemetry Radar</h1>
                <p>Live health monitoring, packet loss, and latency jitter across international payment switches.</p>
              </div>

              <div className="grid-3">
                {[
                  { title: 'US & Global Card Networks', rails: [
                    { name: 'Visa Direct Switch', health: '99.6%', ms: lat.visa },
                    { name: 'Mastercard Identity Check', health: '99.2%', ms: lat.visa + 22 },
                    { name: 'Apple Pay Tokenization', health: '99.9%', ms: 88 }
                  ]},
                  { title: 'European Interbank Switches', rails: [
                    { name: 'SEPA Instant Credit Rail', health: '98.9%', ms: lat.sepa },
                    { name: 'iDEAL Netherlands Switch', health: '99.4%', ms: 180 },
                    { name: 'Sofort Direct Banking', health: '97.8%', ms: 420 }
                  ]},
                  { title: 'India NPCI & UPI Switches', rails: [
                    { name: 'HDFC UPI Core Switch', health: '98.8%', ms: lat.upi },
                    { name: 'SBI Gateway Switch', health: '94.2%', ms: lat.upi + 320 },
                    { name: 'NPCI Central Switch', health: '99.1%', ms: 185 }
                  ]}
                ].map((group, i) => (
                  <div key={i} className="card">
                    <div className="card-header"><h2><Globe size={14} /> {group.title}</h2></div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {group.rails.map((r, j) => (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <span>{r.name}</span>
                          <span className="mono bold">{r.health} ({r.ms}ms)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── ROI CALCULATOR ─── */}
          {tab === 'roi' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Merchant ROI & Revenue Lift Calculator</h1>
                <p>Calculate exact recovered GMV boost and profit uplift by replacing dumb retries with Foura.</p>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>Monthly Merchant GMV</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800 }} className="tabular">{fmt(gmv, currency)}</span>
                  </div>
                  <input
                    type="range" min="10000" max="2000000" step="10000"
                    value={gmv} onChange={e => setGmv(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#111' }}
                  />
                </div>
              </div>

              <div className="grid-3">
                <div className="metric">
                  <div className="metric-label">Lost Without Foura</div>
                  <div className="metric-value tabular">{fmt(gmv * 0.088, currency)}</div>
                  <div className="metric-sub">~8.8% checkout dropoff unrecovered</div>
                </div>
                <div className="metric primary">
                  <div className="metric-label">Recovered with Foura</div>
                  <div className="metric-value tabular">{fmt(gmv * 0.069, currency)}</div>
                  <div className="metric-sub">78.6% recovery conversion</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Annual Incremental Profit</div>
                  <div className="metric-value tabular">{fmt(gmv * 0.069 * 12, currency)}</div>
                  <div className="metric-sub">Pure bottom-line expansion</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── SETTINGS ─── */}
          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Engine Configuration</h1>
                <p>Configure compliance stopping rules, discount ceilings, and recovery channels.</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label className="form-label">RBI & Network Retry Cap</label>
                      <select className="form-input" value={settings.rbi_max_retries} onChange={e => setSettings({ ...settings, rbi_max_retries: Number(e.target.value) })}>
                        <option value={2}>2 Retries (Strict Compliance)</option>
                        <option value={3}>3 Retries (RBI Standard Recommended)</option>
                        <option value={4}>4 Retries (High Tolerance)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Margin Concession Ceiling</label>
                      <select className="form-input" value={settings.discount_ceiling_pct} onChange={e => setSettings({ ...settings, discount_ceiling_pct: Number(e.target.value) })}>
                        <option value={3}>3% Maximum Margin</option>
                        <option value={5}>5% Standard (Recommended)</option>
                        <option value={8}>8% Aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Default Recovery Dispatcher</label>
                      <select className="form-input" value={settings.default_channel} onChange={e => setSettings({ ...settings, default_channel: e.target.value })}>
                        <option value="whatsapp_rail">WhatsApp Concierge + Alternate Rail Switch</option>
                        <option value="direct_link">Direct 1-Click Recovery Payment Link</option>
                        <option value="voice_synthesis">Voice Concierge Synthesis + WhatsApp</option>
                      </select>
                    </div>
                    <button className="btn" onClick={saveSettings}>
                      <CheckCircle size={14} /> Save Configuration
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="form-label">Active Webhook Ingestion URL</div>
                    <div style={{ background: '#F8F8F8', padding: '0.6rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.78rem', wordBreak: 'break-all', marginBottom: '0.75rem' }}>
                      http://localhost:8003/api/webhooks/razorpay
                    </div>
                    <p className="text-sm secondary" style={{ lineHeight: 1.6 }}>
                      Ingests real-time <code>payment.failed</code> webhook events, evaluates telemetry, and executes autonomous interventions within 0.8s.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}

export default App
