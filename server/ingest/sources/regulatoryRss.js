/**
 * Regulatory source pipeline — Qatar, GCC, and international regulators.
 * Priority: QCB → QFCRA → QFMA → CBUAE → SAMA → OFAC
 * Approach: Try RSS first, GDELT as universal fallback.
 */
const Parser = require('rss-parser')

// ── Source configurations ────────────────────────────────────────────────────
// Each source: RSS URL (may be null), GDELT query, and metadata.
// RSS is attempted first; if it fails or returns nothing, GDELT is used.

const SOURCES = [
  // ── Qatar (core) ──
  { rss: null,
    gdelt: '"Qatar Central Bank" insurance regulation',
    regulator: 'QCB', regulatorFull: 'Qatar Central Bank',
    jurisdiction: 'Qatar', jurisdictionCode: 'QAT' },
  { rss: null,
    gdelt: 'QFCRA "Qatar Financial Centre" regulation insurance',
    regulator: 'QFCRA', regulatorFull: 'Qatar Financial Centre Regulatory Authority',
    jurisdiction: 'Qatar (QFC)', jurisdictionCode: 'QFC' },
  { rss: null,
    gdelt: 'QFMA Qatar insurance regulation',
    regulator: 'QFMA', regulatorFull: 'Qatar Financial Markets Authority',
    jurisdiction: 'Qatar', jurisdictionCode: 'QAT' },

  // ── GCC ──
  { rss: null,
    gdelt: 'CBUAE "Central Bank" UAE insurance regulation',
    regulator: 'CBUAE', regulatorFull: 'Central Bank of the UAE',
    jurisdiction: 'UAE', jurisdictionCode: 'UAE' },
  { rss: null,
    gdelt: 'SAMA "Saudi Central Bank" insurance reinsurance regulation',
    regulator: 'SAMA', regulatorFull: 'Saudi Central Bank',
    jurisdiction: 'Saudi Arabia', jurisdictionCode: 'KSA' },
  { rss: null,
    gdelt: 'Sanadak UAE insurance ombudsman dispute',
    regulator: 'Sanadak', regulatorFull: 'UAE Financial and Insurance Ombudsman',
    jurisdiction: 'UAE', jurisdictionCode: 'UAE' },
  { rss: null,
    gdelt: '"Central Bank of Bahrain" insurance regulation',
    regulator: 'CBB', regulatorFull: 'Central Bank of Bahrain',
    jurisdiction: 'Bahrain', jurisdictionCode: 'BHR' },

  // ── International (directly cited in Qatar frameworks) ──
  { rss: 'https://home.treasury.gov/rss.xml',
    gdelt: 'OFAC sanctions designation insurance',
    regulator: 'OFAC', regulatorFull: 'US Treasury / OFAC',
    jurisdiction: 'International', jurisdictionCode: 'INT',
    keywords: ['sanction', 'ofac', 'sdn', 'designation', 'iran', 'insurance'] },
  { rss: null,
    gdelt: 'IAIS "insurance supervisors" standard guidance',
    regulator: 'IAIS', regulatorFull: 'International Association of Insurance Supervisors',
    jurisdiction: 'International', jurisdictionCode: 'INT' },
  { rss: null,
    gdelt: 'IFRS IASB "IFRS 17" insurance accounting standard',
    regulator: 'IASB', regulatorFull: 'International Accounting Standards Board',
    jurisdiction: 'International', jurisdictionCode: 'INT' },
  { rss: null,
    gdelt: 'FATF "money laundering" insurance AML',
    regulator: 'FATF', regulatorFull: 'Financial Action Task Force',
    jurisdiction: 'International', jurisdictionCode: 'INT' },
  { rss: null,
    gdelt: 'LMA "Lloyd\'s Market Association" bulletin insurance',
    regulator: 'LMA', regulatorFull: "Lloyd's Market Association",
    jurisdiction: 'International', jurisdictionCode: 'INT' },
  { rss: null,
    gdelt: '"UN Security Council" sanctions resolution',
    regulator: 'UNSC', regulatorFull: 'UN Security Council',
    jurisdiction: 'International', jurisdictionCode: 'INT' },
]

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

function parseGdeltDate(seendate) {
  if (!seendate) return new Date().toISOString().split('T')[0]
  const m = seendate.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : new Date().toISOString().split('T')[0]
}

async function fetchRegulatorRss() {
  const parser = new Parser({
    timeout: 12000,
    headers: { 'User-Agent': 'AURA/1.0 Insurance Regulatory Monitor' },
  })
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days
  const results = []

  let gdeltCount = 0
  for (const src of SOURCES) {
    let gotRss = false

    // ── Try RSS first ──
    if (src.rss) {
      try {
        const feed = await parser.parseURL(src.rss)
        let items = feed.items
          .filter((item) => new Date(item.isoDate || item.pubDate).getTime() > cutoff)

        // Keyword filter for sources like OFAC (lots of non-relevant items)
        if (src.keywords) {
          items = items.filter((item) => {
            const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase()
            return src.keywords.some((kw) => text.includes(kw))
          })
        }

        const mapped = items.slice(0, 5).map((item) => ({
          regulator: src.regulator,
          regulatorFull: src.regulatorFull,
          jurisdiction: src.jurisdiction,
          jurisdictionCode: src.jurisdictionCode,
          title: item.title || '',
          snippet: item.contentSnippet?.substring(0, 400) || '',
          publishedDate: item.isoDate ? item.isoDate.split('T')[0] : new Date().toISOString().split('T')[0],
          link: item.link || '',
        }))

        if (mapped.length) {
          results.push(...mapped)
          gotRss = true
          console.log(`[regulatoryRss] ${src.regulator}: ${mapped.length} items via RSS`)
        }
      } catch (err) {
        console.warn(`[regulatoryRss] ${src.regulator} RSS failed:`, err.message)
      }
    }

    // ── GDELT fallback (with rate-limit delay) ──
    if (!gotRss && src.gdelt) {
      if (gdeltCount > 0) await new Promise((r) => setTimeout(r, 2000)) // 2s delay between GDELT calls
      gdeltCount++
      try {
        const params = new URLSearchParams({
          query: src.gdelt,
          mode: 'artlist',
          maxrecords: '5',
          format: 'json',
          timespan: '30d',
          sourcelang: 'english',
        })
        const res = await fetch(`${GDELT_BASE}?${params}`, { signal: AbortSignal.timeout(15000) })
        if (res.ok) {
          const data = await res.json()
          const articles = (data.articles || []).slice(0, 3)
          for (const a of articles) {
            results.push({
              regulator: src.regulator,
              regulatorFull: src.regulatorFull,
              jurisdiction: src.jurisdiction,
              jurisdictionCode: src.jurisdictionCode,
              title: a.title || '',
              snippet: '',
              publishedDate: parseGdeltDate(a.seendate),
              link: a.url || '',
            })
          }
          if (articles.length) {
            console.log(`[regulatoryRss] ${src.regulator}: ${articles.length} items via GDELT`)
          }
        }
      } catch (err) {
        console.warn(`[regulatoryRss] ${src.regulator} GDELT failed:`, err.message)
      }
    }
  }

  console.log(`[regulatoryRss] total: ${results.length} regulatory items from ${SOURCES.length} sources`)
  return results
}

module.exports = { fetchRegulatorRss }
