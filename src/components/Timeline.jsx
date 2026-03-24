import { useState } from 'react'
import { SRC_DOT } from '../constants/colors'
import { fmtDate, fmtDT } from '../utils/format'

export default function Timeline({ signals }) {
  const [expanded, setExpanded] = useState(null)
  const sorted = [...signals].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  return (
    <div className="timeline-section">
      <div className="tl-label">Signal Timeline</div>
      <div className="tl-track">
        <div className="tl-line" />
        <div className="tl-nodes">
          {sorted.map((sig) => (
            <button
              key={sig.id}
              className="tl-node"
              aria-label={`${sig.source} — ${fmtDate(sig.timestamp)}`}
              onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
            >
              <div className="tl-dot" style={{ background: SRC_DOT[sig.sourceType] || '#374151' }} />
              <div className="tl-dot-label">{sig.source}<br />{fmtDate(sig.timestamp)}</div>
            </button>
          ))}
        </div>
      </div>
      {expanded && (() => {
        const sig = signals.find((s) => s.id === expanded)
        return sig ? (
          <div className="tl-expanded">
            <div className="tl-expanded-title">{sig.title}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`src-badge src-${sig.sourceType.toLowerCase()}`}>{sig.sourceType}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)' }}>
                {sig.source} · {fmtDT(sig.timestamp)}
              </span>
            </div>
            {sig.description}
          </div>
        ) : null
      })()}
    </div>
  )
}
