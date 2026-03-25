/**
 * OFAC / US Treasury sanctions and news RSS
 * Relevant to: Risk & Compliance (sanctions designations)
 */
const Parser = require('rss-parser')

const FEEDS = [
  { url: 'https://home.treasury.gov/rss.xml', source: 'US TREASURY' },
]

// Keywords indicating sanctions/compliance relevance
const SANCTIONS_KEYWORDS = [
  'sanction', 'ofac', 'sdn', 'designation', 'blacklist', 'asset freeze',
  'iran', 'russia', 'hamas', 'hezbollah', 'houthi', 'north korea',
  'arms embargo', 'travel ban', 'proliferation', 'terrorism',
  'insurance', 'reinsurance', 'maritime', 'vessel', 'ship',
]

function isSanctionsRelevant(title, snippet) {
  const text = `${title} ${snippet}`.toLowerCase()
  return SANCTIONS_KEYWORDS.some((kw) => text.includes(kw))
}

async function fetchOfac() {
  const parser = new Parser()
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
  const results = []

  for (const { url, source } of FEEDS) {
    try {
      const feed = await parser.parseURL(url)
      const items = feed.items
        .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)
        .filter((item) => isSanctionsRelevant(item.title || '', item.contentSnippet || ''))
        .slice(0, 5)
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
      console.warn(`[ofac] ${source} fetch failed:`, err.message)
    }
  }

  return results
}

module.exports = { fetchOfac }
