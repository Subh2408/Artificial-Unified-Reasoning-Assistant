import { useState } from 'react'
import { DEPTS } from '../constants/depts'
import { fmtDate } from '../utils/format'
import { lsGet, lsSet } from '../utils/storage'
import ComplianceActionDash from './regulatory/ComplianceActionDash'

export default function Sidebar({
  dept, onSwitchDept, situations, selectedId,
  onSelect, setFeedView, setRegJurFilter,
  saved, onSavedSelect, onSavedDelete,
  alertCount, regulations, onSelectReg, onCollapsedChange,
}) {
  const deptInfo = DEPTS.find((d) => d.key === dept)
  const ranked = [...situations].sort((a, b) => b.scores[dept] - a.scores[dept])

  const [collapsed, setCollapsed] = useState(() => lsGet('aura_sidebar_collapsed', false))
  const [regWatchOpen, setRegWatchOpen] = useState(() => lsGet('aura_regwatch_open', false))
  const [compTrackerOpen, setCompTrackerOpen] = useState(() => lsGet('aura_comptracker_open', false))

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    lsSet('aura_sidebar_collapsed', next)
    if (onCollapsedChange) onCollapsedChange(next)
  }

  const toggleRegWatch = () => {
    const next = !regWatchOpen
    setRegWatchOpen(next)
    lsSet('aura_regwatch_open', next)
  }

  const toggleCompTracker = () => {
    const next = !compTrackerOpen
    setCompTrackerOpen(next)
    lsSet('aura_comptracker_open', next)
  }

  // Collapsed rail view
  if (collapsed) {
    return (
      <div className="sidebar-rail">
        <button className="sidebar-expand-btn" onClick={toggleCollapse}>›</button>
        {deptInfo && <div className="sidebar-rail-dot" style={{ background: deptInfo.dotColor }} />}
      </div>
    )
  }

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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="switch-dept-btn" onClick={onSwitchDept}>Switch ↗</button>
          <button className="sidebar-collapse-btn" onClick={toggleCollapse}>‹</button>
        </div>
      </div>

      {dept === 'executive' ? (
        <div className="active-dept-badge">
          <div>
            <div className="adb-label">EXECUTIVE OVERVIEW</div>
          </div>
        </div>
      ) : deptInfo && (
        <div className="active-dept-badge">
          <div className="adb-dot" style={{ background: deptInfo.dotColor }} />
          <div>
            <div className="adb-label">{deptInfo.label}</div>
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
        <div className="sidebar-dropdown-header" onClick={toggleRegWatch}>
          <span>Regulatory Watch</span>
          <span className="sidebar-dropdown-chevron">{regWatchOpen ? '▲' : '▼'}</span>
        </div>
        {regWatchOpen && [
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
              <div className="reg-watch-dot" style={{ background: 'var(--urgent)' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{j.label}</span>
            </div>
            <span className="reg-watch-count">{j.count}</span>
          </div>
        ))}
      </div>

      {dept === 'risk_compliance' && (
        <div className="sidebar-section">
          <div className="sidebar-dropdown-header" onClick={toggleCompTracker}>
            <span>Compliance Tracker</span>
            <span className="sidebar-dropdown-chevron">{compTrackerOpen ? '▲' : '▼'}</span>
          </div>
          {compTrackerOpen && (
            <ComplianceActionDash regulations={regulations || []} onSelectReg={onSelectReg} />
          )}
        </div>
      )}

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
