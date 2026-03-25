/**
 * AI-powered situation generator — clusters live signals into coherent insurance situations.
 * Uses Claude Sonnet for high-quality reasoning about signal relationships.
 */
require('dotenv').config()
const { readArray, writeArray, readFile, writeFile } = require('../lib/storage')
const { appendSituationHistory } = require('./situationHistory')

// Geography keyword → coordinates lookup (no API calls needed)
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
  'us ': { lat: 38.9, lng: -77.0 },
  'london': { lat: 51.5, lng: -0.1 }, 'lloyd': { lat: 51.5, lng: -0.1 },
  'china': { lat: 39.9, lng: 116.4 }, 'beijing': { lat: 39.9, lng: 116.4 },
  'israel': { lat: 31.8, lng: 35.2 }, 'bahrain': { lat: 26.2, lng: 50.6 },
  'kuwait': { lat: 29.4, lng: 47.9 }, 'oman': { lat: 23.6, lng: 58.5 },
  'global': { lat: 25.3, lng: 51.5 }, // default to Doha
}

function geocodeFromText(text) {
  const lower = (text || '').toLowerCase()
  for (const [keyword, coords] of Object.entries(GEO_COORDS)) {
    if (lower.includes(keyword)) return coords
  }
  return { lat: 25.3, lng: 51.5 } // fallback: Doha
}

const MIN_SIGNALS = 10
const GENERATION_COOLDOWN = 2 * 60 * 60 * 1000 // 2 hours

async function generateSituations() {
  const signals = readArray('signals')
  if (signals.length < MIN_SIGNALS) {
    console.log(`[situationGen] only ${signals.length} signals — need ${MIN_SIGNALS}+ to generate`)
    return null
  }

  // Check cooldown
  const meta = readFile('situation_gen_meta')
  if (meta.lastRun && Date.now() - new Date(meta.lastRun).getTime() < GENERATION_COOLDOWN) {
    console.log('[situationGen] cooldown active — skipping')
    return null
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY')

  // Prepare signal summaries for Claude (limit to 30 most recent for manageable JSON output)
  const recentSignals = signals.slice(0, 30)
  const signalText = recentSignals.map((s, i) => (
    `[${i}] id=${s.id} | source=${s.source} | ${s.title} | tags: ${(s.tags || []).slice(0, 3).join(', ')} | geo: ${s.geography || 'Global'}`
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
  "coordinates": {"lat": number, "lng": number} (best representative point for the geography),
  "confidence": 50-99 (integer),
  "signalIds": ["id1", "id2", ...] (IDs of signals in this cluster),
  "sources": ["SOURCE1", "SOURCE2", ...],
  "updated": "${new Date().toISOString()}",
  "regJurisdictions": [] or ["QAT", "UAE", "KSA", etc.],
  "scores": {
    "risk_compliance": 1-10,
    "claims": 1-10,
    "underwriting": 1-10,
    "reinsurance": 1-10,
    "investments": 1-10
  },
  "interpretations": {
    "risk_compliance": { "headline": "...", "detail": "2-3 sentences", "affectedLines": [...], "actions": ["action1", "action2", "action3"] },
    "claims": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "underwriting": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "reinsurance": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] },
    "investments": { "headline": "...", "detail": "...", "affectedLines": [...], "actions": [...] }
  }
}

Requirements:
- Generate exactly 4 situations
- Cluster by thematic similarity: same conflict, same market event, same regulatory area
- Keep detail fields SHORT (1-2 sentences max)
- Keep actions to exactly 3 per department
- Severity: ACTIVE = requires immediate action, CRITICAL = high impact imminent, ELEVATED = significant risk, WATCH = monitor
- Department scores reflect relevance (10 = highest priority)
- IMPORTANT: Every situation MUST include "coordinates" with lat/lng for the primary geographic location. Use the best representative point for the geography field. Example: Strait of Hormuz = {"lat":26.5,"lng":56.3}
- Signals that don't fit any cluster can be excluded`

  console.log('[situationGen] calling Claude to cluster signals into situations...')

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

  const text = data.content?.[0]?.text || ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('No JSON array in Claude response')

  // Attempt JSON parse with repair for common issues
  let jsonStr = jsonMatch[0]
  let situations
  try {
    situations = JSON.parse(jsonStr)
  } catch (e1) {
    // Try fixing trailing commas and truncated JSON
    jsonStr = jsonStr
      .replace(/,\s*([\]}])/g, '$1')   // remove trailing commas
      .replace(/\n/g, ' ')              // flatten newlines in strings
    // If JSON is truncated, try to close it
    const openBrackets = (jsonStr.match(/\[/g) || []).length
    const closeBrackets = (jsonStr.match(/\]/g) || []).length
    const openBraces = (jsonStr.match(/\{/g) || []).length
    const closeBraces = (jsonStr.match(/\}/g) || []).length
    for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}'
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']'
    try {
      situations = JSON.parse(jsonStr)
    } catch (e2) {
      console.error('[situationGen] JSON repair failed, raw length:', text.length)
      throw new Error('Failed to parse Claude response as JSON after repair attempt')
    }
  }

  if (!Array.isArray(situations) || situations.length < 1) {
    throw new Error(`Expected array of situations, got ${typeof situations}`)
  }

  // Validate and clean up each situation
  const validated = situations.map((sit, i) => ({
    id: sit.id || `sit_gen_${i + 1}`,
    title: sit.title || `Situation ${i + 1}`,
    subtitle: sit.subtitle || '',
    summary: sit.summary || '',
    severity: ['ACTIVE', 'CRITICAL', 'ELEVATED', 'WATCH'].includes(sit.severity) ? sit.severity : 'ELEVATED',
    isLive: true,
    category: Array.isArray(sit.category) ? sit.category : [],
    geography: sit.geography || 'Global',
    coordinates: sit.coordinates && typeof sit.coordinates.lat === 'number' ? sit.coordinates : null,
    confidence: typeof sit.confidence === 'number' ? sit.confidence : 75,
    signalIds: Array.isArray(sit.signalIds) ? sit.signalIds : [],
    sources: Array.isArray(sit.sources) ? sit.sources : [],
    updated: sit.updated || new Date().toISOString(),
    regJurisdictions: Array.isArray(sit.regJurisdictions) ? sit.regJurisdictions : [],
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
    appendSituationHistory(sit)
  }

  // Update signals with their situation assignments
  const signalMap = {}
  for (const sit of validated) {
    for (const sigId of sit.signalIds) {
      signalMap[sigId] = sit.id
    }
  }

  const updatedSignals = readArray('signals').map((sig) => {
    if (signalMap[sig.id]) {
      return { ...sig, situationId: signalMap[sig.id] }
    }
    return sig
  })
  writeArray('signals', updatedSignals)

  // Update metadata
  writeFile('situation_gen_meta', {
    lastRun: new Date().toISOString(),
    situationCount: validated.length,
    signalsProcessed: recentSignals.length,
  })

  console.log(`[situationGen] generated ${validated.length} situations from ${recentSignals.length} signals`)
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

module.exports = { generateSituations }
