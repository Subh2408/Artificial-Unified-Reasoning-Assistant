/**
 * Ticker RSS — fetches headlines from 4 curated sources.
 * Reuters MENA, Gulf News, Lloyd's List, OFAC.
 * Refreshes every 30 minutes, max 20 headlines.
 */
const Parser = require('rss-parser')

const TICKER_SOURCES = [
  { name: 'AL JAZEERA',   url: 'https://www.aljazeera.com/xml/rss/all.xml',   type: 'rss' },
  { name: 'GULF NEWS',    url: 'https://gulfnews.com/rss/world',             type: 'rss' },
  { name: "LLOYD'S LIST",  url: 'https://lloydslist.com',                     type: 'scrape' },
  { name: 'OFAC',         url: 'https://home.treasury.gov/rss.xml',          type: 'rss' },
]

const TICKER_KEYWORDS = [
  'qatar','gulf','gcc','hormuz','iran','uae','saudi',
  'sanctions','ofac','marine','insurance','reinsurance',
  'war risk','shipping','tanker','lloyd','red sea','vessel',
]

let cache = { items: [], fetchedAt: 0 }
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function isRelevant(title) {
  const t = (title || '').toLowerCase()
  return TICKER_KEYWORDS.some((kw) => t.includes(kw))
}

async function fetchTickerHeadlines() {
  if (cache.items.length && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.items
  }

  const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'AURA/1.0 Insurance Intelligence Platform' },
  })
  const items = []

  for (const src of TICKER_SOURCES) {
    if (src.type !== 'rss') continue // skip scrape-type for now
    try {
      const feed = await parser.parseURL(src.url)
      const relevant = feed.items
        .filter((item) => isRelevant(item.title))
        .slice(0, 5)
        .map((item) => ({
          tag: src.name,
          title: (item.title || '').trim(),
          timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
        }))
      items.push(...relevant)
    } catch (err) {
      console.warn(`[ticker-rss] ${src.name} failed:`, err.message)
    }
  }

  // Sort by recency, dedup, take top 20
  const seen = new Set()
  const unique = items
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter((item) => {
      if (!item.title || seen.has(item.title.toLowerCase())) return false
      seen.add(item.title.toLowerCase())
      return true
    })
    .slice(0, 20)
    .map((item) => `${item.tag} — ${item.title}`)

  if (unique.length) {
    cache = { items: unique, fetchedAt: Date.now() }
  }

  return unique
}

module.exports = { fetchTickerHeadlines }
