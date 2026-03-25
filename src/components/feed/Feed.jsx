import { useState, useMemo, useEffect } from 'react'
import { DEPTS } from '../../constants/depts'
import HeroCard from './HeroCard'
import { SitCard, SignalCard, RegCard } from './Cards'
import ComplianceActionDash from '../regulatory/ComplianceActionDash'
import RegQueryAssistant from '../regulatory/RegQueryAssistant'
import Markdown from '../Markdown'
import { getThresholdAlerts } from '../../api/client'

export default function Feed({
  view, setView, dept, situations, signals, regulations,
  selectedId, onSelect, morningBrief, onMorningBrief,
  regJurFilter, setRegJurFilter,
  lastUpdated, onRefresh, refreshing,
}) {
  const liveSignalCount = signals.filter((s) => s.id?.startsWith('live_')).length
  const liveRegCount    = regulations.filter((r) => r.id?.startsWith('live_')).length
  const [search, setSearch] = useState('')
  const [regUrgFilter, setRegUrgFilter] = useState('ALL')
  const [briefExpanded, setBriefExpanded] = useState(false)
  const [thresholdMap, setThresholdMap] = useState({})

  // Load cached threshold alerts for top situations (async, non-blocking)
  useEffect(() => {
    const topSits = [...situations].sort((a, b) => (b.scores?.[dept] || 0) - (a.scores?.[dept] || 0)).slice(0, 6)
    const map = {}
    Promise.all(topSits.map(async (s) => {
      try {
        const alerts = await getThresholdAlerts(s.id, dept)
        if (alerts && alerts.length) {
          const highest = alerts.reduce((best, a) => {
            const order = { breach: 5, alert: 4, caution: 3, medium: 2, low: 1 }
            return (order[a.impact_level] || 0) > (order[best] || 0) ? a.impact_level : best
          }, 'low')
          map[s.id] = highest
        }
      } catch {}
    })).then(() => setThresholdMap(map))
  }, [dept, situations])

  const isExec = dept === 'executive'
  const ranked = useMemo(
    () => [...situations].sort((a, b) => {
      if (isExec) {
        const maxA = Math.max(...Object.values(a.scores || {}))
        const maxB = Math.max(...Object.values(b.scores || {}))
        return maxB - maxA
      }
      return (b.scores?.[dept] || 0) - (a.scores?.[dept] || 0)
    }),
    [dept, situations, isExec]
  )

  const actionRegsFor = (sit) =>
    regulations.filter((r) => r.urgency === 'ACTION' && sit.regJurisdictions?.includes(r.jurisdictionCode))

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (view === 'situations')
      return ranked.filter((s) => !q || s.title.toLowerCase().includes(q) || (s.subtitle || '').toLowerCase().includes(q))
    if (view === 'signals')
      return signals.filter((s) => !q || s.title.toLowerCase().includes(q) || s.source.toLowerCase().includes(q))
    if (view === 'regulations')
      return regulations.filter((r) => {
        if (q && !r.title.toLowerCase().includes(q) && !r.jurisdiction.toLowerCase().includes(q)) return false
        if (regJurFilter !== 'ALL' && r.jurisdictionCode !== regJurFilter) return false
        if (regUrgFilter !== 'ALL' && r.urgency !== regUrgFilter) return false
        return true
      })
    return []
  }, [view, search, ranked, signals, regulations, regJurFilter, regUrgFilter])

  useEffect(() => { if (morningBrief) setBriefExpanded(true) }, [morningBrief])
  useEffect(() => { if (view !== 'regulations') setRegUrgFilter('ALL') }, [view])

  const deptInfo = DEPTS.find((d) => d.key === dept)
  const briefSnippet = morningBrief && morningBrief !== 'loading' ? (morningBrief.includes('.') ? morningBrief.split('.')[0] + '.' : morningBrief.substring(0, 120) + '…') : null
  const JUR_FILTERS = [{ k: 'ALL', l: 'All' }, { k: 'QAT', l: 'Qatar' }, { k: 'QFC', l: 'QFC' }, { k: 'UAE', l: 'UAE' }, { k: 'KSA', l: 'KSA' }]
  const URG_FILTERS = [{ k: 'ALL', l: 'All' }, { k: 'ACTION', l: 'Action' }, { k: 'MONITOR', l: 'Monitor' }]

  return (
    <div className="feed">
      <div className="feed-header">
        {!isExec && (
          <div className="morning-panel-trigger" onClick={onMorningBrief}>
            <div className="morning-panel-trigger-left">
              <span className="morning-trigger-label">◆ Morning brief</span>
              <span className="morning-trigger-dept">{deptInfo?.label} · {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
            </div>
            <span className="morning-trigger-arrow">{morningBrief === 'loading' ? '…' : morningBrief ? '▼' : '→'}</span>
          </div>
        )}
        <div className="feed-toggle">
          <button className={`feed-toggle-btn ${view === 'situations' ? 'active' : ''}`} onClick={() => setView('situations')}>SITUATIONS</button>
          <button className={`feed-toggle-btn ${view === 'signals' ? 'active' : ''}`} onClick={() => setView('signals')}>SIGNALS</button>
          <button className={`feed-toggle-btn ${view === 'regulations' ? 'active' : ''}`} onClick={() => setView('regulations')}>REGS</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input className="feed-search" placeholder={`Search ${view}…`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title={refreshing ? 'Fetching live data…' : 'Refresh live feed'}
            style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 7px', cursor: refreshing ? 'default' : 'pointer', color: refreshing ? 'var(--ai)' : 'var(--ink-4)', flexShrink: 0, opacity: refreshing ? 1 : 0.7 }}
          >{refreshing ? '…' : '↺'}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {(liveSignalCount > 0 || liveRegCount > 0) && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--ai)', letterSpacing: '.06em' }}>
              ◆ {liveSignalCount} LIVE SIGNALS · {liveRegCount} LIVE REGS
            </span>
          )}
          {lastUpdated && (
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: 'var(--ink-4)', opacity: .5 }}>
              Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {view === 'regulations' && (
          <>
            <div className="reg-filters" style={{ marginTop: 8 }}>
              {JUR_FILTERS.map((f) => (
                <button key={f.k} className={`reg-filter-pill ${regJurFilter === f.k ? 'active' : ''}`} onClick={() => setRegJurFilter(f.k)}>{f.l}</button>
              ))}
            </div>
            <div className="reg-filters">
              {URG_FILTERS.map((f) => (
                <button key={f.k} className={`reg-filter-pill urgency-pill ${regUrgFilter === f.k ? 'active' : ''}`} onClick={() => setRegUrgFilter(f.k)}>{f.l}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {morningBrief && (
        <div className="morning-panel">
          <div className="morning-panel-header" style={{ cursor: 'pointer' }} onClick={() => setBriefExpanded(!briefExpanded)}>
            <span className="morning-panel-title">◆ {deptInfo?.label?.toUpperCase()} · {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!briefExpanded && briefSnippet && (
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ai)', opacity: .7, maxWidth: 180, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{briefSnippet}</span>
              )}
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ai)', opacity: .7 }}>{briefExpanded ? '▲ collapse' : '▼ read'}</span>
              <button className="morning-panel-close" onClick={(e) => { e.stopPropagation(); onMorningBrief() }}>✕</button>
            </div>
          </div>
          {briefExpanded && (
            <div className="morning-panel-body">
              {morningBrief === 'loading'
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="ai-loading"><span /><span /><span /></div><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--ai)' }}>Generating…</span></div>
                : <Markdown>{morningBrief}</Markdown>}
            </div>
          )}
        </div>
      )}

      {dept === 'risk_compliance' && view === 'regulations' && (
        <RegQueryAssistant regulations={regulations} />
      )}

      <div className="feed-list">
        {dept === 'risk_compliance' && view === 'regulations' && (
          <ComplianceActionDash regulations={regulations} onSelectReg={(r) => onSelect('regulation', r)} />
        )}
        {view === 'situations' && filtered.map((s, i) => {
          const ar = actionRegsFor(s)
          const ta = thresholdMap[s.id] || null
          return i === 0
            ? <HeroCard key={s.id} sit={s} selected={selectedId === s.id} dept={dept} actionRegs={ar} thresholdAlert={ta} onClick={() => onSelect('situation', s)} />
            : <SitCard key={s.id} sit={s} selected={selectedId === s.id} dept={dept} actionRegs={ar} thresholdAlert={ta} onClick={() => onSelect('situation', s)} />
        })}
        {view === 'signals' && filtered.map((s) => (
          <SignalCard key={s.id} sig={s} selected={selectedId === s.id} onClick={() => onSelect('signal', s)} />
        ))}
        {view === 'regulations' && (
          <>
            {filtered.length === 0 && <div style={{ padding: '24px 8px', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--ink-4)' }}>No regulations match these filters</div>}
            {filtered.map((r) => <RegCard key={r.id} reg={r} selected={selectedId === r.id} onClick={() => onSelect('regulation', r)} />)}
          </>
        )}
      </div>
    </div>
  )
}
