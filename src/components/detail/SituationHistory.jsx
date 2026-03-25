import { useState, useEffect } from 'react'
import { getSituationHistory } from '../../api/client'
import { SEV_COLORS } from '../../constants/colors'
import { fmtDate } from '../../utils/format'

const SEV_Y = { WATCH: 0, ELEVATED: 1, ACTIVE: 2, CRITICAL: 3 }

export default function SituationHistory({ situationId }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    getSituationHistory(situationId).then(setHistory).catch(() => setHistory(null))
  }, [situationId])

  // Render nothing if < 2 data points — completely invisible
  if (!history || history.length < 2) return null

  const maxSignals = Math.max(...history.map((h) => h.signalCount || 0), 1)

  return (
    <div className="sit-history-section">
      <div className="sit-history-label">SITUATION EVOLUTION</div>
      <div className="sit-history-track">
        {history.map((h, i) => {
          const sevLevel = SEV_Y[h.severity] ?? 1
          const bottom = (sevLevel / 3) * 100
          const color = SEV_COLORS[h.severity] || 'var(--ink-4)'
          const prevSev = i > 0 ? (SEV_Y[history[i - 1].severity] ?? 1) : sevLevel
          const escalated = sevLevel > prevSev

          return (
            <div key={i} className="sit-history-point" style={{ left: `${(i / (history.length - 1)) * 100}%` }}>
              {/* Connecting line to previous point */}
              {i > 0 && (
                <div
                  className="sit-history-line"
                  style={{
                    bottom: `${(Math.min(prevSev, sevLevel) / 3) * 100}%`,
                    height: `${(Math.abs(sevLevel - prevSev) / 3) * 100}%`,
                    background: escalated ? 'var(--urgent)' : color,
                    left: '-50%',
                    width: '100%',
                  }}
                />
              )}
              <div
                className={`sit-history-dot ${escalated ? 'escalated' : ''}`}
                style={{ bottom: `${bottom}%`, background: color, borderColor: escalated ? 'var(--urgent)' : color }}
                title={`${fmtDate(h.timestamp)} — ${h.severity} (${h.confidence}%) — ${h.signalCount} signals`}
              />
              <div className="sit-history-date" style={{ bottom: '-18px' }}>{fmtDate(h.timestamp)}</div>
            </div>
          )
        })}
        {/* Y-axis labels */}
        <div className="sit-history-y-labels">
          {['WATCH', 'ELEVATED', 'ACTIVE', 'CRITICAL'].map((sev, i) => (
            <span key={sev} style={{ bottom: `${(i / 3) * 100}%`, color: SEV_COLORS[sev] }}>{sev}</span>
          ))}
        </div>
      </div>

      {/* Latest change summary */}
      {history.length >= 2 && (() => {
        const latest = history[history.length - 1]
        const prev = history[history.length - 2]
        const sevChanged = latest.severity !== prev.severity
        const confChanged = latest.confidence !== prev.confidence
        if (!sevChanged && !confChanged) return null
        return (
          <div className="sit-history-summary">
            {sevChanged && <span>Severity: {prev.severity} → <strong style={{ color: SEV_COLORS[latest.severity] }}>{latest.severity}</strong></span>}
            {confChanged && <span>Confidence: {prev.confidence}% → {latest.confidence}%</span>}
            <span>{latest.signalCount} signals tracked</span>
          </div>
        )
      })()}
    </div>
  )
}
