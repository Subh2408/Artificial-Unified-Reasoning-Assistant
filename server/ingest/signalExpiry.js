/**
 * Signal expiry — marks pending signals older than 7 days as expired.
 * Runs daily at midnight Doha time (21:00 UTC).
 * Signals assigned to active situations are exempt.
 */
const { readArray, writeArray } = require('../lib/storage')

const EXPIRY_DAYS = 7

function expireStaleSignals() {
  const signals = readArray('signals')
  const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000
  let expired = 0

  const updated = signals.map(sig => {
    if (sig.disposition === 'pending' && new Date(sig.timestamp).getTime() < cutoff) {
      expired++
      return { ...sig, disposition: 'expired', dispositionAt: new Date().toISOString() }
    }
    return sig
  })

  if (expired) {
    writeArray('signals', updated)
    console.log(`[expiry] expired ${expired} stale signals (older than ${EXPIRY_DAYS} days)`)
  } else {
    console.log('[expiry] no signals to expire')
  }

  return expired
}

module.exports = { expireStaleSignals }
