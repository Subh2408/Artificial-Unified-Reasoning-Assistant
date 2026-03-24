// All API calls go through the Express backend at /api
// The backend holds the Anthropic API key — never exposed to the browser

const BASE = '/api'

// ── Anthropic proxy ──────────────────────────────────────────────────────────

export async function callClaude(system, messages, maxTokens = 1000) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, maxTokens }),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = await res.json()
  return data.text || ''
}

// ── Saved briefs ─────────────────────────────────────────────────────────────

export async function getSaved() {
  const res = await fetch(`${BASE}/saved`)
  if (!res.ok) throw new Error(`Failed to fetch saved briefs (${res.status})`)
  return res.json()
}

export async function createSaved(payload) {
  const res = await fetch(`${BASE}/saved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save brief (${res.status})`)
  return res.json()
}

export async function deleteSaved(id) {
  const res = await fetch(`${BASE}/saved/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete brief (${res.status})`)
}

// ── Chat history ─────────────────────────────────────────────────────────────

export async function getChatHistory(chatKey) {
  const res = await fetch(`${BASE}/chat-history/${encodeURIComponent(chatKey)}`)
  if (res.status === 404) return []
  const data = await res.json()
  return data.messages || []
}

export async function saveChatHistory(chatKey, messages) {
  const res = await fetch(`${BASE}/chat-history/${encodeURIComponent(chatKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) console.error(`Failed to save chat history (${res.status})`)
}

export async function clearChatHistory(chatKey) {
  await fetch(`${BASE}/chat-history/${encodeURIComponent(chatKey)}`, {
    method: 'DELETE',
  })
}

// ── Department actions (appetite, declarations, checklists, positions) ────────

export async function getDeptAction(sitId, deptKey, actionType) {
  const res = await fetch(
    `${BASE}/actions/${sitId}?dept=${deptKey}&type=${actionType}`
  )
  if (res.status === 404) return null
  const data = await res.json()
  return data.payload || null
}

export async function saveDeptAction(sitId, deptKey, actionType, payload) {
  await fetch(`${BASE}/actions/${sitId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deptKey, actionType, payload }),
  })
}

// ── Portfolio threshold alerts ────────────────────────────────────────────────

export async function getThresholdAlerts(situationId, deptKey) {
  const res = await fetch(`${BASE}/threshold-alerts/${encodeURIComponent(situationId)}/${encodeURIComponent(deptKey)}`)
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = await res.json()
  return data.alerts || null
}

export async function evaluateThresholds(situation, deptKey) {
  const interp = situation.interpretations?.[deptKey]
  const res = await fetch(`${BASE}/evaluate-thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      situationId: situation.id,
      deptKey,
      title: situation.title,
      severity: situation.severity,
      summary: situation.summary,
      affectedLines: interp?.affectedLines || situation.category || [],
      geography: situation.geography,
      deptBrief: interp?.detail || '',
    }),
  })
  if (!res.ok) throw new Error(`Evaluation failed (${res.status})`)
  const data = await res.json()
  return data.alerts || []
}

// ── Regulation department implications ────────────────────────────────────────

export async function getRegImplications(regId) {
  const res = await fetch(`${BASE}/reg-implications/${encodeURIComponent(regId)}`)
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}

export async function generateRegImplications(reg) {
  const res = await fetch(`${BASE}/generate-reg-implications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      regId: reg.id,
      title: reg.title,
      jurisdiction: reg.jurisdiction,
      regulator: reg.regulatorFull || reg.regulator,
      effectiveDate: reg.effectiveDate,
      changeType: reg.changeType,
      summary: reg.summary,
      claimsImplication: reg.claimsImplication,
      complianceImplication: reg.complianceImplication,
    }),
  })
  if (!res.ok) throw new Error(`Generation failed (${res.status})`)
  return res.json()
}

// ── Regulatory query history ──────────────────────────────────────────────────

export async function getRegQueryHistory() {
  const res = await fetch(`${BASE}/reg-query`)
  if (res.status === 404) return []
  const data = await res.json()
  return data.messages || []
}

export async function saveRegQueryHistory(messages) {
  const res = await fetch(`${BASE}/reg-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) console.error(`Failed to save reg query history (${res.status})`)
}

// ── Live feed ─────────────────────────────────────────────────────────────────

export async function getLiveSignals() {
  const res = await fetch(`${BASE}/feed/signals`)
  if (!res.ok) return []
  return res.json()
}

export async function getLiveRegulations() {
  const res = await fetch(`${BASE}/feed/regulations`)
  if (!res.ok) return []
  return res.json()
}

export async function getLiveSituations() {
  const res = await fetch(`${BASE}/feed/situations`)
  if (!res.ok) return []
  return res.json()
}

export async function getLiveTickerItems() {
  const res = await fetch(`${BASE}/feed/ticker`)
  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

/** Fetches all live feed data in parallel. Returns merged objects. */
export async function getLiveFeed() {
  const [signals, regulations, situations] = await Promise.all([
    getLiveSignals(),
    getLiveRegulations(),
    getLiveSituations(),
  ])
  return { signals, regulations, situations }
}

/** Trigger a server-side ingest run (fire and forget — server logs results). */
export async function triggerIngest() {
  await fetch(`${BASE}/ingest/run`, { method: 'POST' })
}

/** Trigger on-demand re-synthesis of a situation via Claude. */
export async function synthesizeSituation(id) {
  const res = await fetch(`${BASE}/situations/${id}/synthesize`, { method: 'POST' })
  if (!res.ok) throw new Error(`Synthesize error ${res.status}`)
  const data = await res.json()
  return data.situation
}
