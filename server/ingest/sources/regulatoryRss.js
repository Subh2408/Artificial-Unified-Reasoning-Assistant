/**
 * Regulatory source pipeline — Qatar, GCC, and international regulators.
 * Three modes: RSS (direct feed), scrape (extract titles), watch (hash change detection).
 */
const Parser = require('rss-parser')
const crypto = require('crypto')
const { readFile, writeFile } = require('../../lib/storage')

const SOURCES = [
  // ── RSS (direct feed) ──
  { name: 'OFAC', type: 'rss', url: 'https://home.treasury.gov/rss.xml',
    regulator: 'OFAC', regulatorFull: 'US Treasury / OFAC',
    jurisdiction: 'International', jurisdictionCode: 'INT',
    keywords: ['sanction', 'ofac', 'sdn', 'designation', 'iran', 'insurance'] },

  // ── Scrape (fetch page, extract headings) ──
  { name: 'IAIS', type: 'scrape', url: 'https://www.iaisweb.org/news',
    regulator: 'IAIS', regulatorFull: 'International Association of Insurance Supervisors',
    jurisdiction: 'International', jurisdictionCode: 'INT' },
  { name: 'LMA', type: 'scrape', url: 'https://www.lmalloyds.com/news',
    regulator: 'LMA', regulatorFull: "Lloyd's Market Association",
    jurisdiction: 'International', jurisdictionCode: 'INT' },

  // ── Watch (hash change detection — no RSS available) ──
  { name: 'QCB', type: 'watch', url: 'https://www.qcb.gov.qa/en/SupervisionRegulation',
    regulator: 'QCB', regulatorFull: 'Qatar Central Bank',
    jurisdiction: 'Qatar', jurisdictionCode: 'QAT' },
  { name: 'QFCRA', type: 'watch', url: 'https://www.qfcra.com/en-us/legislation/',
    regulator: 'QFCRA', regulatorFull: 'Qatar Financial Centre Regulatory Authority',
    jurisdiction: 'Qatar (QFC)', jurisdictionCode: 'QFC' },
  { name: 'QFMA', type: 'watch', url: 'https://www.qfma.org.qa/En/Pages/default.aspx',
    regulator: 'QFMA', regulatorFull: 'Qatar Financial Markets Authority',
    jurisdiction: 'Qatar', jurisdictionCode: 'QAT' },
  { name: 'CBUAE', type: 'watch', url: 'https://www.centralbank.ae/en/our-operations/insurance-and-pension/',
    regulator: 'CBUAE', regulatorFull: 'Central Bank of the UAE',
    jurisdiction: 'UAE', jurisdictionCode: 'UAE' },
  { name: 'SAMA', type: 'watch', url: 'https://www.sama.gov.sa/en-US/Laws/',
    regulator: 'SAMA', regulatorFull: 'Saudi Central Bank',
    jurisdiction: 'Saudi Arabia', jurisdictionCode: 'KSA' },
  { name: 'CBB', type: 'watch', url: 'https://www.cbb.gov.bh/regulations/',
    regulator: 'CBB', regulatorFull: 'Central Bank of Bahrain',
    jurisdiction: 'Bahrain', jurisdictionCode: 'BHR' },
]

const FETCH_OPTS = {
  headers: { 'User-Agent': 'AURA/1.0 Insurance Regulatory Monitor' },
  signal: AbortSignal.timeout(15000),
}

// ── RSS handler ──

async function fetchRss(src) {
  const parser = new Parser({
    timeout: 12000,
    headers: { 'User-Agent': 'AURA/1.0 Insurance Regulatory Monitor' },
  })
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const feed = await parser.parseURL(src.url)
  let items = feed.items.filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)

  if (src.keywords) {
    items = items.filter((item) => {
      const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase()
      return src.keywords.some((kw) => text.includes(kw))
    })
  }

  return items.slice(0, 5).map((item) => ({
    regulator: src.regulator,
    regulatorFull: src.regulatorFull,
    jurisdiction: src.jurisdiction,
    jurisdictionCode: src.jurisdictionCode,
    title: item.title || '',
    snippet: item.contentSnippet?.substring(0, 400) || '',
    publishedDate: item.isoDate ? item.isoDate.split('T')[0] : new Date().toISOString().split('T')[0],
    link: item.link || '',
  }))
}

// ── Scrape handler (extract headings from HTML) ──

async function fetchScrape(src) {
  const res = await fetch(src.url, FETCH_OPTS)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Extract text from <h2>, <h3>, and <a> tags with title-like content
  const headingRegex = /<(?:h[23]|a)[^>]*>([^<]{10,120})<\/(?:h[23]|a)>/gi
  const titles = []
  let match
  while ((match = headingRegex.exec(html)) !== null && titles.length < 10) {
    const text = match[1].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').trim()
    if (text.length > 10) titles.push(text)
  }

  return titles.slice(0, 5).map((title) => ({
    regulator: src.regulator,
    regulatorFull: src.regulatorFull,
    jurisdiction: src.jurisdiction,
    jurisdictionCode: src.jurisdictionCode,
    title,
    snippet: '',
    publishedDate: new Date().toISOString().split('T')[0],
    link: src.url,
  }))
}

// ── Watch handler (hash change detection) ──

async function fetchWatch(src) {
  const res = await fetch(src.url, FETCH_OPTS)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const hash = crypto.createHash('sha256').update(html).digest('hex').substring(0, 16)
  const hashes = readFile('reg_watch_hashes')
  const prevHash = hashes[src.name]

  if (prevHash === hash) {
    return [] // no change
  }

  // Update stored hash
  hashes[src.name] = hash
  writeFile('reg_watch_hashes', hashes)

  if (!prevHash) {
    // First run — store baseline, don't alert
    console.log(`[regulatoryRss] ${src.name}: baseline hash stored`)
    return []
  }

  // Page changed — create alert
  console.log(`[regulatoryRss] ${src.name}: page content changed (hash ${prevHash} → ${hash})`)
  return [{
    regulator: src.regulator,
    regulatorFull: src.regulatorFull,
    jurisdiction: src.jurisdiction,
    jurisdictionCode: src.jurisdictionCode,
    title: `${src.regulatorFull} — page updated, review for new circulars or notices`,
    snippet: `The ${src.regulatorFull} publications page has been updated. Check ${src.url} for new regulatory content.`,
    publishedDate: new Date().toISOString().split('T')[0],
    link: src.url,
  }]
}

// ── Main function ──

async function fetchRegulatorRss() {
  const results = []

  for (const src of SOURCES) {
    try {
      let items = []
      if (src.type === 'rss') items = await fetchRss(src)
      else if (src.type === 'scrape') items = await fetchScrape(src)
      else if (src.type === 'watch') items = await fetchWatch(src)

      if (items.length) {
        results.push(...items)
        console.log(`[regulatoryRss] ${src.name}: ${items.length} items via ${src.type}`)
      }
    } catch (err) {
      console.warn(`[regulatoryRss] ${src.name} (${src.type}) failed:`, err.message)
    }
  }

  console.log(`[regulatoryRss] total: ${results.length} regulatory items from ${SOURCES.length} sources`)
  return results
}

module.exports = { fetchRegulatorRss }
