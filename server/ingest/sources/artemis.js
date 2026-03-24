/**
 * Artemis.bm RSS — Insurance-linked securities, cat bonds, reinsurance market
 * Relevant to: Reinsurance
 */
const Parser = require('rss-parser')

const ARTEMIS_URL = 'https://www.artemis.bm/feed/'

async function fetchArtemis() {
  const parser = new Parser()
  try {
    const feed = await parser.parseURL(ARTEMIS_URL)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // last 7 days
    return feed.items
      .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)
      .map((item) => ({
        source: 'ARTEMIS',
        title: item.title || '',
        snippet: item.contentSnippet?.substring(0, 300) || '',
        timestamp: item.isoDate || new Date().toISOString(),
        link: item.link || '',
        rawGeography: 'Global',
      }))
  } catch (err) {
    console.warn('[artemis] fetch failed:', err.message)
    return []
  }
}

module.exports = { fetchArtemis }
