import { DEPTS } from '../../constants/depts'
import { fmtDate, fmtDT } from '../../utils/format'

export default function SnapshotDetail({ snap, onClose }) {
  const deptInfo = DEPTS.find((d) => d.key === snap.deptKey)

  return (
    <>
      <div className="detail-header">
        <div className="detail-header-actions">
          <button className="detail-action-btn" onClick={onClose}>← Back to Live</button>
        </div>
        <div className="snapshot-warning">
          ⚠ Archived snapshot — saved {fmtDT(snap.timestamp)}. Live situation may have evolved.
        </div>
        <div className="detail-title">{snap.label}</div>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>
          {deptInfo?.label} — {fmtDate(snap.timestamp)}
        </div>
      </div>
      {snap.brief && (
        <div className="brief-section">
          <div className="brief-headline">{snap.brief.headline}</div>
          <div className="brief-detail">{snap.brief.detail}</div>
          {snap.brief.affectedLines && (
            <div className="brief-lines">
              <div className="brief-lines-label">Affected Lines</div>
              <div className="brief-lines-tags">
                {snap.brief.affectedLines.map((l) => <span key={l} className="tag">{l}</span>)}
              </div>
            </div>
          )}
          {snap.brief.actions && (
            <div className="brief-actions">
              <div className="brief-actions-label">Actions</div>
              {snap.brief.actions.map((a, i) => (
                <div key={i} className="brief-action-item">{a}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
