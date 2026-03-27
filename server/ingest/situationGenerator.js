/**
 * AI-powered situation generator — clusters live signals into coherent insurance situations.
 * Uses Claude Sonnet for high-quality reasoning about signal relationships.
 * Cooldown: 20-minute minimum, overridden by flagged signals or pending threshold.
 */
require('dotenv').config()
const { readArray, writeArray, readFile, writeFile } = require('../lib/storage')
const { appendSituationHistory } = require('./situationHistory')
const { writeDisposition } = require('./pipeline')

const GEO_COORDS = {
  'hormuz': { lat: 26.5, lng: 56.3 }, 'persian gulf': { lat: 26.5, lng: 52.0 },
  'arabian gulf': { lat: 26.0, lng: 52.0 }, 'gulf': { lat: 25.3, lng: 51.5 },
  'qatar': { lat: 25.3, lng: 51.5 }, 'doha': { lat: 25.3, lng: 51.5 },
  'red sea': { lat: 14.0, lng: 43.0 }, 'houthi': { lat: 15.4, lng: 44.2 },
  'aden': { lat: 12.8, lng: 45.0 }, 'bab el-mandeb': { lat: 12.6, lng: 43.3 },
  'iran': { lat: 32.4, lng: 53.7 }, 'tehran': { lat: 35.7, lng: 51.4 },
  'ukraine': { lat: 49.0, lng: 32.0 }, 'kyiv': { lat: 50.4, lng: 30.5 },
  'russia': { lat: 55.8, lng: 37.6 }, 'moscow': { lat: 55.8, lng: 37.6 },
  'uae': { lat: 24.5, lng: 54.4 }, 'dubai': { lat: 25.2, lng: 55.3 },
  'abu dhabi': { lat: 24.5, lng: 54.4 },
  'saudi': { lat: 24.7, lng: 46.7 }, 'riyadh': { lat: 24.7, lng: 46.7 },
  'sudan': { lat: 19.6, lng: 37.2 }, 'port sudan': { lat: 19.6, lng: 37.2 },
  'darfur': { lat: 13.5, lng: 25.0 },
  'washington': { lat: 38.9, lng: -77.0 }, 'united states': { lat: 38.9, lng: -77.0 },
  'london': { lat: 51.5, lng: -0.1 }, 'lloyd': { lat: 51.5, lng: -0.1 },
  'china': { lat: 39.9, lng: 116.4 }, 'beijing': { lat: 39.9, lng: 116.4 },
  'israel': { lat: 31.8, lng: 35.2 }, 'bahrain': { lat: 26.2, lng: 50.6 },
  'kuwait': { lat: 29.4, lng: 47.9 }, 'oman': { lat: 23.6, lng: 58.5 },
  'global': { lat: 25.3, lng: 51.5 },
}

function geocodeFromText(text) {
  const lower = (text || '').toLowerCase()
  for (const [keyword, coords] of Object.entries(GEO_COORDS)) {
    if (lower.includes(keyword)) return coords
  }
  return { lat: 25.3, lng: 51.5 }
}

// ── Cooldown logic ──

const MIN_COOLDOWN = 20 * 60 * 1000       // 20 minutes hard minimum
const SCHEDULED_COOLDOWN = 2 * 60 * 60 * 1000 // 2 hours for scheduled runs
const MIN_SIGNALS = 10
const MAX_GEN_LOG = 200

function shouldGenerate(signals, forceBypass) {
  if (forceBypass) return { run: true, trigger: 'manual', triggerDetail: 'manual API trigger with cooldown bypass' }

  const meta = readFile('situation_gen_meta')
  const elapsed = Date.now() - new Date(meta.lastRun || 0).getTime()

  if (elapsed < MIN_COOLDOWN) {
    return { run: false, trigger: 'cooldown', triggerDetail: `${Math.round((MIN_COOLDOWN - elapsed) / 1000)}s remaining` }
  }

  if (signals.length < MIN_SIGNALS) {
    return { run: false, trigger: 'insufficient', triggerDetail: `${signals.length} signals < ${MIN_SIGNALS} minimum` }
  }

  const pending = signals.filter(s => s.disposition === 'pending' || !s.disposition).length
  const flagged = signals.filter(s => s.disposition === 'flagged').length

  if (flagged >= 1) return { run: true, trigger: 'flagged', triggerDetail: `${flagged} flagged signal(s) (score ≥ 15)` }
  if (pending >= 10) return { run: true, trigger: 'threshold', triggerDetail: `${pending} pending signals ≥ 10` }
  if (elapsed >= SCHEDULED_COOLDOWN) return { run: true, trigger: 'scheduled', triggerDetail: `${Math.round(elapsed / 60000)}min since last run` }

  return { run: false, trigger: 'below_threshold', triggerDetail: `${pending} pending, ${flagged} flagged — waiting` }
}

// ── Generation log ──

function appendGenerationLog(entry) {
  const log = readArray('generation_log')
  log.unshift(entry)
  writeArray('generation_log', log.slice(0, MAX_GEN_LOG))
}

// ── Main generator ──

const EVENT_TYPES = [
  'MARINE_WAR_RISK', 'MARINE_CASUALTY', 'MARINE_CARGO', 'SANCTIONS',
  'GEOPOLITICAL', 'REGULATORY', 'NAT_CAT', 'ENERGY_CASUALTY', 'CYBER',
  'AVIATION', 'PROPERTY', 'ENGINEERING', 'LIABILITY', 'CREDIT_POLITICAL',
  'MARKET_STRESS', 'ILS_CAT_BOND',
]

async function generateSituations(forceBypass = false) {
  const signals = readArray('signals')
  const decision = shouldGenerate(signals, forceBypass)

  if (!decision.run) {
    console.log(`[situationGen] skipping — ${decision.trigger}: ${decision.triggerDetail}`)
    return null
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY')

  const startTime = Date.now()
  const runId = `gen_${new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14)}`
  const pending = signals.filter(s => s.disposition === 'pending' || !s.disposition).length
  const flagged = signals.filter(s => s.disposition === 'flagged').length

  const recentSignals = signals.slice(0, 30)
  const signalText = recentSignals.map((s, i) => (
    `[${i}] id=${s.id} | source=${s.source} | score=${s.score || s.relevanceScore || 0} | ${s.title} | tags: ${(s.tags || []).slice(0, 3).join(', ')} | geo: ${s.geography || 'Global'} | disposition: ${s.disposition || 'unknown'}`
  )).join('\n')

  const systemPrompt = `You are a senior insurance intelligence analyst at a Lloyd's-regulated insurer in Qatar. Your job is to analyze incoming intelligence signals and cluster them into coherent "situations" — emerging risk scenarios that require coordinated response across departments.

Today's date: ${new Date().toISOString().split('T')[0]}.

You MUST return ONLY valid JSON — no markdown fences, no commentary, no explanation.`

  const userPrompt = `Analyze these ${recentSignals.length} intelligence signals and cluster them into 3-6 coherent insurance situations. Each situation groups signals that relate to the same emerging risk scenario.

SIGNALS:
${signalText}

Return a JSON array of situation objects. Each must have ALL these fields:
{
  "id": "sit_gen_1" (sequential),
  "title": "Short situation title (5-8 words)",
  "subtitle": "One-sentence tactical summary",
  "summary": "2-3 sentence executive summary of the situation and its insurance implications",
  "severity": "ACTIVE" or "CRITICAL" or "ELEVATED" or "WATCH",
  "isLive": true,
  "category": ["Affected insurance line 1", "Line 2", ...],
  "geography": "Region",
  "coordinates": {"lat": number, "lng": number},
  "confidence": 50-99 (integer),
  "signalIds": ["id1", "id2", ...] (IDs of signals in this cluster),
  "sources": ["SOURCE1", "SOURCE2", ...],
  "updated": "${new Date().toISOString()}",
  "regJurisdictions": [] or ["QAT", "UAE", "KSA", etc.],
  "eventType": one of [${EVENT_TYPES.map(e => `"${e}"`).join(', ')}],
  "clusterReason": "One sentence explaining why these signals cluster together",
  "scores": {
    "risk_compliance": 1-10,
    "claims": 1-10,
    "underwriting": 1-10,
    "reinsurance": 1-10,
    "investments": 1-10
  },
  "interpretations": {
    "risk_compliance": { "headline": "...", "detail": "2-3 sentences max. First: what is happening. Second: department consideration. Third (optional): most urgent action. No bullets, no headers.", "affectedLines": [...], "actions": ["action1", "action2", "action3"] },
    "claims": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "underwriting": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "reinsurance": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "investments": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] }
  }
}

Requirements:
- Generate exactly 4 situations
- Cluster by thematic similarity: same conflict, same market event, same regulatory area
- Keep detail to exactly 2-3 sentences. First sentence states the event. Second states department impact. Optional third states most urgent action. No bullets, no headers.
- Keep actions to exactly 3 per department
- Severity: ACTIVE = requires immediate action, CRITICAL = high impact imminent, ELEVATED = significant risk, WATCH = monitor
- Department scores reflect relevance (10 = highest priority)
- Every situation MUST include "coordinates" with lat/lng for the primary geographic location
- Every situation MUST include "eventType" from the allowed list
- Every situation MUST include "clusterReason" explaining signal grouping
- Signals that don't fit any cluster can be excluded`

  console.log(`[situationGen] calling Claude to cluster signals — trigger: ${decision.trigger} (${decision.triggerDetail})`)

  let situations, tokensUsed = 0
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${data.error?.message}`)
    tokensUsed = data.usage?.output_tokens || 0

    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in Claude response')

    let jsonStr = jsonMatch[0]
    try {
      situations = JSON.parse(jsonStr)
    } catch (e1) {
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1').replace(/\n/g, ' ')
      const openBraces = (jsonStr.match(/\{/g) || []).length
      const closeBraces = (jsonStr.match(/\}/g) || []).length
      const openBrackets = (jsonStr.match(/\[/g) || []).length
      const closeBrackets = (jsonStr.match(/\]/g) || []).length
      for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}'
      for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']'
      situations = JSON.parse(jsonStr)
    }
  } catch (err) {
    appendGenerationLog({
      runId, timestamp: new Date().toISOString(),
      trigger: decision.trigger, triggerDetail: decision.triggerDetail,
      signalsConsidered: recentSignals.length, signalsPending: pending, signalsFlagged: flagged,
      situationsCreated: 0, situationsUpdated: 0, situationsUnchanged: 0,
      signalsAssigned: 0, signalsStillPending: pending,
      tokensUsed, durationMs: Date.now() - startTime, error: err.message,
    })
    throw err
  }

  if (!Array.isArray(situations) || situations.length < 1) {
    throw new Error(`Expected array of situations, got ${typeof situations}`)
  }

  // Build signal lookup for topSignals
  const signalLookup = {}
  for (const sig of recentSignals) signalLookup[sig.id] = sig

  const now = new Date().toISOString()
  const validated = situations.map((sit, i) => ({
    id: sit.id || `sit_gen_${i + 1}`,
    title: sit.title || `Situation ${i + 1}`,
    subtitle: sit.subtitle || '',
    summary: sit.summary || '',
    severity: ['ACTIVE', 'CRITICAL', 'ELEVATED', 'WATCH'].includes(sit.severity) ? sit.severity : 'ELEVATED',
    isLive: true,
    archived: false,
    category: Array.isArray(sit.category) ? sit.category : [],
    geography: sit.geography || 'Global',
    coordinates: sit.coordinates && typeof sit.coordinates.lat === 'number' ? sit.coordinates : null,
    confidence: typeof sit.confidence === 'number' ? sit.confidence : 75,
    signalIds: Array.isArray(sit.signalIds) ? sit.signalIds : [],
    signalCount: Array.isArray(sit.signalIds) ? sit.signalIds.length : 0,
    sources: Array.isArray(sit.sources) ? sit.sources : [],
    updated: sit.updated || now,
    createdAt: now,
    lastSignalAt: now,
    regJurisdictions: Array.isArray(sit.regJurisdictions) ? sit.regJurisdictions : [],
    eventType: EVENT_TYPES.includes(sit.eventType) ? sit.eventType : null,
    clusterReason: sit.clusterReason || '',
    generationRunId: runId,
    topSignals: (Array.isArray(sit.signalIds) ? sit.signalIds : []).slice(0, 5).map(id => {
      const sig = signalLookup[id]
      return sig ? { id, score: sig.score || sig.relevanceScore || 0, title: sig.title, source: sig.source } : null
    }).filter(Boolean),
    scores: {
      risk_compliance: sit.scores?.risk_compliance || 5,
      claims: sit.scores?.claims || 5,
      underwriting: sit.scores?.underwriting || 5,
      reinsurance: sit.scores?.reinsurance || 5,
      investments: sit.scores?.investments || 5,
    },
    interpretations: validateInterpretations(sit.interpretations),
  }))

  // Geocode situations from geography text
  for (const sit of validated) {
    if (!sit.coordinates) {
      sit.coordinates = geocodeFromText(sit.geography + ' ' + sit.title)
    }
  }

  // Store generated situations
  writeArray('situations_generated', validated)

  // Track evolution history for each situation
  for (const sit of validated) {
    appendSituationHistory(sit, 'created')
  }

  // Update signals with situation assignments and dispositions
  const signalMap = {}
  for (const sit of validated) {
    for (const sigId of sit.signalIds) {
      signalMap[sigId] = sit.id
    }
  }

  let signalsAssigned = 0
  const updatedSignals = readArray('signals').map((sig) => {
    if (signalMap[sig.id]) {
      signalsAssigned++
      writeDisposition(sig.id, sig.score || sig.relevanceScore || 0, 'assigned', signalMap[sig.id], runId)
      return { ...sig, situationId: signalMap[sig.id], disposition: 'assigned', dispositionAt: now, generationRunId: runId }
    }
    return sig
  })
  writeArray('signals', updatedSignals)

  // Update metadata
  writeFile('situation_gen_meta', {
    lastRun: now,
    situationCount: validated.length,
    signalsProcessed: recentSignals.length,
    runId,
  })

  // Write generation log
  appendGenerationLog({
    runId, timestamp: now,
    trigger: decision.trigger, triggerDetail: decision.triggerDetail,
    signalsConsidered: recentSignals.length, signalsPending: pending, signalsFlagged: flagged,
    situationsCreated: validated.length, situationsUpdated: 0, situationsUnchanged: 0,
    signalsAssigned, signalsStillPending: pending - signalsAssigned,
    tokensUsed, durationMs: Date.now() - startTime, error: null,
  })

  console.log(`[situationGen] generated ${validated.length} situations from ${recentSignals.length} signals (${signalsAssigned} assigned) — runId: ${runId}`)
  return validated
}

function validateInterpretations(interps) {
  const depts = ['risk_compliance', 'claims', 'underwriting', 'reinsurance', 'investments']
  const result = {}
  for (const dept of depts) {
    const d = interps?.[dept] || {}
    result[dept] = {
      headline: d.headline || 'Analysis pending',
      detail: d.detail || 'Detailed analysis will be available after review.',
      affectedLines: Array.isArray(d.affectedLines) ? d.affectedLines : [],
      actions: Array.isArray(d.actions) ? d.actions.slice(0, 5) : ['Monitor situation for developments'],
    }
  }
  return result
}

module.exports = { generateSituations, shouldGenerate }
