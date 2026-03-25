/**
 * GDACS RSS — Global Disaster Alert and Coordination System
 * Covers: earthquakes, tropical cyclones, floods, volcanoes, droughts, wildfires
 * Relevant to: Claims, Reinsurance (cat events)
 */
const Parser = require('rss-parser')

const GDACS_URL = 'https://www.gdacs.org/xml/rss.xml'

const ALERT_GEO = {
  'Arabian Gulf': ['iran', 'iraq', 'kuwait', 'bahrain', 'qatar', 'oman', 'uae', 'persian'],
  'Red Sea': ['red sea', 'yemen', 'eritrea', 'djibouti', 'suez', 'gulf of aden'],
  'Indian Ocean': ['indian ocean', 'maldives', 'seychelles', 'mauritius', 'somalia'],
  'South Asia': ['india', 'pakistan', 'bangladesh', 'sri lanka', 'nepal'],
  'Southeast Asia': ['philippines', 'indonesia', 'vietnam', 'thailand', 'myanmar'],
  'Mediterranean': ['turkey', 'greece', 'cyprus', 'egypt', 'libya', 'morocco', 'algeria', 'tunisia'],
  'East Africa': ['kenya', 'tanzania', 'ethiopia', 'mozambique', 'madagascar'],
}

function extractGeography(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  for (const [geo, keywords] of Object.entries(ALERT_GEO)) {
    if (keywords.some((kw) => text.includes(kw))) return geo
  }
  return 'Global'
}

async function fetchGdacs() {
  const parser = new Parser({
    headers: { 'User-Agent': 'AURA/1.0' },
    customFields: {
      item: ['gdacs:alertlevel', 'gdacs:eventtype', 'gdacs:country', 'gdacs:severity'],
    },
  })
  try {
    const feed = await parser.parseURL(GDACS_URL)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // last 7 days
    return feed.items
      .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)
      .map((item) => ({
        source: 'GDACS',
        title: item.title || '',
        snippet: item.contentSnippet || item.content || '',
        timestamp: item.isoDate || new Date().toISOString(),
        link: item.link || '',
        rawGeography: extractGeography(item.title || '', item.contentSnippet || ''),
        alertLevel: item['gdacs:alertlevel'] || '',
        eventType: item['gdacs:eventtype'] || '',
      }))
  } catch (err) {
    console.warn('[gdacs] fetch failed:', err.message)
    return []
  }
}

module.exports = { fetchGdacs }
