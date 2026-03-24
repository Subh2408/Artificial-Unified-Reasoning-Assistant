/**
 * Ticker RSS — fetches headlines from curated news sources for the live ticker.
 * Sources: Reuters MENA, Gulf News, Lloyd's List, OFAC/Treasury
 */
const Parser = require('rss-parser')

const TICKER_FEEDS = [
  // Reuters MENA — multiple fallback URLs since feeds change
  { url: 'https://www.reutersagency.com/feed/?taxonomy=best-regions&post_tag=middle-east', tag: 'REUTERS' },
  // Gulf News — main RSS feed
  { url: 'https://gulfnews.com/rss/uae',          tag: 'GULF NEWS' },
  // Lloyd's List — public maritime news
  { url: 'https://www.lloydslist.com/LL/rss.htm',  tag: 'LLOYDS LIST' },
  // Lloyd's List fallback — Splash247 (free maritime news)
  { url: 'https://splash247.com/feed/',             tag: 'MARITIME' },
  // OFAC / Treasury sanctions
  { url: 'https://home.treasury.gov/rss.xml',       tag: 'OFAC' },
  // Al Jazeera Middle East as Reuters MENA fallback
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', tag: 'AL JAZEERA' },
]

// Keywords to keep OFAC items relevant (filter out generic Treasury content)
const OFAC_KEYWORDS = ['sanction', 'ofac', 'sdn', 'designation', 'iran', 'russia', 'houthi', 'terror']

// In-memory cache: { items: [...], fetchedAt: timestamp }
let cache = { items: [], fetchedAt: 0 }
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

async function fetchTickerHeadlines() {
  // Return cache if fresh
  if (cache.items.length && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.items
  }

  const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'AURA/1.0 Insurance Intelligence Platform' },
  })
  const items = []

  const results = await Promise.allSettled(
    TICKER_FEEDS.map(async ({ url, tag }) => {
      try {
        const feed = await parser.parseURL(url)
        let feedItems = feed.items.slice(0, 8)

        // Filter OFAC to sanctions-relevant items only
        if (tag === 'OFAC') {
          feedItems = feedItems.filter((item) => {
            const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase()
            return OFAC_KEYWORDS.some((kw) => text.includes(kw))
          })
        }

        return feedItems.slice(0, 5).map((item) => ({
          tag,
          title: (item.title || '').trim(),
          timestamp: item.isoDate || item.pubDate || new Date().toISOString(),
        }))
      } catch (err) {
        console.warn(`[ticker-rss] ${tag} failed:`, err.message)
        return []
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') items.push(...result.value)
  }

  // Sort by recency, deduplicate by title, take top 12
  const seen = new Set()
  const unique = items
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter((item) => {
      if (!item.title || seen.has(item.title.toLowerCase())) return false
      seen.add(item.title.toLowerCase())
      return true
    })
    .slice(0, 12)
    .map((item) => `${item.tag} — ${item.title}`)

  if (unique.length) {
    cache = { items: unique, fetchedAt: Date.now() }
  }

  return unique
}

module.exports = { fetchTickerHeadlines }
