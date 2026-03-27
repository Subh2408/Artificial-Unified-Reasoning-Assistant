/**
 * Ingest scheduler — registers cron jobs and exports runAll() for manual triggers.
 * Called once from server/index.js: require('./ingest/scheduler')
 */
require('dotenv').config()
const cron = require('node-cron')

const { ingestSignals, ingestRegulations } = require('./pipeline')
const { synthesizeOne } = require('./synthesize')
const { generateSituations } = require('./situationGenerator')
const { fetchGdacs }          = require('./sources/gdacs')
const { fetchArtemis }        = require('./sources/artemis')
const { fetchInsuranceFeeds } = require('./sources/insuranceJournal')
const { fetchGdelt }          = require('./sources/gdelt')
const { fetchOfac }           = require('./sources/ofac')
const { fetchRegulatorRss }   = require('./sources/regulatoryRss')
const { fetchFred }           = require('./sources/fred')
const { fetchWeatherFeeds }   = require('./sources/weatherFeeds')
const { expireStaleSignals }  = require('./signalExpiry')
const { retireStaleSituations } = require('./situationRetirement')

// ── Source runners ────────────────────────────────────────────────────────────

async function runSignalSources() {
  try {
    const [gdacs, artemis, insurance, ofac, fred, weather] = await Promise.allSettled([
      fetchGdacs(),
      fetchArtemis(),
      fetchInsuranceFeeds(),
      fetchOfac(),
      fetchFred(),
      fetchWeatherFeeds(),
    ])

    const allSignals = [
      ...(gdacs.status     === 'fulfilled' ? gdacs.value     : []),
      ...(artemis.status   === 'fulfilled' ? artemis.value   : []),
      ...(insurance.status === 'fulfilled' ? insurance.value : []),
      ...(ofac.status      === 'fulfilled' ? ofac.value      : []),
      ...(fred.status      === 'fulfilled' ? fred.value      : []),
      ...(weather.status   === 'fulfilled' ? weather.value   : []),
    ]

    if (allSignals.length) {
      const { updatedSitIds, hasFlagged } = await ingestSignals(allSignals)

      // Auto-synthesize situations that received new matched signals
      for (const sitId of updatedSitIds) {
        try {
          await synthesizeOne(sitId)
        } catch (err) {
          console.error(`[scheduler] synthesize ${sitId} failed:`, err.message)
        }
      }

      // If any signal scored >= 15 (flagged), trigger immediate situation generation
      if (hasFlagged) {
        console.log('[scheduler] flagged signals detected — triggering immediate situation generation')
        try {
          await generateSituations()
        } catch (err) {
          console.error('[scheduler] flagged generation failed:', err.message)
        }
      }
    } else {
      console.log('[scheduler] signals: no new items from any source')
    }
  } catch (err) {
    console.error('[scheduler] signal sources error:', err.message)
  }
}

async function runRegulatorySources() {
  try {
    const items = await fetchRegulatorRss()
    if (items.length) {
      await ingestRegulations(items)
    } else {
      console.log('[scheduler] regulations: no new items')
    }
  } catch (err) {
    console.error('[scheduler] regulatory sources error:', err.message)
  }
}

// ── Bootstrap synthesis on first run ─────────────────────────────────────────

const { readArray, readFile } = require('../lib/storage')

async function bootstrapSynthesis() {
  try {
    const signals   = readArray('signals')
    const overrides = readFile('situation_overrides')
    const sitIds = [...new Set(signals.map((s) => s.situationId).filter(Boolean))]
    const pending = sitIds.filter((id) => !overrides[id])
    if (!pending.length) return
    console.log(`[scheduler] bootstrap synthesis for: ${pending.join(', ')}`)
    for (const sitId of pending) {
      try {
        await synthesizeOne(sitId)
      } catch (err) {
        console.error(`[scheduler] bootstrap synthesize ${sitId} failed:`, err.message)
      }
    }
  } catch (err) {
    console.error('[scheduler] bootstrapSynthesis error:', err.message)
  }
}

// ── Daily maintenance ────────────────────────────────────────────────────────

async function runDailyMaintenance() {
  console.log('[scheduler] daily maintenance started')
  try {
    expireStaleSignals()
    retireStaleSituations()
  } catch (err) {
    console.error('[scheduler] daily maintenance error:', err.message)
  }
  console.log('[scheduler] daily maintenance complete')
}

// ── runAll — for manual trigger ───────────────────────────────────────────────

async function runAll() {
  console.log('[scheduler] manual run triggered')
  await Promise.allSettled([runSignalSources(), runRegulatorySources()])
  // Generate AI situations from signal clusters
  try {
    await generateSituations()
  } catch (err) {
    console.error('[scheduler] situation generation failed:', err.message)
  }
  console.log('[scheduler] manual run complete')
}

// ── Force generate — bypasses cooldown for /api/ingest/trigger ──

async function forceGenerate() {
  console.log('[scheduler] force generate triggered (cooldown bypass)')
  await Promise.allSettled([runSignalSources(), runRegulatorySources()])
  try {
    await generateSituations(true) // forceBypass = true
  } catch (err) {
    console.error('[scheduler] force generation failed:', err.message)
  }
  console.log('[scheduler] force generate complete')
}

// ── Cron registration ─────────────────────────────────────────────────────────

// Every 30 minutes — signal sources (GDACS, Artemis, Insurance Journal, OFAC, FRED, Weather)
cron.schedule('*/30 * * * *', () => {
  console.log('[scheduler] signal cron fired')
  runSignalSources().catch(err => console.error('[scheduler] signal cron error:', err.message))
})

// Every 6 hours — regulatory sources
cron.schedule('0 */6 * * *', () => {
  console.log('[scheduler] regulation cron fired')
  runRegulatorySources().catch(err => console.error('[scheduler] regulation cron error:', err.message))
})

// Every 6 hours — GDELT (rate-limited)
cron.schedule('30 */6 * * *', async () => {
  console.log('[scheduler] GDELT cron fired')
  try {
    const items = await fetchGdelt()
    if (items.length) await ingestSignals(items)
  } catch (err) {
    console.error('[scheduler] GDELT cron error:', err.message)
  }
})

// Daily at midnight Doha time (21:00 UTC) — signal expiry + situation retirement
cron.schedule('0 21 * * *', () => {
  console.log('[scheduler] daily maintenance cron fired')
  runDailyMaintenance().catch(err => console.error('[scheduler] maintenance cron error:', err.message))
})

// Run once on startup (after a short delay to let the server start)
setTimeout(async () => {
  try {
    console.log('[scheduler] startup ingest run')
    await runAll()
  } catch (err) {
    console.error('[scheduler] startup ingest error:', err.message)
  }
}, 5000)

console.log('[scheduler] cron jobs registered (signals: */30min, regulations: */6h, GDELT: */6h, maintenance: daily 21:00 UTC)')

module.exports = { runAll, forceGenerate }
