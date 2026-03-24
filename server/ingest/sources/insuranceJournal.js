/**
 * Multiple insurance/reinsurance RSS feeds
 * - Insurance Journal (underwriting/market news)
 * - Reinsurance News (reinsurance market)
 * Relevant to: Underwriting, Reinsurance
 */
const Parser = require('rss-parser')

const FEEDS = [
  { url: 'https://www.insurancejournal.com/feed/', source: 'INSURANCE JOURNAL' },
  { url: 'https://www.reinsurancene.ws/feed/',     source: 'REINSURANCE NEWS' },
  { url: 'https://theinsurer.com/feed/',           source: 'THE INSURER' },
]

// Keywords that indicate MENA / marine / international relevance
const RELEVANT_KEYWORDS = [
  'mena', 'gulf', 'qatar', 'uae', 'saudi', 'dubai', 'abu dhabi', 'doha',
  'marine', 'maritime', 'reinsurance', 'cat bond', 'ils', 'war risk',
  'p&i', 'hull', 'cargo', 'energy', 'offshore', 'catastrophe', 'nat cat',
  'hardening', 'softening', 'rate', 'capacity', 'treaty', 'retrocession',
]

function isRelevant(title, snippet) {
  const text = `${title} ${snippet}`.toLowerCase()
  return RELEVANT_KEYWORDS.some((kw) => text.includes(kw))
}

async function fetchInsuranceFeeds() {
  const parser = new Parser()
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
  const results = []

  for (const { url, source } of FEEDS) {
    try {
      const feed = await parser.parseURL(url)
      const items = feed.items
        .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)
        .slice(0, 15) // let Claude classify relevance — no pre-filter
        .map((item) => ({
          source,
          title: item.title || '',
          snippet: item.contentSnippet?.substring(0, 300) || '',
          timestamp: item.isoDate || new Date().toISOString(),
          link: item.link || '',
          rawGeography: 'Global',
        }))
      results.push(...items)
    } catch (err) {
      console.warn(`[insuranceFeeds] ${source} fetch failed:`, err.message)
    }
  }

  return results
}

module.exports = { fetchInsuranceFeeds }
