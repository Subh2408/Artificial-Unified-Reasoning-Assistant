import { useState } from 'react'

export default function RegActionBanner({ regs, dept, onViewReg }) {
  const [expanded, setExpanded] = useState(regs.length === 1)
  if (dept !== 'risk_compliance') return null
  if (!regs.length) return null

  const impField = dept === 'risk_compliance' ? 'complianceImplication' : 'claimsImplication'

  return (
    <div className="reg-action-banner">
      <div className="rab-header">
        <span className="rab-icon">⚖</span>
        <span className="rab-title">Regulatory Action Required — {regs.length} update{regs.length > 1 ? 's' : ''}</span>
        {regs.length > 1 && (
          <button className="rab-expand" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        )}
      </div>
      {expanded && regs.map((r) => (
        <div key={r.id} className="rab-item">
          <div className="rab-item-title">{r.title}</div>
          <div className="rab-item-imp">{r[impField]?.length > 180 ? r[impField].substring(0, 180) + '…' : r[impField]}</div>
          <button className="rab-item-link" onClick={() => onViewReg(r)}>View full regulation →</button>
        </div>
      ))}
      {!expanded && (
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--urgent)', opacity: .7 }}>
          {regs.map((r) => r.jurisdiction).join(' · ')}
        </div>
      )}
    </div>
  )
}
