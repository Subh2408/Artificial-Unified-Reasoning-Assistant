/**
 * GDELT GKG 2.0 Article List API — global event news monitoring
 * No API key required. Free, unlimited.
 * Relevant to: Claims (geopolitical events, marine incidents)
 */

const QUERIES = [
  'insurance reinsurance Gulf MENA',
  'marine war risk Red Sea Hormuz',
  'sanctions Iran shipping Lloyd',
]

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

async function fetchGdeltQuery(query) {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: '15',
    format: 'json',
    timespan: '15d',
    sourcelang: 'english',
  })
  const url = `${GDELT_BASE}?${params}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`)
  const data = await res.json()
  return data.articles || []
}

function parseGdeltDate(seendate) {
  // Format: "20260316T123000Z"
  if (!seendate) return new Date().toISOString()
  const m = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (!m) return new Date().toISOString()
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).toISOString()
}

async function fetchGdelt() {
  const results = []
  for (const query of QUERIES) {
    try {
      const articles = await fetchGdeltQuery(query)
      for (const a of articles) {
        results.push({
          source: a.domain ? a.domain.replace(/^www\./, '').toUpperCase() : 'GDELT',
          title: a.title || '',
          snippet: '',  // GDELT doesn't provide article content
          timestamp: parseGdeltDate(a.seendate),
          link: a.url || '',
          rawGeography: a.sourcecountry || 'Global',
        })
      }
    } catch (err) {
      console.warn('[gdelt] query failed:', err.message)
    }
  }
  // Deduplicate by title
  const seen = new Set()
  return results.filter((item) => {
    if (seen.has(item.title)) return false
    seen.add(item.title)
    return true
  })
}

module.exports = { fetchGdelt }
