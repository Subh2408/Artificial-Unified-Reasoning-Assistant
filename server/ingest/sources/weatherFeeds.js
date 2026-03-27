/**
 * Weather, catastrophe & Qatar news feeds — nat-cat event monitoring + local news.
 * RSS sources: The Watchers, ReliefWeb, FloodList, Google News (Qatar queries)
 * Scrape sources: Peninsula Qatar, QNA (headline extraction from homepage)
 * Relevant to: Claims, Reinsurance (cat events), Property
 */
const Parser = require('rss-parser')

const SOURCES = [
  // ── RSS feeds ──
  { name: 'THE WATCHERS',              url: 'https://watchers.news/feed/',           category: 'NAT CAT' },
  { name: 'RELIEFWEB',                 url: 'https://reliefweb.int/updates/rss.xml', category: 'OFFICIAL' },
  { name: 'FLOODLIST',                 url: 'http://floodlist.com/feed',             category: 'NAT CAT' },
  { name: 'GOOGLE NEWS QATAR WEATHER', url: 'https://news.google.com/rss/search?q=qatar+doha+flood+OR+rain+OR+ashghal&hl=en', category: 'NEWS' },
  { name: 'GOOGLE NEWS QATAR EMERGENCY', url: 'https://news.google.com/rss/search?q=qatar+weather+emergency&hl=en&gl=QA&ceid=QA:en', category: 'NEWS' },

  // ── Scrape (extract headlines from homepage HTML) ──
  { name: 'PENINSULA QATAR', url: 'https://thepeninsulaqatar.com', category: 'NEWS',     type: 'scrape' },
  { name: 'QNA',             url: 'https://www.qna.org.qa/en',    category: 'OFFICIAL',  type: 'scrape' },
]

const FETCH_OPTS = {
  headers: { 'User-Agent': 'AURA/1.0 Insurance Intelligence Platform' },
  signal: AbortSignal.timeout(15000),
}

async function fetchRssSources(parser, cutoff) {
  const rssSources = SOURCES.filter((s) => s.type !== 'scrape')
  const items = []

  for (const src of rssSources) {
    try {
      const feed = await parser.parseURL(src.url)
      const recent = feed.items
        .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)
        .slice(0, 10)
        .map((item) => ({
          source: src.name,
          sourceType: src.category,
          title: item.title || '',
          snippet: item.contentSnippet?.substring(0, 300) || '',
          timestamp: item.isoDate || new Date().toISOString(),
          link: item.link || '',
          rawGeography: 'Global',
        }))
      items.push(...recent)
    } catch (err) {
      console.warn(`[weatherFeeds] ${src.name} failed:`, err.message)
    }
  }

  return items
}

async function fetchScrapeSources() {
  const scrapeSources = SOURCES.filter((s) => s.type === 'scrape')
  const headingRegex = /<(?:h[2-6]|a)[^>]*>([^<]{15,120})<\/(?:h[2-6]|a)>/gi
  const items = []

  for (const src of scrapeSources) {
    try {
      const res = await fetch(src.url, FETCH_OPTS)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()

      const titles = []
      let match
      while ((match = headingRegex.exec(html)) !== null && titles.length < 15) {
        const text = match[1].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').trim()
        if (text.length >= 15) titles.push(text)
      }

      const scraped = titles.slice(0, 10).map((title) => ({
        source: src.name,
        sourceType: src.category,
        title,
        snippet: '',
        timestamp: new Date().toISOString(),
        link: src.url,
        rawGeography: 'Global',
      }))
      items.push(...scraped)
    } catch (err) {
      console.warn(`[weatherFeeds] ${src.name} scrape failed:`, err.message)
    }
  }

  return items
}

async function fetchWeatherFeeds() {
  const parser = new Parser({
    timeout: 12000,
    headers: { 'User-Agent': 'AURA/1.0 Insurance Intelligence Platform' },
  })
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // last 7 days

  const [rssItems, scrapeItems] = await Promise.allSettled([
    fetchRssSources(parser, cutoff),
    fetchScrapeSources(),
  ])

  const items = [
    ...(rssItems.status === 'fulfilled' ? rssItems.value : []),
    ...(scrapeItems.status === 'fulfilled' ? scrapeItems.value : []),
  ]

  console.log(`[weatherFeeds] fetched ${items.length} items from ${SOURCES.length} sources`)
  return items
}

module.exports = { fetchWeatherFeeds }
