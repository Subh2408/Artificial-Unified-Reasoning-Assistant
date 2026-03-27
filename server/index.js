require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')

const { readFile, writeFile, readArray, writeArray } = require('./lib/storage')

const app     = express()
const PORT    = process.env.PORT || 3001
const API_KEY = process.env.ANTHROPIC_API_KEY

if (!API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not set in .env')
  process.exit(1)
}

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// ── Basic authentication (disabled if AUTH_PASS not set) ────────────────────
const AUTH_USER = process.env.AUTH_USER || 'aura'
const AUTH_PASS = process.env.AUTH_PASS

if (AUTH_PASS) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next()
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="AURA"')
      return res.status(401).send('Authentication required')
    }
    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':')
    if (user !== AUTH_USER || pass !== AUTH_PASS) {
      res.set('WWW-Authenticate', 'Basic realm="AURA"')
      return res.status(401).send('Invalid credentials')
    }
    next()
  })
}

// ── Anthropic proxy ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.body || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: 'messages must be an array' })
  }
  const { system, messages, maxTokens = 1000 } = req.body
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system, messages }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('Anthropic error:', data)
      return res.status(response.status).json({ error: data.error?.message || 'API error' })
    }
    res.json({ text: data.content?.[0]?.text || '' })
  } catch (err) {
    console.error('Proxy error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// ── Saved briefs ──────────────────────────────────────────────────────────────
app.get('/api/saved', (req, res) => { res.json(readArray('saved_briefs')) })

app.post('/api/saved', (req, res) => {
  const briefs = readArray('saved_briefs')
  const entry  = { id: Date.now(), ...req.body }
  briefs.unshift(entry)
  writeArray('saved_briefs', briefs.slice(0, 50))
  res.json(entry)
})

app.delete('/api/saved/:id', (req, res) => {
  writeArray('saved_briefs', readArray('saved_briefs').filter(b => String(b.id) !== req.params.id))
  res.json({ ok: true })
})

// ── Chat history ──────────────────────────────────────────────────────────────
app.get('/api/chat-history/:chatKey', (req, res) => {
  const store = readFile('chat_history')
  const messages = store[req.params.chatKey]
  if (!messages) return res.status(404).json({ messages: [] })
  res.json({ messages })
})

app.post('/api/chat-history/:chatKey', (req, res) => {
  if (!req.body || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: 'messages must be an array' })
  }
  const store = readFile('chat_history')
  store[req.params.chatKey] = req.body.messages
  writeFile('chat_history', store)
  res.json({ ok: true })
})

app.delete('/api/chat-history/:chatKey', (req, res) => {
  const store = readFile('chat_history')
  delete store[req.params.chatKey]
  writeFile('chat_history', store)
  res.json({ ok: true })
})

// ── Department actions ────────────────────────────────────────────────────────
app.get('/api/actions/:sitId', (req, res) => {
  const { dept, type } = req.query
  const store = readFile('dept_actions')
  const payload = store[`${req.params.sitId}_${dept}_${type}`]
  if (!payload) return res.status(404).json({ payload: null })
  res.json({ payload })
})

app.post('/api/actions/:sitId', (req, res) => {
  if (!req.body || !req.body.deptKey || !req.body.actionType) {
    return res.status(400).json({ error: 'deptKey and actionType are required' })
  }
  const { deptKey, actionType, payload } = req.body
  const store = readFile('dept_actions')
  store[`${req.params.sitId}_${deptKey}_${actionType}`] = payload
  writeFile('dept_actions', store)
  res.json({ ok: true })
})

// ── Portfolio threshold evaluation ──────────────────────────────────────────

app.get('/api/threshold-alerts/:situationId/:deptKey', (req, res) => {
  const store = readFile('threshold_alerts')
  const key = `${req.params.situationId}_${req.params.deptKey}`
  const entry = store[key]
  if (!entry) return res.status(404).json({ error: 'Not yet evaluated' })
  res.json(entry)
})

app.post('/api/evaluate-thresholds', async (req, res) => {
  const { situationId, deptKey, title, severity, summary, affectedLines, geography, deptBrief } = req.body || {}
  if (!situationId || !deptKey) return res.status(400).json({ error: 'situationId and deptKey required' })

  try {
    const fs = require('fs')
    const paramsPath = path.join(__dirname, 'data', 'parameters.json')
    const allParams = JSON.parse(fs.readFileSync(paramsPath, 'utf8'))
    const deptParams = allParams[deptKey]
    if (!deptParams || !deptParams.limits) return res.json({ alerts: [] })

    const lines = affectedLines || []
    const relevant = deptParams.limits.filter((lim) =>
      lim.lines.includes('All Lines') || lim.lines.some((l) => lines.includes(l))
    )
    if (!relevant.length) return res.json({ alerts: [] })

    const systemPrompt = `You are a senior risk analyst at Qatar's largest insurance company.
Today is 10 March 2026. All monetary values are in QAR.

You are evaluating whether a situation is likely to breach portfolio thresholds. You do not have exact loss figures — use the situation severity, affected lines, and geography to estimate directional impact. Be conservative but realistic. This is Qatar's largest insurer with significant Gulf exposure.

For each threshold provided, assess the estimated impact level:
- none: situation unlikely to affect this threshold materially
- low: situation may consume up to 20% of the limit
- medium: situation may consume 20-50% of the limit
- caution: situation likely to consume 50-80% of the limit
- alert: situation likely to consume 80-95% of the limit
- breach: situation likely to exceed the limit

Return ONLY valid JSON — an array with one object per threshold:
[
  {
    "id": "threshold_id",
    "impact_level": "none|low|medium|caution|alert|breach",
    "confidence": 0-100,
    "reasoning": "Maximum 15 words. Specific to this situation. No monetary values.",
    "action": "One sentence. What the department should do now."
  }
]`

    const userContent = `Situation: ${title} — Severity: ${severity}
Geography: ${geography}
Summary: ${summary}
Department brief: ${deptBrief}

Evaluate these thresholds:
${JSON.stringify(relevant.map(l => ({ id: l.id, label: l.label, lines: l.lines, unit: l.unit })))}`

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: systemPrompt, messages: [{ role: 'user', content: userContent }] }),
    })

    const data = await apiRes.json()
    if (!apiRes.ok) throw new Error(`Claude API ${apiRes.status}: ${data.error?.message}`)

    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')
    const evaluated = JSON.parse(jsonMatch[0])

    // Map impact levels to fixed percentages (server-side, not from Claude)
    const PCT_MAP = { low: 15, medium: 35, caution: 65, alert: 85, breach: 100 }
    function scrubAmounts(text) {
      return (text || '')
        .replace(/QAR\s?[\d,\.]+\s?[BMKbmk]?/g, 'the limit')
        .replace(/[\d,]{6,}/g, 'the limit')
        .replace(/\d+(\.\d+)?\s?(million|billion|trillion)/gi, 'the limit')
    }

    const labelMap = Object.fromEntries(relevant.map(l => [l.id, l.label]))
    const alerts = evaluated
      .filter((e) => e.impact_level && e.impact_level !== 'none')
      .map((e) => ({
        ...e,
        label: labelMap[e.id] || e.id,
        estimated_pct: PCT_MAP[e.impact_level] || 0,
        reasoning: scrubAmounts(e.reasoning),
        action: scrubAmounts(e.action),
      }))

    // Cache
    const store = readFile('threshold_alerts')
    store[`${situationId}_${deptKey}`] = { alerts, evaluatedAt: new Date().toISOString() }
    writeFile('threshold_alerts', store)

    res.json({ alerts })
  } catch (err) {
    console.error('[thresholds] evaluation failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Situation evolution history ──────────────────────────────────────────────

app.get('/api/situation-history/:sitId', (req, res) => {
  const store = readFile('situation_history')
  const history = store[req.params.sitId]
  res.json(history || [])
})

// ── Regulation department implications (AI-generated, cached) ────────────────

app.get('/api/reg-implications/:regId', (req, res) => {
  const store = readFile('reg_implications')
  const entry = store[req.params.regId]
  if (!entry) return res.status(404).json({ error: 'Not yet generated' })
  res.json(entry)
})

app.post('/api/generate-reg-implications', async (req, res) => {
  const { regId, title, jurisdiction, regulator, effectiveDate, changeType, summary, claimsImplication, complianceImplication } = req.body || {}
  if (!regId || !title) return res.status(400).json({ error: 'regId and title are required' })

  try {
    const systemPrompt = `You are a senior insurance professional at a Lloyd's-regulated insurer in Qatar with 20 years of experience. Today: 10 March 2026.

Generate implications for three departments given a regulatory update.

STRICT LENGTH RULES — no exceptions:
- Maximum 2 sentences per department
- Each sentence under 20 words
- Direct, specific, actionable only

STRICT ACCURACY RULES:
- Federal laws, consolidated frameworks, and solvency regulations affect ALL departments — never return "no material implication" for these
- Only return "No material implication for this department." for regulations genuinely narrow in scope (e.g. a motor-only rule has no reinsurance implication)
- When in doubt, provide a brief implication

Return ONLY valid JSON, no markdown:
{
  "underwritingImplication": "...",
  "reinsuranceImplication": "...",
  "investmentsImplication": "..."
}`

    const userContent = `Regulation: ${title}
Jurisdiction: ${jurisdiction}
Regulator: ${regulator}
Effective: ${effectiveDate}
Type: ${changeType}
Summary: ${summary}
Claims implication: ${claimsImplication}
Compliance implication: ${complianceImplication}`

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await apiRes.json()
    if (!apiRes.ok) throw new Error(`Claude API ${apiRes.status}: ${data.error?.message}`)

    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Claude response')
    const generated = JSON.parse(jsonMatch[0])

    const fullImplications = {
      claimsImplication: claimsImplication || '',
      complianceImplication: complianceImplication || '',
      underwritingImplication: generated.underwritingImplication || '',
      reinsuranceImplication: generated.reinsuranceImplication || '',
      investmentsImplication: generated.investmentsImplication || '',
      generatedAt: new Date().toISOString(),
    }

    const store = readFile('reg_implications')
    store[regId] = fullImplications
    writeFile('reg_implications', store)

    res.json(fullImplications)
  } catch (err) {
    console.error('[reg-implications] generation failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Regulatory query history ──────────────────────────────────────────────────
app.get('/api/reg-query', (req, res) => {
  const store = readFile('reg_query')
  if (!store.messages) return res.status(404).json({ messages: [] })
  res.json({ messages: store.messages })
})

app.post('/api/reg-query', (req, res) => {
  if (!req.body || !Array.isArray(req.body.messages)) {
    return res.status(400).json({ error: 'messages must be an array' })
  }
  writeFile('reg_query', { messages: req.body.messages })
  res.json({ ok: true })
})

// ── Live feed endpoints ───────────────────────────────────────────────────────

app.get('/api/feed/signals', (req, res) => {
  res.json(readArray('signals'))
})

app.get('/api/feed/regulations', (req, res) => {
  res.json(readArray('regulations'))
})

// Returns AI-generated situations if available, otherwise seed situations
app.get('/api/feed/situations', (req, res) => {
  const generated = readArray('situations_generated')
  if (generated.length) return res.json(generated)
  // Fallback to seed situations with overrides
  const seed      = readArray('situations_seed')
  const overrides = readFile('situation_overrides')
  const result    = seed.map((s) => overrides[s.id] || s)
  res.json(result)
})

app.get('/api/feed/ticker', async (req, res) => {
  try {
    const { fetchTickerHeadlines } = require('./ingest/sources/tickerRss')
    const items = await fetchTickerHeadlines()
    if (items.length) return res.json({ items })
  } catch (err) {
    console.warn('[ticker] RSS fetch failed, falling back to signals:', err.message)
  }
  // Fallback: use signal titles
  const signals = readArray('signals')
  const items = signals.slice(0, 8).map((s) => s.title).filter(Boolean)
  res.json({ items })
})

app.get('/api/feed/status', (req, res) => {
  const signals     = readArray('signals')
  const regulations = readArray('regulations')
  const hashes      = readArray('seen_hashes')
  const log         = readArray('ingest_log')
  res.json({
    liveSignals:     signals.length,
    liveRegulations: regulations.length,
    seenHashes:      hashes.length,
    lastRuns:        log.slice(0, 5),
    timestamp:       new Date().toISOString(),
  })
})

// ── On-demand situation re-synthesis ─────────────────────────────────────────

app.post('/api/situations/:id/synthesize', async (req, res) => {
  try {
    const { synthesizeOne } = require('./ingest/synthesize')
    const updated = await synthesizeOne(req.params.id)
    if (!updated) return res.status(404).json({ error: 'No situation found or no live signals to synthesize from' })
    res.json({ ok: true, situation: updated })
  } catch (err) {
    console.error('[synthesize] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Generate situations from signal clusters ────────────────────────────────
app.post('/api/situations/generate', async (req, res) => {
  try {
    const { generateSituations } = require('./ingest/situationGenerator')
    const result = await generateSituations()
    if (!result) return res.json({ ok: false, message: 'Skipped — cooldown active or insufficient signals' })
    res.json({ ok: true, count: result.length, situations: result.map(s => ({ id: s.id, title: s.title, severity: s.severity })) })
  } catch (err) {
    console.error('[generate] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Dev: manual ingest trigger ────────────────────────────────────────────────
app.post('/api/ingest/run', async (req, res) => {
  try {
    const { runAll } = require('./ingest/scheduler')
    runAll().catch(err => console.error('[ingest] manual run error:', err.message))
    res.json({ ok: true, message: 'Ingest triggered — check server logs' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Force ingest + generation (bypasses cooldown) ────────────────────────────
app.post('/api/ingest/trigger', async (req, res) => {
  try {
    const { forceGenerate } = require('./ingest/scheduler')
    forceGenerate().catch(err => console.error('[ingest] force trigger error:', err.message))
    res.json({ ok: true, message: 'Force ingest + generation triggered (cooldown bypassed)' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Audit endpoints ──────────────────────────────────────────────────────────

app.get('/api/audit/generation-log', (req, res) => {
  res.json(readArray('generation_log').slice(0, 20))
})

app.get('/api/audit/generation-log/:runId', (req, res) => {
  const log = readArray('generation_log')
  const entry = log.find(e => e.runId === req.params.runId)
  if (!entry) return res.status(404).json({ error: 'Run not found' })
  res.json(entry)
})

app.get('/api/audit/signal/:signalId', (req, res) => {
  const store = readFile('signal_disposition')
  const entry = store[req.params.signalId]
  if (!entry) return res.status(404).json({ error: 'Signal disposition not found' })
  res.json(entry)
})

app.get('/api/audit/situation/:sitId/history', (req, res) => {
  const store = readFile('situation_history')
  const history = store[req.params.sitId]
  if (!history) return res.status(404).json({ error: 'Situation history not found' })
  res.json(history)
})

app.get('/api/signals/pending', (req, res) => {
  const signals = readArray('signals')
  res.json(signals.filter(s => s.disposition === 'pending' || !s.disposition))
})

app.get('/api/signals/flagged', (req, res) => {
  const signals = readArray('signals')
  res.json(signals.filter(s => s.disposition === 'flagged'))
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// ── Production static file serving ──────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`\nAURA backend running at http://localhost:${PORT}`)
  console.log('API key loaded successfully')
})

// ── Start ingest scheduler ────────────────────────────────────────────────────
require('./ingest/scheduler')
