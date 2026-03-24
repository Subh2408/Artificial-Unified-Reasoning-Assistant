import { SEV_COLORS } from '../../constants/colors'
import { fmtDT } from '../../utils/format'

export default function SignalDetail({ sig, allSituations, onSelectSituation }) {
  const parentSit = allSituations.find((s) => s.signalIds.includes(sig.id))

  return (
    <>
      <div className="detail-header">
        <div className="card-eyebrow" style={{ marginBottom: 10 }}>
          <span className={`src-badge src-${sig.sourceType.toLowerCase()}`}>{sig.sourceType}</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)' }}>{sig.source}</span>
          <span className="ts-label">{fmtDT(sig.timestamp)}</span>
        </div>
        <div className="detail-title" style={{ fontSize: 18 }}>{sig.title}</div>
        <div className="detail-meta-row" style={{ marginTop: 8 }}>
          <span className="detail-meta-item"><strong>Geography</strong> {sig.geography}</span>
        </div>
      </div>

      {parentSit && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLORS[parentSit.severity], flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>Feeds situation</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{parentSit.title}</div>
          </div>
          <button
            onClick={() => onSelectSituation(parentSit)}
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 3, padding: '3px 8px', cursor: 'pointer', letterSpacing: '.04em' }}
          >
            Open →
          </button>
        </div>
      )}

      <div className="brief-section">
        <div className="brief-detail" style={{ fontSize: 14, lineHeight: 1.65 }}>{sig.description}</div>
        <div className="card-tags" style={{ marginTop: 10 }}>
          {(sig.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>
    </>
  )
}
