/**
 * Ingestion pipeline: dedup → Claude transform → persist
 * Handles both signals and regulations.
 */
const crypto = require('crypto')
const { readArray, writeArray, readFile, writeFile } = require('../lib/storage')
const { buildSignalPrompt }     = require('./prompts/signalTransform')
const { buildRegulationPrompt } = require('./prompts/regulationTransform')

const MAX_SIGNALS    = 200
const MAX_REGS       = 50
const MAX_HASHES     = 2000
const MAX_LOG        = 50

// Situation keyword matching — maps situation IDs to keyword arrays
const SIT_KEYWORDS = {
  sit1: ['HORMUZ', 'STRAIT OF HORMUZ', 'PERSIAN GULF', 'TANKER', 'IRAN SHIP'],
  sit2: ['RED SEA', 'HOUTHI', 'JWC', 'GULF OF ADEN', 'BAB EL-MANDEB'],
  sit3: ['UKRAINE', 'CEASEFIRE', 'RUSSIA', 'KYIV', 'DONBAS'],
  sit4: ['TARIFF', 'IEEPA', 'TRADE WAR', 'TRUMP TARIFF'],
  sit5: ['CYBER', 'CISA', 'APT', 'MALWARE', 'RANSOMWARE', 'SCADA'],
  sit6: ['SUDAN', 'PORT SUDAN', 'RSF', 'DARFUR'],
}

function contentHash(item) {
  const key = `${item.source}|${(item.title || '').trim().toLowerCase().substring(0, 80)}`
  return crypto.createHash('md5').update(key).digest('hex')
}

function matchSituation(signal) {
  const text = `${signal.title} ${(signal.tags || []).join(' ')} ${signal.rawGeography || ''}`.toUpperCase()
  for (const [sitId, keywords] of Object.entries(SIT_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return sitId
  }
  return null
}

function appendLog(type, rawCount, newCount) {
  const log = readArray('ingest_log')
  log.unshift({ timestamp: new Date().toISOString(), type, rawCount, newCount })
  writeArray('ingest_log', log.slice(0, MAX_LOG))
}

async function callClaudeIngest(system, userContent, maxTokens = 1500) {
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
      model: 'claude-haiku-4-5-20251001', // Haiku for cost-efficient batch transforms
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${data.error?.message}`)
  return data.content?.[0]?.text || ''
}

async function enrichBatch(rawItems, promptBuilder) {
  const tagged = rawItems.map((item, i) => ({ ...item, idx: i }))
  try {
    const { system, user } = promptBuilder(tagged)
    const text = await callClaudeIngest(system, user, 2000)
    // Extract JSON array from response (Claude sometimes wraps in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')
    const enrichments = JSON.parse(jsonMatch[0])
    // Merge enrichments back into raw items
    return tagged.map((item) => {
      const enrich = enrichments.find((e) => e.idx === item.idx) || {}
      return { ...item, ...enrich }
    })
  } catch (err) {
    console.warn('[pipeline] Claude enrich failed:', err.message)
    return tagged // return raw items as fallback — fields filled by defaults below
  }
}

function nextLiveId(existing, prefix) {
  let max = 0
  for (const item of existing) {
    const n = parseInt((item.id || '').replace(/\D/g, ''), 10)
    if (n > max) max = n
  }
  return (id) => `${prefix}${max + id + 1}`
}

// ── Ingest signals ────────────────────────────────────────────────────────────

async function ingestSignals(rawItems) {
  const hashes  = new Set(readArray('seen_hashes'))
  const existing = readArray('signals')

  // Always ensure signals.json exists (even if empty) so frontend knows ingest ran
  if (!rawItems.length) {
    writeArray('signals', existing)
    appendLog('signals', 0, 0)
    return new Set()
  }

  const newItems = rawItems.filter((item) => !hashes.has(contentHash(item)))
  if (!newItems.length) {
    writeArray('signals', existing)
    appendLog('signals', rawItems.length, 0)
    console.log(`[ingest] signals: ${rawItems.length} raw, all already seen`)
    return new Set()
  }

  // Enrich in batches of 10
  const enriched = []
  for (let i = 0; i < newItems.length; i += 10) {
    const batch = newItems.slice(i, i + 10)
    const result = await enrichBatch(batch, buildSignalPrompt)
    enriched.push(...result)
  }

  const makeId = nextLiveId(existing, 'live_s')

  const newSignals = enriched.map((item, i) => {
    hashes.add(contentHash(item))
    return {
      id:          makeId(i),
      situationId: matchSituation(item),
      source:      item.source || 'UNKNOWN',
      sourceType:  item.sourceType || 'NEWS',
      timestamp:   item.timestamp || new Date().toISOString(),
      title:       item.title || '',
      description: item.description || item.snippet || item.title || '',
      tags:        Array.isArray(item.tags) ? item.tags : [],
      geography:   item.geography || item.rawGeography || 'Global',
    }
  })

  writeArray('signals', [...newSignals, ...existing].slice(0, MAX_SIGNALS))
  writeArray('seen_hashes', [...hashes].slice(-MAX_HASHES))
  appendLog('signals', rawItems.length, newSignals.length)

  const updatedSituationIds = new Set(newSignals.map((s) => s.situationId).filter(Boolean))
  console.log(`[ingest] +${newSignals.length} signals (${rawItems.length} raw → ${newItems.length} new) — situations: ${[...updatedSituationIds].join(', ') || 'none'}`)
  return updatedSituationIds
}

// ── Ingest regulations ────────────────────────────────────────────────────────

async function ingestRegulations(rawItems) {
  const hashes   = new Set(readArray('seen_hashes'))
  const existing = readArray('regulations')

  if (!rawItems.length) {
    writeArray('regulations', existing)
    appendLog('regulations', 0, 0)
    return 0
  }

  const newItems = rawItems.filter((item) => !hashes.has(contentHash(item)))
  if (!newItems.length) {
    writeArray('regulations', existing)
    appendLog('regulations', rawItems.length, 0)
    console.log(`[ingest] regulations: ${rawItems.length} raw, all already seen`)
    return 0
  }

  const enriched = []
  for (let i = 0; i < newItems.length; i += 10) {
    const batch = newItems.slice(i, i + 10)
    const result = await enrichBatch(batch, buildRegulationPrompt)
    enriched.push(...result)
  }

  const makeId = nextLiveId(existing, 'live_reg')
  const today  = new Date().toISOString().split('T')[0]

  const newRegs = enriched.map((item, i) => {
    hashes.add(contentHash(item))
    return {
      id:                 makeId(i),
      jurisdiction:       item.jurisdiction || 'Unknown',
      jurisdictionCode:   item.jurisdictionCode || 'OTH',
      regulator:          item.regulator || 'UNKNOWN',
      regulatorFull:      item.regulatorFull || item.regulator || 'Unknown Regulator',
      publishedDate:      item.publishedDate || today,
      effectiveDate:      item.effectiveDate  || item.publishedDate || today,
      changeType:         item.changeType     || 'GUIDANCE',
      linesAffected:      Array.isArray(item.linesAffected) ? item.linesAffected : [],
      urgency:            item.urgency        || 'INFO',
      title:              item.title          || '',
      summary:            item.summary        || item.snippet || item.title || '',
      claimsImplication:  item.claimsImplication  || 'Under review.',
      complianceImplication: item.complianceImplication || 'Monitor for compliance obligations.',
      sourceRef:          item.link           || item.sourceRef || '',
    }
  })

  writeArray('regulations', [...newRegs, ...existing].slice(0, MAX_REGS))
  writeArray('seen_hashes', [...hashes].slice(-MAX_HASHES))
  appendLog('regulations', rawItems.length, newRegs.length)

  console.log(`[ingest] +${newRegs.length} regulations (${rawItems.length} raw → ${newItems.length} new)`)
  return newRegs.length
}

module.exports = { ingestSignals, ingestRegulations }
