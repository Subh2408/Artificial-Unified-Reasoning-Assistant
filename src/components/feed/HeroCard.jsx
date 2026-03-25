import { SEV_COLORS } from '../../constants/colors'
import { timeAgo } from '../../utils/format'

export default function HeroCard({ sit, selected, dept, actionRegs, onClick, thresholdAlert }) {
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
          {sit.isLive && <span className="live-badge">LIVE</span>}
          <span className="sev-label" style={{ color: SEV_COLORS[sit.severity] }}>{sit.severity}</span>
          {hasActionRegs && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--urgent-bg)', color: 'var(--urgent)', border: '1px solid var(--urgent-border)', padding: '2px 5px', borderRadius: 2 }}>
              ⚖ REG ACTION
            </span>
          )}
          {thresholdAlert === 'breach' && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--urgent)', color: '#fff', padding: '2px 5px', borderRadius: 2 }}>BREACH</span>}
          {thresholdAlert === 'alert' && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--caution-bg)', color: 'var(--caution)', border: '1px solid var(--caution-border)', padding: '2px 5px', borderRadius: 2 }}>THRESHOLD</span>}
          <span className="ts-label">{timeAgo(sit.updated)}</span>
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
      </div>
    </div>
  )
}
