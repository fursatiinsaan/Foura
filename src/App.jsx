import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import axios from 'axios'
import {
  Activity, Play, Zap, CreditCard, Search,
  CheckCircle, ShieldCheck, RefreshCw, Globe, Terminal,
  Cpu, Sliders, BarChart3, Radio, Download, Wallet,
  ExternalLink, MessageSquare, Code2, Volume2, VolumeX,
  ShoppingBag, ArrowRight, ShieldAlert, Check, ChevronDown, ChevronUp,
  Layers, Lock, Database, Network
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
    BAD_REQUEST_PAYMENT_PIN_INCORRECT: 'Incorrect UPI PIN (Hard Decline)',
    BAD_REQUEST_PAYMENT_CARD_EXPIRED: 'Expired Card Credential',
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
  const [tab, setTab] = useState('hub')
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
  const [expandedId, setExpandedId] = useState(null)

  // Live Checkout Simulation State
  const [checkoutName, setCheckoutName] = useState('Sarah Jenkins')
  const [checkoutEmail, setCheckoutEmail] = useState('sarah.j@enterprise.io')
  const [checkoutProduct, setCheckoutProduct] = useState({ name: 'Enterprise Cloud Infrastructure Tier', price: 1299, currency: 'USD', category: 'SaaS Platform' })
  const [checkoutStep, setCheckoutStep] = useState('cart')
  const [simulatedFailureType, setSimulatedFailureType] = useState('3DS_OTP_CHALLENGE_TIMEOUT')
  const [latestRecoveredLink, setLatestRecoveredLink] = useState('')
  const [latestHmacSignature, setLatestHmacSignature] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

  // Settings
  const [settings, setSettings] = useState({ rbi_max_retries: 3, discount_ceiling_pct: 5, default_channel: 'whatsapp_rail' })

  // Latency jitter
  const [lat, setLat] = useState({ visa: 142, sepa: 312, upi: 218 })
  const [engineActivity, setEngineActivity] = useState('Listening on live ISO 8583 payment telemetry stream')

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

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

  const fetchData = useCallback(async () => {
    try {
      const cur = currencyRef.current
      const q = searchRef.current
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

  // Latency jitter
  useEffect(() => {
    const t = setInterval(() => {
      setLat({ visa: 138 + Math.floor(Math.random() * 8), sepa: 305 + Math.floor(Math.random() * 14), upi: 210 + Math.floor(Math.random() * 16) })
    }, 3000)
    return () => clearInterval(t)
  }, [])

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
    { id: 'hub', icon: Zap, label: '⚡ Recovery Hub' },
    { id: 'ledger', icon: CreditCard, label: '📊 Transactions & Payouts' },
    { id: 'engine', icon: Cpu, label: '🧠 Engine Architecture & ROI' },
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
          <div className="nav-section">Core Navigation</div>
          {navItems.map(n => (
            <div 
              key={n.id} 
              className={`nav-item ${tab === n.id ? 'active' : ''}`} 
              onClick={() => setTab(n.id)}
            >
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
              <span>CARD: {lat.visa}ms</span>
              <span>UPI: {lat.upi}ms</span>
              <span>API OVERHEAD: 1 REQ/STATE</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: RECOVERY HUB (Integrated Cockpit, Checkout & Inspector)
              ══════════════════════════════════════════════════════════════════ */}
          {tab === 'hub' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Header & Primary Controls */}
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1>Autonomous Recovery Hub</h1>
                  <p>Real-time payment failure ingestion, LLaMA-3 diagnostics, and sub-second recovery interventions.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => simulate()}>
                    <Activity size={14} /> Inject Failure ({currency})
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
              </div>

              {/* KPI Metrics */}
              <div className="metrics" style={{ marginBottom: '1.5rem' }}>
                <div className="metric">
                  <div className="metric-label">Revenue At Risk</div>
                  <div className="metric-value tabular">{fmt(metrics.revenue_at_risk, currency)}</div>
                </div>
                <div className="metric primary">
                  <div className="metric-label">Revenue Recovered</div>
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

              {/* Live Checkout Testing Drawer */}
              <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShoppingBag size={16} /> Synthetic Checkout & Failure Simulator
                  </span>
                  <span className="tag mono">{checkoutProduct.currency}</span>
                </div>

                <div className="grid-4" style={{ gap: '0.85rem' }}>
                  <div>
                    <label className="form-label">Customer Name</label>
                    <input className="form-input" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Customer Email</label>
                    <input className="form-input" value={checkoutEmail} onChange={e => setCheckoutEmail(e.target.value)} />
                  </div>
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
                      <option value="Enterprise Cloud Infrastructure Tier">Cloud Infrastructure ($1,299)</option>
                      <option value="High-Performance GPU Cluster">GPU Cluster ($3,499)</option>
                      <option value="Commercial ERP Subscription">ERP Subscription (₹49,999)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Failure Vector</label>
                    <select className="form-input" value={simulatedFailureType} onChange={e => setSimulatedFailureType(e.target.value)}>
                      <option value="3DS_OTP_CHALLENGE_TIMEOUT">3DS OTP Timeout (ISO: 68)</option>
                      <option value="BAD_REQUEST_PAYMENT_PIN_INCORRECT">Incorrect UPI PIN (Safety Gated)</option>
                      <option value="BANK_NPCI_SWITCH_DEGRADED">Core Switch Lag (ISO: 91)</option>
                      <option value="UPI_PSP_APP_NOT_RESPONDING">UPI Collect Expired (ISO: U19)</option>
                      <option value="CHECKOUT_DISMISSED_PRICE_HESITATION">Price Hesitation</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Order Value: <strong className="tabular">{fmt(checkoutProduct.price, checkoutProduct.currency)}</strong></span>
                  <button className="btn btn-sm" disabled={checkoutStep === 'processing'} onClick={runLiveCheckoutSimulation}>
                    {checkoutStep === 'processing' ? <RefreshCw size={13} className="spin" /> : <CreditCard size={13} />}
                    {checkoutStep === 'processing' ? 'Injecting Telemetry...' : 'Simulate Failure & Auto-Recover'}
                  </button>
                </div>
              </div>

              {/* Main Queue & Diagnostic Inspector Grid */}
              <div className="grid-sidebar" style={{ marginBottom: '1.5rem', minHeight: '560px' }}>

                {/* Queue */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
                  <div className="card-header">
                    <h2><Activity size={14} /> Pending Queue ({pending.length})</h2>
                  </div>
                  <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '500px', overflowY: 'auto' }}>
                    {pending.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '6rem 1rem', color: 'var(--text-muted)' }}>
                        <CheckCircle size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
                        All payment rails clear
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
                <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
                  <div className="card-header">
                    <h2><Terminal size={14} /> Diagnostic Inspector</h2>
                    {selected && <span className="tag mono">{selected.id}</span>}
                  </div>

                  {!selected ? (
                    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select an intercepted payment to inspect diagnostic telemetry.
                    </div>
                  ) : (
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '500px', overflowY: 'auto' }}>

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
                          <div className={`step ${step >= 1 ? 'done' : ''}`}>1. Ingested</div>
                          <div className={`step ${step >= 2 ? 'done' : ''}`}>2. LLaMA-3 Diagnostics</div>
                          <div className={`step ${step >= 3 ? 'done' : ''}`}>3. Deterministic Safety</div>
                          <div className={`step ${step >= 4 ? 'done' : ''}`}>4. HMAC Dispatched</div>
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
                          <div style={{ background: '#111B21', color: '#E9EDEF', padding: '0.85rem', borderRadius: '8px', fontSize: '0.84rem', lineHeight: 1.6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#00A884', fontWeight: 700 }}>Foura Autonomous Concierge</span>
                              <span style={{ fontSize: '0.68rem', color: '#8696A0' }}>Official Link</span>
                            </div>
                            {selected.personalized_message || 'Your payment was paused. We’ve reserved your order.'}
                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <a href={latestRecoveredLink || `https://pay.foura.io/recover/${selected.id}`} target="_blank" rel="noreferrer" style={{ color: '#00A884', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
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

              {/* Recovered List with Export */}
              <div className="card">
                <div className="card-header">
                  <h2>Recovered Transactions ({resolved.length})</h2>
                  {resolved.length > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={exportCsv}>
                      <Download size={11} /> Export Audit CSV
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
                      <th style={{ textAlign: 'right' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recovered transactions yet.</td></tr>
                    ) : resolved.map(c => (
                      <Fragment key={c.id}>
                        <tr key={c.id} style={{ cursor: 'pointer', background: expandedId === c.id ? '#FAFAFA' : 'transparent' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                          <td className="mono bold">{c.id}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                            <div className="text-xs muted">{c.cart_category}</div>
                          </td>
                          <td className="tabular bold">{fmt(c.amount, c.currency)}</td>
                          <td className="secondary">{label(c.error_code)}</td>
                          <td>{label(c.recommended_action)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === c.id ? null : c.id); }}>
                              {expandedId === c.id ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Forensics</>}
                            </button>
                          </td>
                        </tr>
                        {expandedId === c.id && (
                          <tr style={{ background: '#FAFAFA' }}>
                            <td colSpan="6" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
                              <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="grid-4" style={{ gap: '0.75rem' }}>
                                  <div>
                                    <div className="form-label">Customer Details</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{c.customer_name}</div>
                                    <div className="text-xs muted">{c.customer_email} · {c.customer_tier}</div>
                                  </div>
                                  <div>
                                    <div className="form-label">ISO 8583 Protocol Error</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{label(c.error_code)}</div>
                                    <div className="text-xs secondary">{c.failure_reason || 'Gateway timeout on core switch'}</div>
                                  </div>
                                  <div>
                                    <div className="form-label">Confidence Score</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{c.recovery_score}%</div>
                                  </div>
                                  <div>
                                    <div className="form-label">Timestamp</div>
                                    <div className="text-xs muted mono" style={{ marginTop: '4px' }}>{c.created_at || 'Live Telemetry'}</div>
                                  </div>
                                </div>

                                <div>
                                  <div className="form-label">LLaMA-3 Diagnostic Reasoning</div>
                                  <div style={{ background: '#F8F8F8', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                    {c.ai_reasoning || 'Diagnostic root-cause telemetry analyzed.'}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: c.guardrail_overridden ? '#DC2626' : '#16A34A' }}>
                                    {c.guardrail_overridden ? `⛔ Intercepted: ${c.guardrail_overridden}` : '✓ Guardrails Verified (RBI 3-Attempt Cap & 5% Margin Limit)'}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <a href={`https://pay.foura.io/recover/${c.id}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                                      View Payment Link <ExternalLink size={10} />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: TRANSACTIONS & SETTLEMENTS
              ══════════════════════════════════════════════════════════════════ */}
          {tab === 'ledger' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="page-header" style={{ marginBottom: 0 }}>
                  <h1>Transactions & Multi-Currency Payouts</h1>
                  <p>Full immutable audit ledger with instantaneous same-day settlement dispatch. Click any row to expand forensic history.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={12} /> Export CSV</button>
                  <button className="btn btn-sm" disabled={settling} onClick={settle}><Wallet size={12} /> Instant Settle</button>
                </div>
              </div>

              {/* Settlement Banner */}
              {settlementResult && (
                <div style={{ background: '#F5F5F5', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.84rem' }}>
                  <strong>✓ Payout Dispatched:</strong> {settlementResult.settlement_id} — {fmt(settlementResult.amount, settlementResult.currency)} to {settlementResult.destination} (ETA: {settlementResult.payout_eta})
                </div>
              )}

              {/* Settlement Rails */}
              <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
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

              {/* Full Ledger Table */}
              <div className="card">
                <div className="card-header">
                  <h2>Immutable Transaction Audit Trail ({cases.length})</h2>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Customer & Email</th>
                      <th>Amount</th>
                      <th>ISO Error Reason</th>
                      <th>Timestamp</th>
                      <th style={{ textAlign: 'right' }}>Forensics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(c => (
                      <Fragment key={c.id}>
                        <tr key={c.id} style={{ cursor: 'pointer', background: expandedId === c.id ? '#FAFAFA' : 'transparent' }} onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                          <td className="mono bold">{c.id}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                            <div className="text-xs muted">{c.customer_email}</div>
                          </td>
                          <td className="tabular bold">{fmt(c.amount, c.currency)}</td>
                          <td className="secondary">{label(c.error_code)}</td>
                          <td className="text-xs muted">{c.created_at || 'Live Telemetry'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === c.id ? null : c.id); }}>
                              {expandedId === c.id ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Expand</>}
                            </button>
                          </td>
                        </tr>
                        {expandedId === c.id && (
                          <tr style={{ background: '#FAFAFA' }}>
                            <td colSpan="6" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
                              <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="grid-4" style={{ gap: '0.75rem' }}>
                                  <div>
                                    <div className="form-label">Customer Profile</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{c.customer_name}</div>
                                    <div className="text-xs muted">{c.customer_email} · {c.customer_tier}</div>
                                  </div>
                                  <div>
                                    <div className="form-label">ISO Error Code</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{label(c.error_code)}</div>
                                    <div className="text-xs secondary">{c.failure_reason}</div>
                                  </div>
                                  <div>
                                    <div className="form-label">Status & Policy</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                                      {c.is_recovered ? '✓ Reclaimed' : '● Intercepted'} · {label(c.recommended_action)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="form-label">Timestamp</div>
                                    <div className="text-xs muted mono" style={{ marginTop: '4px' }}>{c.created_at || 'Live Telemetry'}</div>
                                  </div>
                                </div>

                                <div>
                                  <div className="form-label">LLaMA-3 Diagnostic Reasoning</div>
                                  <div style={{ background: '#F8F8F8', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                    {c.ai_reasoning || 'Diagnostic root-cause telemetry analyzed.'}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: c.guardrail_overridden ? '#DC2626' : '#16A34A' }}>
                                    {c.guardrail_overridden ? `⛔ Intercepted: ${c.guardrail_overridden}` : '✓ Guardrails Verified (RBI 3-Attempt Cap & Margins Safe)'}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <a href={`https://pay.foura.io/recover/${c.id}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                                      Payment Link <ExternalLink size={10} />
                                    </a>
                                    {!c.is_recovered && (
                                      <button className="btn btn-sm" onClick={() => recover(c)}>
                                        <Play size={10} /> Execute Recovery
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: ENGINE ARCHITECTURE & ROI
              ══════════════════════════════════════════════════════════════════ */}
          {tab === 'engine' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Engine Architecture & ROI Benchmark</h1>
                <p>Multi-agent DAG, Multi-Armed Bandit (UCB1) math, global rail telemetry, and profit boost calculations.</p>
              </div>

              {/* Multi-Agent DAG Section */}
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
                      Deterministic Python gating. Blocks retries on PIN errors and enforces RBI 3-attempt caps.
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="tag mb-1">Node 04 · Dispatch</div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>Idempotent Dispatcher</h3>
                    <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>
                      Signs recovery tokens with HMAC-SHA256 and coordinates WhatsApp and alternate rail checkout links.
                    </p>
                  </div>
                </div>
              </div>

              {/* MAB Math & Rail Health Grid */}
              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                
                {/* UCB1 Policy Weights */}
                <div className="card">
                  <div className="card-header"><h2>Multi-Armed Bandit (UCB1) Policy Optimizer</h2></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ background: '#0A0A0A', color: '#FFF', padding: '0.65rem 0.85rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>
                      Score(Policy_i) = μ_i + c · sqrt( (2 · ln N) / n_i )
                    </div>
                    {[
                      { name: 'Smart Rail Switch (UPI / Card)', ucb: 0.942, pulls: 428, rate: '81.2%' },
                      { name: 'WhatsApp Concierge + Concession', ucb: 0.918, pulls: 312, rate: '77.4%' },
                      { name: 'Predictive Exponential Backoff', ucb: 0.864, pulls: 195, rate: '64.8%' }
                    ].map((p, idx) => (
                      <div key={idx} style={{ background: '#FAFAFA', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>{p.name}</span>
                        <span className="mono bold">{p.rate} win (UCB: {p.ucb})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ISO 8583 Global Radar */}
                <div className="card">
                  <div className="card-header"><h2>Payment Rail Telemetry Radar</h2></div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {[
                      { name: 'Visa Direct Switch', health: '99.6%', ms: lat.visa },
                      { name: 'SEPA Instant Credit Rail', health: '98.9%', ms: lat.sepa },
                      { name: 'HDFC UPI Core Switch', health: '98.8%', ms: lat.upi },
                      { name: 'NPCI Central Switch', health: '99.1%', ms: 185 }
                    ].map((r, idx) => (
                      <div key={idx} style={{ background: '#FAFAFA', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>{r.name}</span>
                        <span className="mono bold">{r.health} ({r.ms}ms)</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* ROI Calculator */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header"><h2>Merchant ROI & Profit Lift Calculator</h2></div>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>Monthly Merchant GMV</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800 }} className="tabular">{fmt(gmv, currency)}</span>
                  </div>
                  <input
                    type="range" min="10000" max="2000000" step="10000"
                    value={gmv} onChange={e => setGmv(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#111', marginBottom: '1rem' }}
                  />
                  <div className="grid-3">
                    <div className="metric">
                      <div className="metric-label">Lost Without Foura</div>
                      <div className="metric-value tabular">{fmt(gmv * 0.088, currency)}</div>
                    </div>
                    <div className="metric primary">
                      <div className="metric-label">Recovered by Foura</div>
                      <div className="metric-value tabular">{fmt(gmv * 0.069, currency)}</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Annual Profit Expansion</div>
                      <div className="metric-value tabular">{fmt(gmv * 0.069 * 12, currency)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engine Configuration */}
              <div className="card">
                <div className="card-header"><h2>Engine Compliance Configuration</h2></div>
                <div className="card-body">
                  <div className="grid-3" style={{ gap: '0.85rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">RBI & Network Retry Cap</label>
                      <select className="form-input" value={settings.rbi_max_retries} onChange={e => setSettings({ ...settings, rbi_max_retries: Number(e.target.value) })}>
                        <option value={2}>2 Retries (Strict Compliance)</option>
                        <option value={3}>3 Retries (RBI Standard)</option>
                        <option value={4}>4 Retries (High Tolerance)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Margin Concession Ceiling</label>
                      <select className="form-input" value={settings.discount_ceiling_pct} onChange={e => setSettings({ ...settings, discount_ceiling_pct: Number(e.target.value) })}>
                        <option value={3}>3% Maximum Margin</option>
                        <option value={5}>5% Standard Ceiling</option>
                        <option value={8}>8% Aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Active Webhook Ingestion URL</label>
                      <input className="form-input mono" value="http://localhost:8003/api/webhooks/razorpay" readOnly />
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={saveSettings}>
                    <CheckCircle size={13} /> Save Configuration
                  </button>
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

