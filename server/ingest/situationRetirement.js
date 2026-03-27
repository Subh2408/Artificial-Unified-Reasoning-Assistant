/**
 * Situation retirement — archives situations that are no longer developing.
 * Runs daily at midnight Doha time (21:00 UTC).
 *
 * Retirement criteria (ALL must be true):
 * - No new signals in last 5 days
 * - Severity is WATCH or ELEVATED (not ACTIVE or CRITICAL)
 * - Confidence has not increased in last 3 generation runs
 */
const { readArray, writeArray, readFile } = require('../lib/storage')
const { appendSituationHistory } = require('./situationHistory')

const RETIREMENT_DAYS = 5

function retireStaleSituations() {
  const situations = readArray('situations_generated')
  const history = readFile('situation_history')
  const now = Date.now()
  let archived = 0
  let reactivated = 0

  const updated = situations.map(sit => {
    // Skip already archived
    if (sit.archived) return sit

    // Never auto-archive ACTIVE or CRITICAL
    if (sit.severity === 'ACTIVE' || sit.severity === 'CRITICAL') return sit

    // Check signal recency
    const lastSignal = new Date(sit.lastSignalAt || sit.updated || sit.createdAt).getTime()
    if (now - lastSignal < RETIREMENT_DAYS * 24 * 60 * 60 * 1000) return sit

    // Check confidence trend in last 3 snapshots
    const snapshots = (history[sit.id] || []).slice(-3)
    if (snapshots.length >= 2) {
      const increasing = snapshots[snapshots.length - 1].confidence > snapshots[0].confidence
      if (increasing) return sit
    }

    // All criteria met — archive
    archived++
    appendSituationHistory(sit, 'archived', `no new signals for ${RETIREMENT_DAYS} days`)
    return {
      ...sit,
      archived: true,
      archivedAt: new Date().toISOString(),
      isLive: false,
    }
  })

  if (archived) {
    writeArray('situations_generated', updated)
    console.log(`[retirement] archived ${archived} situations`)
  } else {
    console.log('[retirement] no situations to archive')
  }

  return { archived, reactivated }
}

module.exports = { retireStaleSituations }
