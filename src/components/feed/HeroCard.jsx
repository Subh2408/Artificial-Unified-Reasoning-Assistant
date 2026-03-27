import { SEV_COLORS } from '../../constants/colors'
import { timeAgo } from '../../utils/format'

export default function HeroCard({ sit, selected, dept, actionRegs, onClick }) {
  const interp = sit.interpretations[dept] || null
  const headline = interp?.headline || sit.subtitle
  const actions = interp?.actions || []
  const hasActionRegs = actionRegs.length > 0

  return (
    <div
      className={`hero-card ${selected ? 'selected' : ''}`}
      style={{ borderLeftColor: SEV_COLORS[sit.severity], borderLeftWidth: 4 }}
      onClick={onClick}
    >
      <div className="hero-card-body">
        <div className="hero-card-eyebrow">
          {sit.isLive && <><span className="live-dot" /><span className="live-label">LIVE</span></>}
          <span className="ts-label">{timeAgo(sit.updated)}</span>
          <span className="card-eyebrow-right">
            <span className="sev-label" style={{ color: SEV_COLORS[sit.severity] }}>{sit.severity}</span>
          </span>
        </div>
        <div className="hero-title">{sit.title}</div>
        <div className="hero-headline">{headline}</div>
        {actions.length > 0 && (
          <div className="hero-actions">
            {actions.slice(0, 2).map((a, i) => (
              <div key={`action-${i}-${a.slice(0, 20)}`} className={i === 0 ? 'hero-action hero-action-urgent' : 'hero-action'}>
                {i === 0 && (
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, background: 'var(--urgent-bg)', color: 'var(--urgent)', border: '1px solid var(--urgent-border)', padding: '1px 4px', borderRadius: 2, marginRight: 4, flexShrink: 0 }}>
                    URGENT
                  </span>
                )}
                {a}
              </div>
            ))}
          </div>
        )}
        {dept === 'underwriting' && interp?.affectedLines && (
          <div className="card-line-tags" style={{ marginTop: 8 }}>
            {interp.affectedLines.slice(0, 4).map((l) => <span key={l} className="card-line-tag">{l}</span>)}
          </div>
        )}
        {dept === 'risk_compliance' && hasActionRegs && (
          <div className="card-footer"><span className="card-reg-icon">⚖</span></div>
        )}
      </div>
    </div>
  )
}
