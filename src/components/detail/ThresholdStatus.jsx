import { useState, useEffect } from 'react'
import { getThresholdAlerts, evaluateThresholds } from '../../api/client'

const BADGE_STYLES = {
  low:     { bg: 'var(--surface-2)', color: 'var(--ink-4)', border: 'var(--border)' },
  medium:  { bg: 'var(--caution-bg)', color: 'var(--caution)', border: 'var(--caution-border)' },
  caution: { bg: 'var(--caution-bg)', color: 'var(--caution)', border: 'var(--caution-border)' },
  alert:   { bg: 'var(--urgent-bg)', color: 'var(--urgent)', border: 'var(--urgent-border)' },
  breach:  { bg: 'var(--urgent)', color: '#fff', border: 'var(--urgent)' },
}

const BAR_COLORS = {
  low: 'var(--ink-4)', medium: 'var(--caution)', caution: 'var(--caution)', alert: 'var(--urgent)', breach: 'var(--urgent)',
}

export default function ThresholdStatus({ situationId, deptKey, situation }) {
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = async () => {
    setError(false)
    try {
      const cached = await getThresholdAlerts(situationId, deptKey)
      if (cached) { setAlerts(cached); return }
      setLoading(true)
      const result = await evaluateThresholds(situation, deptKey)
      setAlerts(result)
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    setAlerts(null); setLoading(false); setError(false)
    load()
  }, [situationId, deptKey])

  // Don't render if no alerts and not loading
  if (!loading && !error && (!alerts || !alerts.length)) return null

  const hasBreach = alerts?.some((a) => a.impact_level === 'breach')

  return (
    <div className={`threshold-section ${hasBreach ? 'breach' : ''}`}>
      <div className="threshold-label">THRESHOLD STATUS</div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ai-loading" style={{ transform: 'scale(.7)' }}><span /><span /><span /></div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--ink-4)' }}>Evaluating thresholds...</span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--urgent)' }}>Could not evaluate thresholds.</span>
          <button className="detail-action-btn" onClick={load}>Retry</button>
        </div>
      )}

      {alerts && alerts.map((a) => {
        const badge = BADGE_STYLES[a.impact_level] || BADGE_STYLES.low
        const barColor = BAR_COLORS[a.impact_level] || 'var(--ink-4)'
        const isBreach = a.impact_level === 'breach'
        const isHighPriority = a.impact_level === 'alert' || isBreach

        return (
          <div key={a.id} className="threshold-row">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="threshold-name">{a.label}</span>
              <span className={`threshold-badge threshold-badge-${a.impact_level}`}
                style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                {a.impact_level.toUpperCase()}
              </span>
            </div>
            <div className="threshold-bar-wrap">
              <div
                className={`threshold-bar-fill ${isBreach ? 'breach' : ''}`}
                style={{ width: `${Math.min(a.estimated_pct, 100)}%`, background: barColor }}
              />
            </div>
            <div className="threshold-reasoning">{a.reasoning}</div>
            <div className={`threshold-action ${isHighPriority ? 'high-priority' : ''}`}>→ {a.action}</div>
            {a.confidence < 80 && (
              <div className="threshold-confidence">Confidence: {a.confidence}%</div>
            )}
          </div>
        )
      })}

      <div className="threshold-disclaimer">
        Estimated impact based on situation intelligence. Validate against actual book exposure before acting.
      </div>
    </div>
  )
}
