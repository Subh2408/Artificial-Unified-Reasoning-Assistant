/**
 * FRED (Federal Reserve Economic Data) API
 * Free API key required: https://fred.stlouisfed.org/docs/api/api_key.html
 * Relevant to: Investments
 * No-op if FRED_API_KEY is not set.
 */

const SERIES = [
  { id: 'DCOILWTICO', label: 'WTI Crude Oil Price',       unit: 'USD/barrel',  geo: 'Global' },
  { id: 'DEXUSGBP',  label: 'USD/GBP Exchange Rate',      unit: 'USD per GBP', geo: 'Global' },
  { id: 'DEXUSNB',   label: 'USD/NOK Exchange Rate',      unit: 'USD per NOK', geo: 'Global' },
  { id: 'BAMLH0A0HYM2', label: 'US High Yield OAS Spread', unit: 'basis points', geo: 'Global' },
]

async function fetchFred() {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) return []

  const results = []
  for (const series of SERIES) {
    try {
      const params = new URLSearchParams({
        series_id: series.id,
        api_key: apiKey,
        sort_order: 'desc',
        limit: '1',
        file_type: 'json',
      })
      const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue
      const data = await res.json()
      const obs = data.observations?.[0]
      if (!obs || obs.value === '.') continue

      results.push({
        source: 'FRED',
        title: `${series.label}: ${obs.value} ${series.unit}`,
        snippet: `Latest FRED reading for ${series.label} as of ${obs.date}. Series: ${series.id}.`,
        timestamp: new Date(obs.date).toISOString(),
        link: `https://fred.stlouisfed.org/series/${series.id}`,
        rawGeography: series.geo,
      })
    } catch (err) {
      console.warn(`[fred] ${series.id} failed:`, err.message)
    }
  }

  return results
}

module.exports = { fetchFred }
