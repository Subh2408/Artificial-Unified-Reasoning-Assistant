/**
 * Tracks situation state changes over time for evolution visualization.
 * Events: created, updated, severity_upgrade, archived, reactivated
 */
const { readFile, writeFile } = require('../lib/storage')

const MAX_PER_SITUATION = 100
const MAX_TOTAL = 500

function appendSituationHistory(situation, event, reason) {
  if (!situation || !situation.id) return

  const store = readFile('situation_history')
  const key = situation.id

  if (!store[key]) store[key] = []

  store[key].push({
    timestamp: new Date().toISOString(),
    event: event || 'updated',
    severity: situation.severity,
    confidence: situation.confidence,
    signalCount: situation.signalCount || (situation.signalIds || []).length,
    title: situation.title,
    reason: reason || null,
  })

  // Cap per situation
  if (store[key].length > MAX_PER_SITUATION) {
    store[key] = store[key].slice(-MAX_PER_SITUATION)
  }

  // Cap total entries
  const totalEntries = Object.values(store).reduce((sum, arr) => sum + arr.length, 0)
  if (totalEntries > MAX_TOTAL) {
    const largest = Object.entries(store).sort((a, b) => b[1].length - a[1].length)[0]
    if (largest) store[largest[0]] = largest[1].slice(-50)
  }

  writeFile('situation_history', store)
}

module.exports = { appendSituationHistory }
