/**
 * Ingestion pipeline: dedup → score → Claude transform → persist
 * Handles both signals and regulations.
 * Signal lifecycle: INGESTED → scored → discarded | pending | flagged → assigned | expired
 */
const crypto = require('crypto')
const { readArray, writeArray, readFile, writeFile } = require('../lib/storage')
const { buildSignalPrompt }     = require('./prompts/signalTransform')
const { buildRegulationPrompt } = require('./prompts/regulationTransform')

const MAX_SIGNALS    = 500
const MAX_REGS       = 50
const MAX_HASHES     = 2000
const MAX_LOG        = 50

// ── Source tier mapping (1 = Qatar local, 2 = GCC, 3 = MENA, 4 = Global market) ──

const SOURCE_TIERS = {
  'PENINSULA QATAR': 1, 'QNA': 1, 'GULF TIMES': 1, 'AL JAZEERA': 1,
  'QATAR TRIBUNE': 1,
  'GOOGLE NEWS QATAR WEATHER': 1, 'GOOGLE NEWS QATAR EMERGENCY': 1,
  'ARAB NEWS': 2, 'THE NATIONAL': 2, 'KHALEEJ TIMES': 2,
  'GARD': 2, 'SKULD': 2, 'UK P&I CLUB': 2, 'LMA': 2,
  'GDACS': 3, 'THE WATCHERS': 3, 'FLOODLIST': 3, 'RELIEFWEB': 3,
  'OFAC': 3, 'FRED': 3, 'GDELT': 3,
  'ARTEMIS': 4, 'INSURANCE JOURNAL': 4, 'REINSURANCE NEWS': 4, 'IAIS': 4,
}

function getSourceTier(source) {
  return SOURCE_TIERS[(source || '').toUpperCase()] || 4
}

// ── Situation keyword matching — maps situation IDs to keyword arrays ──

const SIT_KEYWORDS = {
  sit1: ['HORMUZ', 'STRAIT OF HORMUZ', 'PERSIAN GULF', 'TANKER', 'IRAN SHIP'],
  sit2: ['RED SEA', 'HOUTHI', 'JWC', 'GULF OF ADEN', 'BAB EL-MANDEB'],
  sit3: ['UKRAINE', 'CEASEFIRE', 'RUSSIA', 'KYIV', 'DONBAS'],
  sit4: ['TARIFF', 'IEEPA', 'TRADE WAR', 'TRUMP TARIFF'],
  sit5: ['CYBER', 'CISA', 'APT', 'MALWARE', 'RANSOMWARE', 'SCADA'],
  sit6: ['SUDAN', 'PORT SUDAN', 'RSF', 'DARFUR'],
  sit7: ['QATAR FLOOD', 'QATAR RAIN', 'ASHGHAL', 'DOHA FLOOD', 'DOHA RAIN', 'AL SARAYAT', 'QATAR WEATHER'],
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

// ── Keyword arrays ──

const GEO_TERMS = [
  // Qatar specific
  'qatar', 'doha', 'qatari', 'qfc', 'qcb', 'qfcra', 'qfma',
  'al rayyan', 'al wakrah', 'lusail', 'dukhan', 'mesaieed',
  'ras laffan', 'north field', 'pearl qatar',
  'ashghal', 'public works authority', 'qna', 'qatar news agency',
  'ministry of interior', 'moi qatar', 'civil defence qatar',
  'hamad international', 'hia', 'salwa road',
  'west bay', 'industrial area doha',

  // Gulf / GCC
  'gulf', 'gcc', 'arabian gulf', 'persian gulf', 'gulf states',
  'uae', 'dubai', 'abu dhabi', 'sharjah', 'ras al khaimah',
  'saudi arabia', 'riyadh', 'jeddah', 'ksa', 'neom',
  'kuwait', 'bahrain', 'manama', 'oman', 'muscat', 'musandam',
  'hormuz', 'strait of hormuz', 'red sea', 'gulf of aden',
  'gulf of oman', 'arabian sea', 'suez', 'suez canal',
  'bab el mandeb', 'bab-el-mandeb',

  // Broader MENA
  'iran', 'tehran', 'iranian', 'irgc', 'iraq', 'baghdad',
  'yemen', 'houthi', 'houthis', 'ansarallah',
  'jordan', 'egypt', 'cairo', 'israel', 'lebanon', 'syria',
  'libya', 'sudan', 'somalia', 'eritrea',
  'middle east', 'mena', 'levant',

  // Key shipping corridors
  'strait', 'channel', 'shipping lane', 'chokepoint',
  'port', 'terminal', 'anchorage', 'berth', 'waterway',
]

const INSURANCE_TERMS = [
  // Core insurance
  'insurance', 'insurer', 'insured', 'insurable', 'reinsurance',
  'reinsurer', 'underwriting', 'underwriter', 'policy', 'policyholder',
  'premium', 'claim', 'claims', 'loss', 'losses', 'reserve',
  'indemnity', 'indemnification', 'subrogation', 'deductible',
  'excess', 'retention', 'cover', 'coverage', 'exclusion',

  // Marine & transport
  'marine', 'hull', 'cargo', 'vessel', 'ship', 'tanker',
  'vlcc', 'supertanker', 'lng carrier', 'bulk carrier', 'container ship',
  'fleet', 'voyage', 'charter', 'shipowner', 'p&i', 'p and i',
  'protection and indemnity', 'war risk', 'war risks',
  'general average', 'salvage', 'wreck', 'total loss',
  'constructive total loss', 'ctl', 'sue and labour',
  'lma', 'jwc', 'joint war committee', "lloyd's", 'lloyds',
  'iumi', 'gard', 'skuld', 'west of england', 'uk p&i',
  'swedish club', 'shipowners club',

  // Energy & offshore
  'energy', 'offshore', 'onshore', 'oil', 'gas', 'lng',
  'pipeline', 'platform', 'rig', 'refinery', 'petrochemical',
  'oilfield', 'well', 'blowout', 'spill', 'upstream', 'downstream',
  'oilrig', 'fpso', 'subsea', 'qatargas', 'rasgas', 'qatarenergy',

  // Property & casualty
  'property', 'property damage', 'fire', 'explosion', 'collapse',
  'flood', 'flash flood', 'flooding', 'inundation', 'storm surge',
  'storm', 'thunderstorm', 'cyclone', 'hurricane', 'typhoon',
  'tornado', 'hail', 'hailstorm', 'rainfall', 'heavy rain',
  'extreme weather', 'nat cat', 'natural catastrophe', 'catastrophe',
  'cat event', 'cat loss', 'aggregate', 'accumulation',
  'business interruption', 'bi', 'contingent bi', 'cbi',
  'ashghal', 'drainage', 'rain emergency',

  // Liability
  'liability', 'third party', 'bodily injury', 'personal injury',
  'product liability', 'd&o', 'directors and officers',
  'e&o', 'errors and omissions', 'professional indemnity',
  'public liability', 'employers liability',

  // Aviation
  'aviation', 'aircraft', 'airline', 'airport', 'hull',
  'passenger', 'airspace', 'notam', 'grounding',

  // Cyber
  'cyber', 'ransomware', 'malware', 'data breach', 'hack',
  'hacking', 'cyberattack', 'phishing', 'apt', 'scada',
  'critical infrastructure', 'ics', 'operational technology',

  // Engineering & construction
  'engineering', 'construction', 'car', "contractor's all risk",
  'ear', 'erection all risk', 'dsu', 'delay in start-up',
  'infrastructure', 'project', 'megaproject',

  // Life & health
  'life insurance', 'health insurance', 'medical', 'mortality',
  'morbidity', 'pandemic', 'epidemic', 'group life',

  // Specialty
  'political risk', 'credit risk', 'trade credit', 'surety',
  'bond', 'kidnap', 'ransom', 'k&r', 'terrorism',
  'sabotage', 'contingency', 'parametric',

  // Market & capital
  'cat bond', 'ils', 'insurance linked securities',
  'catastrophe bond', 'collateral', 'sidecars', 'capacity',
  'hardening', 'softening', 'rate', 'rating', 'repricing',
  'renewal', 'treaty', 'facultative', 'fac',
  'retrocession', 'retro', 'pml', 'probable maximum loss',
  'tiv', 'total insured value', 'exposure',

  // Regulatory & compliance
  'regulatory', 'regulation', 'regulator', 'circular',
  'directive', 'qcb', 'cbuae', 'sama', 'qfcra', 'qfma',
  'iais', 'ifrs 17', 'solvency', 'capital adequacy',
  'mlro', 'aml', 'kyc', 'sanctions', 'ofac', 'fatf',
  'compliance', 'breach', 'penalty', 'fine',
]

const RISK_TERMS = [
  // Military & conflict
  'attack', 'strike', 'missile', 'drone', 'uav', 'rocket',
  'airstrike', 'bombing', 'explosion', 'blast', 'detonation',
  'war', 'conflict', 'ceasefire', 'escalation', 'de-escalation',
  'military', 'navy', 'naval', 'coast guard', 'frigate',
  'destroyer', 'warship', 'submarine', 'mine', 'minefield',
  'blockade', 'closure', 'seizure', 'confiscation', 'hijack',
  'piracy', 'pirate', 'hostage',

  // Sanctions & legal
  'sanctions', 'sanctioned', 'ofac', 'sdn list',
  'asset freeze', 'embargo', 'export control', 'restriction',
  'blacklist', 'designated', 'debarment', 'ieepa',
  'un security council', 'unsc', 'eu sanctions',

  // Catastrophe triggers
  'earthquake', 'seismic', 'tsunami', 'volcanic',
  'wildfire', 'drought', 'heatwave', 'extreme heat',
  'cold snap', 'blizzard', 'ice storm', 'landslide',
  'flash flood', 'flood warning', 'weather advisory',
  'emergency deployed',

  // Weather emergency response
  'rain emergency', 'drainage', 'water pooling', 'waterlogged',
  'road closure', 'flood warning', 'weather advisory',
  'rapid response', 'emergency teams deployed', 'alternative route',

  // Market stress
  'insolvency', 'default', 'bankruptcy', 'liquidation',
  'credit downgrade', 'rating action', 'withdrawal',
  'market exit', 'capacity withdrawal', 'moratorium',
  'force majeure', 'act of god',

  // Urgent signal words
  'alert', 'warning', 'urgent', 'emergency', 'crisis',
  'critical', 'severe', 'catastrophic', 'major loss',
  'significant loss', 'mass casualty', 'evacuation',
  'shutdown', 'closure', 'suspension', 'cancellation',
  'recall', 'grounding', 'ban',

  // Financial stress
  'loss ratio', 'combined ratio', 'reserve strengthening',
  'reserve release', 'profit warning', 'earnings impact',
  'capital raise', 'rights issue', 'market disruption',
]

// ── Scoring ──

function scoreSignal(title, description, sourceTier) {
  const text = (title + ' ' + (description || '')).toLowerCase()
  let score = 0

  // Geography — must have at least one geo hit to be relevant
  let geoHits = 0
  GEO_TERMS.forEach(t => { if (text.includes(t)) geoHits++ })
  score += Math.min(geoHits * 2, 8) // cap geo at 8 points

  // Insurance relevance — highest weight
  INSURANCE_TERMS.forEach(t => { if (text.includes(t)) score += 3 })

  // Risk/urgency terms
  RISK_TERMS.forEach(t => { if (text.includes(t)) score += 2 })

  // Source tier bonus
  if (sourceTier === 1) score += 3
  else if (sourceTier === 2) score += 1

  // Penalty: no geo hits at all = irrelevant regardless of other matches
  if (geoHits === 0) score = Math.min(score, 3)

  return score
}

// ── Signal disposition tracking ──

function writeDisposition(signalId, score, disposition, situationId, runId) {
  const store = readFile('signal_disposition')
  store[signalId] = {
    score,
    disposition,
    situationId: situationId || null,
    dispositionAt: new Date().toISOString(),
    runId: runId || null,
  }
  writeFile('signal_disposition', store)
}

// ── Helpers ──

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
      model: 'claude-haiku-4-5-20251001',
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
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')
    const enrichments = JSON.parse(jsonMatch[0])
    return tagged.map((item) => {
      const enrich = enrichments.find((e) => e.idx === item.idx) || {}
      return { ...item, ...enrich }
    })
  } catch (err) {
    console.warn('[pipeline] Claude enrich failed:', err.message)
    return tagged
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

  if (!rawItems.length) {
    writeArray('signals', existing)
    appendLog('signals', 0, 0)
    return { updatedSitIds: new Set(), hasFlagged: false }
  }

  const dedupedItems = rawItems.filter((item) => !hashes.has(contentHash(item)))

  // Score with source tier, track dispositions
  let hasFlagged = false
  const newItems = []
  for (const item of dedupedItems) {
    const tier = getSourceTier(item.source)
    const score = scoreSignal(item.title, item.snippet || item.description || '', tier)
    item.relevanceScore = score
    item._sourceTier = tier

    if (score < 4) {
      // Discard — not stored but tracked in disposition index
      writeDisposition(`discarded_${contentHash(item)}`, score, 'discarded', null, null)
    } else {
      if (score >= 15) {
        item._disposition = 'flagged'
        hasFlagged = true
      } else {
        item._disposition = 'pending'
      }
      newItems.push(item)
    }
  }

  const discarded = dedupedItems.length - newItems.length
  if (discarded) console.log(`[ingest] filtered ${discarded} low-relevance signals (score < 4)`)

  if (!newItems.length) {
    writeArray('signals', existing)
    appendLog('signals', rawItems.length, 0)
    console.log(`[ingest] signals: ${rawItems.length} raw, all already seen or filtered`)
    return { updatedSitIds: new Set(), hasFlagged: false }
  }

  // Enrich in batches of 10
  const enriched = []
  for (let i = 0; i < newItems.length; i += 10) {
    const batch = newItems.slice(i, i + 10)
    const result = await enrichBatch(batch, buildSignalPrompt)
    enriched.push(...result)
  }

  const makeId = nextLiveId(existing, 'live_s')
  const now = new Date().toISOString()

  const newSignals = enriched.map((item, i) => {
    hashes.add(contentHash(item))
    const id = makeId(i)
    const sitId = matchSituation(item)
    const disposition = sitId ? 'assigned' : item._disposition || 'pending'

    writeDisposition(id, item.relevanceScore, disposition, sitId, null)

    return {
      id,
      situationId:    sitId,
      source:         item.source || 'UNKNOWN',
      sourceType:     item.sourceType || 'NEWS',
      sourceTier:     item._sourceTier || 4,
      url:            item.link || '',
      timestamp:      item.timestamp || now,
      ingestedAt:     now,
      title:          item.title || '',
      description:    item.description || item.snippet || item.title || '',
      tags:           Array.isArray(item.tags) ? item.tags : [],
      score:          item.relevanceScore || 0,
      relevanceScore: item.relevanceScore || 0,
      eventType:      null,
      disposition:    disposition,
      dispositionAt:  now,
      generationRunId: null,
      geography:      item.geography || item.rawGeography || 'Global',
    }
  })

  writeArray('signals', [...newSignals, ...existing].slice(0, MAX_SIGNALS))
  writeArray('seen_hashes', [...hashes].slice(-MAX_HASHES))
  appendLog('signals', rawItems.length, newSignals.length)

  const updatedSitIds = new Set(newSignals.map((s) => s.situationId).filter(Boolean))
  const flaggedCount = newSignals.filter(s => s.disposition === 'flagged').length
  console.log(`[ingest] +${newSignals.length} signals (${rawItems.length} raw → ${newItems.length} new) — situations: ${[...updatedSitIds].join(', ') || 'none'}${flaggedCount ? ` — ${flaggedCount} FLAGGED (score ≥ 15)` : ''}`)
  return { updatedSitIds, hasFlagged }
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

module.exports = { ingestSignals, ingestRegulations, writeDisposition }
