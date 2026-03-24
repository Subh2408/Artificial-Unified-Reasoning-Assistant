import { DEPTS } from '../constants/depts'
import { fmtDate } from '../utils/format'

export default function Sidebar({
  dept, onSwitchDept, situations, selectedId,
  onSelect, setFeedView, setRegJurFilter,
  saved, onSavedSelect, onSavedDelete,
  alertCount,
}) {
  const deptInfo = DEPTS.find((d) => d.key === dept)
  const ranked = [...situations].sort((a, b) => b.scores[dept] - a.scores[dept])

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-left">
          <div className="logo-mark">AU</div>
          <div>
            <div className="logo-text">AURA</div>
            <div className="logo-sub">INSURANCE INTELLIGENCE</div>
          </div>
        </div>
        <button className="switch-dept-btn" onClick={onSwitchDept}>Switch ↗</button>
      </div>

      {deptInfo && (
        <div className="active-dept-badge">
          <div className="adb-dot" style={{ background: deptInfo.dotColor }} />
          <div>
            <div className="adb-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {deptInfo.label}
              {alertCount > 0 && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: 10 }}>{alertCount}</span>}
            </div>
            <div className="adb-desc">{deptInfo.desc}</div>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-header">Situation Index</div>
        {ranked.map((s, i) => (
          <div
            key={s.id}
            className={`sit-index-item ${selectedId === s.id ? 'active-item' : ''}`}
            onClick={() => { onSelect('situation', s); setFeedView('situations') }}
          >
            <span className={`rank-badge ${i === 0 ? 'rank-1' : ''}`}>#{i + 1}</span>
            <span style={{ flex: 1 }}>{s.title}</span>
            {s.isLive && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sev-active)', animation: 'pulse 2s infinite', flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">Regulatory Watch</div>
        {[
          { code: 'QAT', label: 'Qatar',        count: 3 },
          { code: 'QFC', label: 'Qatar (QFC)',   count: 3 },
          { code: 'UAE', label: 'UAE',           count: 3 },
          { code: 'KSA', label: 'Saudi Arabia',  count: 1 },
        ].map((j) => (
          <div
            key={j.code}
            className="reg-watch-item"
            onClick={() => { setRegJurFilter(j.code); setFeedView('regulations') }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="reg-watch-dot" style={{ background: '#C8001E' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{j.label}</span>
            </div>
            <span className="reg-watch-count">{j.count}</span>
          </div>
        ))}
      </div>

      {saved.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            Saved <span style={{ color: 'var(--ink-4)' }}>{saved.length}</span>
          </div>
          {saved.map((s) => (
            <div key={s.id} className="saved-item" onClick={() => onSavedSelect(s)}>
              <div className="saved-item-title">{s.label}</div>
              <div className="saved-item-meta">
                <span>{fmtDate(s.timestamp)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSavedDelete(s.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 9 }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
