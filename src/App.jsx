import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import {
  Activity, Play, Zap, Home, CreditCard, Users, Settings, Search,
  CheckCircle, ShieldCheck, RefreshCw, Sparkles, Globe, Terminal,
  Cpu, Sliders, BarChart3, Clock, Radio, Download, Wallet,
  ExternalLink, MessageSquare, Mail, Code2
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
    PREDICTIVE_RETRY: 'Predictive Retry',
    SOFT_NUDGE_WHATSAPP: 'WhatsApp Recovery',
    INTENT_SWITCH_FALLBACK: 'Payment Switch',
    HARD_FAIL_ABANDON: 'Max Retries Reached',
    '3DS_OTP_CHALLENGE_TIMEOUT': '3DS Timeout',
    '3DS2_FRICTIONLESS_REJECTED': '3DS2 Declined',
    ISSUER_HIGH_VALUE_VELOCITY_CHECK: 'Velocity Check',
    BANK_NPCI_SWITCH_DEGRADED: 'Switch Degraded',
    UPI_PSP_APP_NOT_RESPONDING: 'UPI Expired',
    GATEWAY_TIMEOUT_NPCI_PEAK: 'Gateway Timeout',
    GATEWAY_TIMEOUT_PEAK_TRAFFIC: 'Gateway Timeout',
    CHECKOUT_DISMISSED_PRICE_HESITATION: 'Price Hesitation',
    INSUFFICIENT_FUNDS_BALANCE_LOW: 'Low Balance',
    NETBANKING_2FA_SESSION_EXPIRED: '2FA Expired',
    UNKNOWN_ERROR: 'Processing Error',
    RETRY_CAP_EXCEEDED: 'Retry Cap Hit',
    LOW_CONFIDENCE: 'Low Confidence'
  }
  return map[text] || text.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function App() {
  const [tab, setTab] = useState('deck')
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

  // Sandbox
  const [sbName, setSbName] = useState('Alexander Hayes')
  const [sbFailure, setSbFailure] = useState('3DS_OTP_CHALLENGE_TIMEOUT')
  const [sbCurrency, setSbCurrency] = useState('USD')
  const [sbAmount, setSbAmount] = useState(299)

  // Settings
  const [settings, setSettings] = useState({ rbi_max_retries: 3, discount_ceiling_pct: 5, default_channel: 'multi_channel' })

  // Latency jitter
  const [lat, setLat] = useState({ visa: 142, sepa: 312, upi: 218 })

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

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

  const fetchData = useCallback(async () => {
    try {
      const cur = currencyRef.current
      const q = searchRef.current
      const [m, c, s] = await Promise.all([
        axios.get(`${API}/metrics?display_currency=${cur}`),
        axios.get(`${API}/recoveries?search=${q}`),
        axios.get(`${API}/settings`)
      ])
      setMetrics(m.data)
      setCases(c.data)
      if (s.data) setSettings(s.data)

      const sel = selectedRef.current
      if (sel) {
        const u = c.data.find(x => x.id === sel.id)
        if (u) setSelected(u)
      } else if (c.data.length > 0) {
        setSelected(c.data[0])
      }

      if (autoPilotRef.current && !runningRef.current) {
        const p = c.data.find(x => !x.is_recovered)
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
        console.log('[WS] Connected')
        fetchData()
      }

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data)
          if (event === 'new_case') {
            notify(`New drop: ${data.customer_name} — ${fmt(data.amount, data.currency)}`)
          } else if (event === 'recovered') {
            notify(`Recovered: ${data.id}`)
          } else if (event === 'batch_recovered') {
            notify(`Batch recovered ${data.count} transactions`)
          }
          fetchData()
        } catch (err) {
          console.error('[WS] Parse error', err)
        }
      }

      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 2s...')
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
    await axios.post(`${API}/simulate-failure?currency=${cur || currency}`)
    await fetchData()
    notify('Payment failure simulated')
  }

  const recover = async (c) => {
    setSelected(c); setRunning(true)
    setStep(1); await new Promise(r => setTimeout(r, 500))
    setStep(2); await new Promise(r => setTimeout(r, 600))
    setStep(3); await new Promise(r => setTimeout(r, 500))
    setStep(4); await new Promise(r => setTimeout(r, 500))
    await axios.post(`${API}/recoveries/${c.id}/trigger-action`)
    await fetchData()
    setRunning(false)
    notify(`Recovered ${fmt(c.amount, c.currency)}`)
  }

  const batchRecover = async () => {
    setRunning(true)
    const res = await axios.post(`${API}/recoveries/batch-trigger`)
    await fetchData()
    setRunning(false)
    notify(`Batch recovered ${res.data.recovered_count || 'all'} transactions`)
  }

  const injectCustom = async () => {
    await axios.post(`${API}/simulate-failure`, {
      customer_name: sbName, amount: Math.round(sbAmount * 100), currency: sbCurrency,
      error_code: sbFailure, error_desc: sbFailure.replace(/_/g, ' ')
    })
    await fetchData()
    setTab('deck')
    notify('Custom failure injected')
  }

  const settle = async () => {
    setSettling(true)
    const res = await axios.post(`${API}/settlements/instant`, { amount: metrics.revenue_recovered, currency })
    setSettlementResult(res.data)
    setSettling(false)
    notify('Settlement initiated')
  }

  const exportCsv = () => {
    const rows = [
      ['ID', 'Customer', 'Currency', 'Amount', 'Error', 'Action', 'Status'],
      ...resolved.map(c => [c.id, c.customer_name, c.currency, c.amount, c.error_code, c.recommended_action, 'RECOVERED'])
    ]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'foura_audit.csv'; a.click()
    notify('CSV exported')
  }

  const saveSettings = async () => {
    await axios.post(`${API}/settings`, settings)
    notify('Settings saved')
  }

  const pending = cases.filter(c => !c.is_recovered)
  const resolved = cases.filter(c => c.is_recovered)

  const navItems = [
    { id: 'deck', icon: Zap, label: 'Recovery Deck' },
    { id: 'overview', icon: Home, label: 'Overview' },
    { id: 'transactions', icon: CreditCard, label: 'Transactions' },
    { id: 'settlements', icon: Wallet, label: 'Settlements' },
    { id: 'customers', icon: Users, label: 'Customers' },
  ]

  const toolItems = [
    { id: 'pipeline', icon: Cpu, label: 'AI Pipeline' },
    { id: 'sandbox', icon: Sliders, label: 'Injection Studio' },
    { id: 'radar', icon: Radio, label: 'Rail Radar' },
    { id: 'roi', icon: BarChart3, label: 'ROI Calculator' },
    { id: 'settings', icon: Settings, label: 'Settings' },
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
            <span>AI Revenue Recovery</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <n.icon size={16} /> {n.label}
            </div>
          ))}

          <div className="nav-section">Tools</div>

          {toolItems.map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              <n.icon size={16} /> {n.label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-search">
            <Search size={16} />
            <input placeholder="Search orders, customers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="topbar-controls">
            <div className="chip">
              <span className="dot" />
              Live
            </div>
            <select className="currency-select" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
            </select>
            <div className="avatar">F</div>
          </div>
        </header>

        <div className="content">

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
                  <Activity size={14} /> Simulate Drop
                </button>
                {pending.length > 0 && (
                  <button className="btn-outline btn" onClick={batchRecover}>
                    <Zap size={14} /> Recover All ({pending.length})
                  </button>
                )}
                <button
                  className={`btn ${autoPilot ? '' : 'btn-outline'}`}
                  onClick={() => { setAutoPilot(!autoPilot); notify(autoPilot ? 'Auto-pilot off' : 'Auto-pilot on') }}
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
                    <h2><Activity size={14} /> Pending ({pending.length})</h2>
                  </div>
                  <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '560px', overflowY: 'auto', flex: 1 }}>
                    {pending.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <CheckCircle size={28} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
                        All clear
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
                    <h2><Terminal size={14} /> Inspector</h2>
                    {selected && <span className="tag mono">{selected.id}</span>}
                  </div>

                  {!selected ? (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Select a transaction to inspect.
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
                        <div className="form-label">Root Cause</div>
                        <div style={{ background: '#F8F8F8', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', lineHeight: 1.6 }}>
                          {selected.ai_reasoning || 'Analyzing transaction telemetry...'}
                        </div>
                      </div>

                      {/* Strategy + Guardrails */}
                      <div className="grid-2">
                        <div>
                          <div className="form-label">Strategy</div>
                          <div style={{ fontWeight: 700 }}>{label(selected.recommended_action)}</div>
                        </div>
                        <div>
                          <div className="form-label">Guardrails</div>
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
                            {['whatsapp', 'email', 'json'].map(m => (
                              <button key={m} className={`tag ${previewMode === m ? 'tag-black' : ''}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => setPreviewMode(m)}>
                                {m === 'whatsapp' && <MessageSquare size={10} />}
                                {m === 'email' && <Mail size={10} />}
                                {m === 'json' && <Code2 size={10} />}
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {previewMode === 'whatsapp' && (
                          <div style={{ background: '#F5F5F5', padding: '0.85rem', borderRadius: '8px', fontSize: '0.84rem', lineHeight: 1.6 }}>
                            {selected.personalized_message || 'Your payment was paused. We\u2019ve reserved your order.'}
                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid #E8E8E8', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <a href="#" style={{ color: 'var(--black)', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                Complete Checkout <ExternalLink size={10} />
                              </a>
                              <span className="text-xs muted">✓✓</span>
                            </div>
                          </div>
                        )}

                        {previewMode === 'email' && (
                          <div style={{ background: '#F8F8F8', padding: '0.85rem', borderRadius: '8px', fontSize: '0.84rem', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                            <div className="text-xs muted" style={{ marginBottom: '0.4rem' }}>
                              To: <strong style={{ color: 'var(--text)' }}>{selected.customer_email}</strong>
                            </div>
                            {selected.personalized_message || 'Your payment was paused.'}
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
                          {selected.is_recovered ? '✓ Recovered' : running ? 'Processing...' : '● Pending'}
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
                  <h2>Recovered ({resolved.length})</h2>
                  {resolved.length > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={exportCsv}>
                      <Download size={11} /> Export
                    </button>
                  )}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Error</th>
                      <th>Action</th>
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
                <h1>Overview</h1>
                <p>Revenue protection at a glance.</p>
              </div>

              <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
                <div className="metric primary">
                  <div className="metric-label">Protected GMV</div>
                  <div className="metric-value tabular">{fmt(metrics.revenue_recovered * 4.2 + 84000, currency)}</div>
                  <div className="metric-sub">+24.6% vs previous cycle</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Avg Recovery SLA</div>
                  <div className="metric-value">0.82s</div>
                  <div className="metric-sub">Autonomous loop</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Compliance</div>
                  <div className="metric-value">100%</div>
                  <div className="metric-sub">Zero threshold breaches</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h2>Channel Distribution</h2></div>
                <div className="card-body">
                  <div className="grid-4">
                    {[
                      { pct: '52%', ch: 'WhatsApp Nudge' },
                      { pct: '28%', ch: 'Payment Switch' },
                      { pct: '14%', ch: 'Concession Hold' },
                      { pct: '6%', ch: 'Delayed Retry' }
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
                  <h1>Transactions</h1>
                  <p>Full ledger of all intercepted payments.</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={12} /> Export</button>
              </div>
              <div className="card">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Error</th>
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
                  <h1>Settlements</h1>
                  <p>Multi-currency instant payouts.</p>
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
                  { label: 'USD Account', val: fmt(metrics.revenue_recovered, 'USD'), sub: 'ACH · Daily auto-settle' },
                  { label: 'EUR Account', val: fmt(metrics.revenue_recovered * 0.92, 'EUR'), sub: 'SEPA Instant · IBAN' },
                  { label: 'INR Account', val: fmt(metrics.revenue_recovered * 87.5, 'INR'), sub: 'IMPS · T+0 On-demand' }
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

          {/* ─── CUSTOMERS ─── */}
          {tab === 'customers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Customer Intelligence</h1>
                <p>Lifetime value and recovery profiles.</p>
              </div>
              <div className="grid-3">
                {[
                  { name: 'Alexander Hayes', tier: 'Enterprise VIP', email: 'alex.hayes@cloudscale.io', ltv: '$48,500', rate: '98%', ch: 'Email' },
                  { name: 'Claire Dubois', tier: 'Premium Buyer', email: 'claire.dubois@maisonmode.fr', ltv: '€18,200', rate: '94%', ch: 'WhatsApp' },
                  { name: 'Priya Nair', tier: 'High-LTV VIP', email: 'priya.nair@gmail.com', ltv: '₹2,45,000', rate: '96%', ch: 'UPI' }
                ].map((c, i) => (
                  <div key={i} className="card">
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span className="tag">{c.tier}</span>
                        <span className="text-xs muted">{c.rate} recovered</span>
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0.4rem 0 0.15rem' }}>{c.name}</h3>
                      <div className="text-xs muted mb-1">{c.email}</div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>LTV: <strong>{c.ltv}</strong></span>
                        <span>Channel: <strong>{c.ch}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── AI PIPELINE ─── */}
          {tab === 'pipeline' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>AI Decision Pipeline</h1>
                <p>How Foura pairs LLMs with deterministic guardrails.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                  { n: '01', title: 'Ingestion', desc: 'Captures payment.failed webhooks across Card, UPI, SEPA.' },
                  { n: '02', title: 'Classifier', desc: 'Evaluates switch lag, 3DS challenge rates, acquirer health.' },
                  { n: '03', title: 'LLM Analysis', desc: 'LLaMA-3 root-cause reasoning and personalized messaging.', active: true },
                  { n: '04', title: 'Guardrails', desc: 'Hard-coded retry cap, discount ceiling, spam prevention.' },
                  { n: '05', title: 'Dispatch', desc: 'Payment link generation + multi-channel delivery.' }
                ].map((s, i) => (
                  <div key={i} className="card" style={{ border: s.active ? '1.5px solid var(--black)' : undefined }}>
                    <div className="card-body">
                      <div className="tag mb-1">{s.n}</div>
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0.35rem 0 0.25rem' }}>{s.title}</h3>
                      <p className="text-xs secondary" style={{ lineHeight: 1.5 }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="form-label">Why This Architecture Works</div>
                  <p style={{ fontSize: '0.86rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    Standard LLM agents fail in payments because hallucinations cause financial liability. Foura enforces an <strong>AI Sandwich Architecture</strong>: telemetry is classified at high speed, analyzed by LLaMA-3 for nuanced reasoning, then gated by deterministic Python safety circuits before any payment link or message is dispatched.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── INJECTION STUDIO ─── */}
          {tab === 'sandbox' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Injection Studio</h1>
                <p>Stress-test the recovery loop with custom edge cases.</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label className="form-label">Customer Name</label>
                      <input className="form-input" value={sbName} onChange={e => setSbName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Error Code</label>
                      <select className="form-input" value={sbFailure} onChange={e => setSbFailure(e.target.value)}>
                        <option value="3DS_OTP_CHALLENGE_TIMEOUT">3DS OTP Timeout</option>
                        <option value="ISSUER_HIGH_VALUE_VELOCITY_CHECK">Velocity Check</option>
                        <option value="BANK_NPCI_SWITCH_DEGRADED">Switch Degraded</option>
                        <option value="CHECKOUT_DISMISSED_PRICE_HESITATION">Price Hesitation</option>
                        <option value="UPI_PSP_APP_NOT_RESPONDING">UPI Expired</option>
                      </select>
                    </div>
                    <div className="grid-2">
                      <div>
                        <label className="form-label">Currency</label>
                        <select className="form-input" value={sbCurrency} onChange={e => setSbCurrency(e.target.value)}>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="INR">INR</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Amount</label>
                        <input className="form-input" type="number" value={sbAmount} onChange={e => setSbAmount(Number(e.target.value))} />
                      </div>
                    </div>
                    <button className="btn" onClick={injectCustom}>
                      <Zap size={14} /> Inject Failure
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                    <div className="form-label">Preview</div>
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                      Customer: <strong style={{ color: 'var(--text)' }}>{sbName}</strong><br />
                      Error: <strong style={{ color: 'var(--text)' }}>{label(sbFailure)}</strong><br />
                      Amount: <strong style={{ color: 'var(--text)' }}>{fmt(sbAmount, sbCurrency)}</strong><br />
                      Predicted Recovery: <strong style={{ color: 'var(--text)' }}>93.4%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── RAIL RADAR ─── */}
          {tab === 'radar' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Global Rail Radar</h1>
                <p>Live payment rail health and latency.</p>
              </div>

              <div className="grid-3">
                {[
                  { title: 'US & Global Cards', rails: [
                    { name: 'Visa Direct', health: '99.6%', ms: lat.visa },
                    { name: 'Mastercard', health: '99.2%', ms: lat.visa + 22 },
                    { name: 'Apple Pay', health: '99.9%', ms: 88 }
                  ]},
                  { title: 'European Rails', rails: [
                    { name: 'SEPA Instant', health: '98.9%', ms: lat.sepa },
                    { name: 'iDEAL', health: '99.4%', ms: 180 },
                    { name: 'Sofort', health: '97.8%', ms: 420 }
                  ]},
                  { title: 'India UPI & NPCI', rails: [
                    { name: 'HDFC UPI', health: '98.8%', ms: lat.upi },
                    { name: 'SBI Gateway', health: '94.2%', ms: lat.upi + 320 },
                    { name: 'NPCI Switch', health: '99.1%', ms: 185 }
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
                <h1>ROI Calculator</h1>
                <p>See how much revenue Foura can recover from your checkout drops.</p>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700 }}>Monthly GMV</span>
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
                  <div className="metric-sub">~8.8% checkout dropoff</div>
                </div>
                <div className="metric primary">
                  <div className="metric-label">Recovered by Foura</div>
                  <div className="metric-value tabular">{fmt(gmv * 0.069, currency)}</div>
                  <div className="metric-sub">78.6% recovery rate</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Annual Extra Profit</div>
                  <div className="metric-value tabular">{fmt(gmv * 0.069 * 12, currency)}</div>
                  <div className="metric-sub">Pure incremental margin</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── SETTINGS ─── */}
          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="page-header">
                <h1>Settings</h1>
                <p>Configure compliance rules and recovery channels.</p>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label className="form-label">Retry Cap</label>
                      <select className="form-input" value={settings.rbi_max_retries} onChange={e => setSettings({ ...settings, rbi_max_retries: Number(e.target.value) })}>
                        <option value={2}>2 Retries (Strict)</option>
                        <option value={3}>3 Retries (Recommended)</option>
                        <option value={4}>4 Retries (High Tolerance)</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Concession Ceiling</label>
                      <select className="form-input" value={settings.discount_ceiling_pct} onChange={e => setSettings({ ...settings, discount_ceiling_pct: Number(e.target.value) })}>
                        <option value={3}>3% Maximum</option>
                        <option value={5}>5% Standard</option>
                        <option value={8}>8% Aggressive</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Default Channel</label>
                      <select className="form-input" value={settings.default_channel} onChange={e => setSettings({ ...settings, default_channel: e.target.value })}>
                        <option value="multi_channel">Multi-Channel</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                    <button className="btn" onClick={saveSettings}>
                      <CheckCircle size={14} /> Save
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className="form-label">Webhook Endpoint</div>
                    <div style={{ background: '#F8F8F8', padding: '0.6rem', borderRadius: '6px', fontFamily: 'var(--mono)', fontSize: '0.78rem', wordBreak: 'break-all', marginBottom: '0.75rem' }}>
                      http://localhost:8003/api/webhooks/razorpay
                    </div>
                    <p className="text-sm secondary" style={{ lineHeight: 1.6 }}>
                      Ingests real-time payment.failed webhook events and executes autonomous recovery within 0.8s.
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
