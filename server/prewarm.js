/**
 * Pre-warm script: generates AI implications for all regulations so no user ever sees loading.
 * Run once: cd server && node prewarm.js
 */
require('dotenv').config()

// Load regulations from the frontend data file
const path = require('path')
const fs = require('fs')
const regPath = path.join(__dirname, '..', 'src', 'data', 'regulations.js')
const regSource = fs.readFileSync(regPath, 'utf8')

// Extract the array from the CommonJS module
const match = regSource.match(/const REGULATIONS\s*=\s*(\[[\s\S]*?\]);/)
if (!match) { console.error('Could not parse regulations.js'); process.exit(1) }
const REGULATIONS = eval(match[1])

const { readFile, writeFile } = require('./lib/storage')

const PORT = process.env.PORT || 3001
const BASE = `http://localhost:${PORT}/api`

async function prewarm() {
  const store = readFile('reg_implications')
  const uncached = REGULATIONS.filter((r) => !store[r.id])

  if (!uncached.length) {
    console.log('All implications already cached. Nothing to do.')
    process.exit(0)
  }

  console.log(`${uncached.length} of ${REGULATIONS.length} regulations need implications.\n`)

  for (let i = 0; i < uncached.length; i++) {
    const reg = uncached[i]
    console.log(`[${i + 1}/${uncached.length}] Generating: ${reg.title.substring(0, 60)}...`)

    try {
      const res = await fetch(`${BASE}/generate-reg-implications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regId: reg.id,
          title: reg.title,
          jurisdiction: reg.jurisdiction,
          regulator: reg.regulatorFull || reg.regulator,
          effectiveDate: reg.effectiveDate,
          changeType: reg.changeType,
          summary: reg.summary,
          claimsImplication: reg.claimsImplication,
          complianceImplication: reg.complianceImplication,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(`  FAILED: ${err.error || res.status}`)
      } else {
        console.log('  OK')
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`)
    }

    // 1.5s delay between calls to avoid rate limits
    if (i < uncached.length - 1) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  console.log('\nAll implications cached. Run `node index.js` to start the server.')
}

prewarm()
