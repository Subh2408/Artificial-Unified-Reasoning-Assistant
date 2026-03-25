/**
 * Server-side situation synthesis using Claude Haiku.
 * Called by the scheduler after signal ingest (auto) and by the HTTP endpoint (manual).
 */
require('dotenv').config()
const { readArray, writeFile, readFile } = require('../lib/storage')

async function synthesizeOne(sitId) {
  const overrides  = readFile('situation_overrides')
  const seed       = readArray('situations_seed')
  const generated  = readArray('situations_generated')
  const situation  = overrides[sitId] || seed.find((s) => s.id === sitId) || generated.find((s) => s.id === sitId)
  if (!situation) {
    console.warn(`[synthesize] no situation found for id: ${sitId}`)
    return null
  }

  const allSignals  = readArray('signals')
  const liveSignals = allSignals.filter((s) => s.situationId === sitId)
  if (!liveSignals.length) {
    console.log(`[synthesize] ${sitId}: no live signals — skipping`)
    return null
  }

  const signalSummary = liveSignals
    .map((s) => `- [${s.source}] ${s.title}: ${s.description}`)
    .join('\n')

  const systemPrompt = `You are a senior insurance intelligence analyst. You update existing situation assessments based on new signal data. Return ONLY valid JSON — no markdown, no commentary. Keep each field under 200 characters. If the response would exceed the token limit, shorten every field rather than truncating mid-response.`

  const userPrompt = `Update this insurance intelligence situation based on the new signals below. Return a JSON object with EXACTLY these fields updated:
- "summary": updated 2-3 sentence summary incorporating latest developments
- "confidence": integer 0-100 reflecting confidence in the assessment
- "updated": "${new Date().toISOString()}"
- "interpretations": object with keys for all departments that exist in the current situation (risk_compliance, claims, underwriting, reinsurance, investments). Each department value must have: "headline" (string), "detail" (string), "affectedLines" (string array), "actions" (string array of 3-5 actionable items)

Current situation:
${JSON.stringify({ id: situation.id, title: situation.title, severity: situation.severity, summary: situation.summary, interpretations: situation.interpretations }, null, 2)}

New live signals (${liveSignals.length} signals):
${signalSummary}

Return ONLY a JSON object with the 4 fields listed above.`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${data.error?.message}`)

  const text      = data.content?.[0]?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')

  let updates
  let jsonStr = jsonMatch[0]
  try {
    updates = JSON.parse(jsonStr)
  } catch (e1) {
    // Try fixing trailing commas and truncated JSON
    jsonStr = jsonStr
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/\n/g, ' ')
    const openBraces = (jsonStr.match(/\{/g) || []).length
    const closeBraces = (jsonStr.match(/\}/g) || []).length
    const openBrackets = (jsonStr.match(/\[/g) || []).length
    const closeBrackets = (jsonStr.match(/\]/g) || []).length
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonStr += ']'
    for (let i = 0; i < openBraces - closeBraces; i++) jsonStr += '}'
    try {
      updates = JSON.parse(jsonStr)
    } catch (e2) {
      console.error('[synthesize] JSON repair failed, raw length:', text.length)
      throw new Error('Failed to parse Claude response as JSON after repair attempt')
    }
  }

  const updated = { ...situation, ...updates, isLive: true }

  // Persist override
  const currentOverrides = readFile('situation_overrides')
  currentOverrides[sitId] = updated
  writeFile('situation_overrides', currentOverrides)

  console.log(`[synthesize] ${sitId} updated — confidence: ${updated.confidence}`)
  return updated
}

module.exports = { synthesizeOne }
