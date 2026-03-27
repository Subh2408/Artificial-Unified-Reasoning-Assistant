import { SEV_COLORS, SRC_DOT } from '../../constants/colors'
import { timeAgo, fmtDate, fmtDT } from '../../utils/format'

export function SitCard({ sit, selected, dept, actionRegs, onClick }) {
  const interp = sit.interpretations[dept] || null
  const headline = interp?.headline || sit.subtitle
  const hasActionReg = actionRegs.length > 0

  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="card-sev-bar" style={{ background: SEV_COLORS[sit.severity] }} />
      <div className="card-body">
        <div className="card-eyebrow">
          {sit.isLive && <><span className="live-dot" /><span className="live-label">LIVE</span></>}
          <span className="ts-label">{timeAgo(sit.updated)}</span>
          <span className="card-eyebrow-right">
            <span className="sev-label" style={{ color: SEV_COLORS[sit.severity] }}>{sit.severity}</span>
          </span>
        </div>
        <div className="card-title">{sit.title}</div>
        <div className="card-headline">{headline}</div>
        {dept === 'underwriting' && interp?.affectedLines && (
          <div className="card-line-tags">
            {interp.affectedLines.slice(0, 4).map((l) => <span key={l} className="card-line-tag">{l}</span>)}
          </div>
        )}
        {dept === 'risk_compliance' && hasActionReg && (
          <div className="card-footer"><span className="card-reg-icon">⚖</span></div>
        )}
      </div>
    </div>
  )
}

export function SignalCard({ sig, selected, onClick }) {
  const desc = sig.description || ''
  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="card-sev-bar" style={{ background: SRC_DOT[sig.sourceType] || '#374151' }} />
      <div className="card-body">
        <div className="card-eyebrow">
          <span className={`src-badge src-${sig.sourceType.toLowerCase()}`}>{sig.sourceType}</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)' }}>{sig.source}</span>
          <span className="ts-label">{fmtDT(sig.timestamp)}</span>
        </div>
        <div className="card-title" style={{ fontFamily: 'DM Sans' }}>{sig.title}</div>
        <div className="card-headline">{desc.length > 100 ? desc.substring(0, 100) + '…' : desc}</div>
      </div>
    </div>
  )
}

export function RegCard({ reg, selected, onClick }) {
  const urgCls = { ACTION: 'urgency-action', MONITOR: 'urgency-monitor', INFO: 'urgency-info' }[reg.urgency] || 'urgency-info'

  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="card-sev-bar" style={{ background: reg.urgency === 'ACTION' ? 'var(--urgent)' : 'var(--reg)' }} />
      <div className="reg-card-body">
        <div className="card-eyebrow">
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--reg-light)', color: 'var(--reg)', padding: '2px 5px', borderRadius: 2 }}>{reg.jurisdiction}</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)' }}>{reg.regulator}</span>
          <span className={`tag ${urgCls}`} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>{reg.urgency}</span>
        </div>
        <div className="card-title" style={{ fontFamily: 'DM Sans' }}>{reg.title}</div>
        <div className="card-headline">{reg.summary.length > 110 ? reg.summary.substring(0, 110) + '…' : reg.summary}</div>
        <div className="card-tags">
          <span className="tag src-regulatory">{reg.changeType}</span>
          <span className="ts-label">Effective: {fmtDate(reg.effectiveDate)}</span>
        </div>
      </div>
    </div>
  )
}
