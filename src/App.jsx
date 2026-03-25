import { useState, useEffect, useRef } from 'react'
import { DEPTS, DEPT_AGENT } from './constants/depts'
import { lsGet, lsSet } from './utils/storage'
import { exportBrief } from './utils/exportBrief'
import { callClaude, getSaved, createSaved, deleteSaved, getLiveFeed, synthesizeSituation, triggerIngest, getThresholdAlerts } from './api/client'
import SITUATIONS_SEED from './data/situations'
import SIGNALS_SEED from './data/signals'
import REGULATIONS_SEED from './data/regulations'

import DeptGate from './components/DeptGate'
import Ticker from './components/Ticker'
import Sidebar from './components/Sidebar'
import Feed from './components/feed/Feed'
import SituationDetail from './components/detail/SituationDetail'
import SignalDetail from './components/detail/SignalDetail'
import RegulationDetail from './components/detail/RegulationDetail'
import SnapshotDetail from './components/detail/SnapshotDetail'

export default function App() {
  const initCols = lsGet('aura_cols_v1', { sb: 220, feed: 380 })

  const [dept, setDept]         = useState(() => lsGet('aura_dept_v1', null))
  const [showGate, setShowGate] = useState(true)
  const [feedView, setFeedView] = useState('situations')
  const [selType, setSelType]   = useState(null)
  const [selItem, setSelItem]   = useState(null)
  const [saved, setSaved]       = useState([])
  const [morningBrief, setMorningBrief] = useState(null)
  const [sbW, setSbW]           = useState(initCols.sb)
  const [feedW, setFeedW]       = useState(initCols.feed)
  const [toast, setToast]       = useState(null)
  const [regJurFilter, setRegJurFilter] = useState('ALL')

  const [situations,  setSituations]  = useState(SITUATIONS_SEED)
  const [signals,     setSignals]     = useState(SIGNALS_SEED)
  const [regulations, setRegulations] = useState(REGULATIONS_SEED)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [alertCount, setAlertCount]   = useState(0)

  const dragRef   = useRef(null)
  const toastRef  = useRef(null)
  const detailRef = useRef(null)

  // Compute alert count for active department
  useEffect(() => {
    if (!dept) return
    let cancelled = false
    Promise.all(situations.map((s) => getThresholdAlerts(s.id, dept).catch(() => null)))
      .then((results) => {
        if (cancelled) return
        const count = results.filter((r) => r && r.length > 0).reduce((sum, r) => sum + r.length, 0)
        setAlertCount(count)
      })
    return () => { cancelled = true }
  }, [dept, situations])

  // Load saved briefs from backend on mount
  useEffect(() => {
    getSaved().then(setSaved).catch((err) => console.warn('[init] failed to load saved briefs:', err.message))
  }, [])

  // Load live feed data on mount (static seed stays as fallback)
  useEffect(() => {
    getLiveFeed().then(applyLiveFeed).catch((err) => console.warn('[init] live feed unavailable, using seed data:', err.message))
  }, [])

  const applyLiveFeed = ({ signals: live, regulations: liveRegs, situations: liveSits }) => {
    if (live.length)     setSignals(live)
    if (liveRegs.length) setRegulations([...REGULATIONS_SEED, ...liveRegs])
    if (liveSits.length) setSituations(liveSits)
    setLastUpdated(new Date())
  }

  const refreshFeed = () => {
    if (refreshing) return
    setRefreshing(true)
    // First fetch existing data immediately, then trigger ingest for next refresh
    getLiveFeed()
      .then((feed) => {
        applyLiveFeed(feed)
        // Also trigger ingest so next refresh has fresh data
        triggerIngest().catch((err) => console.warn('[refresh] ingest trigger failed:', err.message))
      })
      .catch((err) => {
        console.error('[refresh] feed update failed:', err.message)
        showToast('Feed refresh failed — using cached data')
      })
      .finally(() => setRefreshing(false))
  }

  // Reset detail scroll on dept switch
  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0
  }, [dept])

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2200)
  }

  const selectDept = (d) => {
    setDept(d)
    lsSet('aura_dept_v1', d)
    setShowGate(false)
    setMorningBrief(null)
    setFeedView(d === 'risk_compliance' ? 'regulations' : 'situations')
    if (d === 'executive') setAlertCount(0)
  }

  const switchDept = () => {
    setShowGate(true)
    setMorningBrief(null)
  }

  const handleSelect = (type, item) => {
    setSelType(type)
    setSelItem(item)
  }

  const handleSave = async (sit, deptKey, interp) => {
    const exists = saved.findIndex((s) => s.situationId === sit.id && s.deptKey === deptKey)
    if (exists >= 0) {
      const item = saved[exists]
      await deleteSaved(item.id)
      const updated = saved.filter((_, i) => i !== exists)
      setSaved(updated)
      showToast('Brief removed from saved')
      return
    }
    const deptInfo = DEPTS.find((d) => d.key === deptKey)
    const payload = {
      situationId: sit.id,
      deptKey,
      label: `${sit.title} — ${deptInfo?.label || deptKey}`,
      timestamp: new Date().toISOString(),
      summary: sit.summary,
      brief: interp,
    }
    const created = await createSaved(payload)
    setSaved([created, ...saved].slice(0, 20))
    showToast('◆ Brief saved — view in sidebar')
  }

  const handleSynthesize = async (sit) => {
    try {
      const updated = await synthesizeSituation(sit.id)
      setSituations((prev) => prev.map((s) => s.id === updated.id ? updated : s))
      if (selItem?.id === updated.id) setSelItem(updated)
      showToast('◆ Situation re-synthesized')
    } catch {
      showToast('Re-synthesis failed — check connection')
    }
  }

  const triggerMorningBrief = async (deptKey) => {
    const d = deptKey || dept
    if (!d) return
    setMorningBrief('loading')
    const ranked = [...situations].sort((a, b) => b.scores[d] - a.scores[d]).slice(0, 3)
    const deptInfo = DEPTS.find((x) => x.key === d)
    const persona = DEPT_AGENT[d] || DEPT_AGENT.risk_compliance
    const ctx = ranked
      .map((s, i) => `#${i + 1}: ${s.title} (${s.severity}) — ${s.interpretations[d]?.headline || s.subtitle}\nKey actions: ${s.interpretations[d]?.actions?.slice(0, 2).join(' / ') || ''}`)
      .join('\n\n')
    try {
      const reply = await callClaude(
        persona,
        [{ role: 'user', content: `Write a concise morning intelligence brief for ${deptInfo?.label} covering the 3 highest-priority situations as of ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}. Use 3 short paragraphs — one per situation — in a professional editorial tone. No bullet points, no headers, no preamble. Start with the most urgent.\n\n${ctx}` }],
        600
      )
      setMorningBrief(reply)
    } catch {
      setMorningBrief('Error generating brief. Check your connection.')
    }
  }

  const handleMorningBrief = () => {
    if (morningBrief && morningBrief !== 'loading') { setMorningBrief(null); return }
    triggerMorningBrief(dept)
  }

  const handleViewReg = (reg) => {
    setSelType('regulation')
    setSelItem(reg)
    setFeedView('regulations')
  }

  // Column resize
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      if (dragRef.current.which === 'sb') {
        const w = Math.max(160, Math.min(320, dragRef.current.start + dx))
        setSbW(w)
        lsSet('aura_cols_v1', { sb: w, feed: feedW })
      } else {
        const w = Math.max(300, Math.min(580, dragRef.current.start + dx))
        setFeedW(w)
        lsSet('aura_cols_v1', { sb: sbW, feed: w })
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [sbW, feedW])

  if (showGate) return <DeptGate onSelect={selectDept} />

  return (
    <div id="root">
      <Ticker />
      <div className="app">
        {/* Sidebar */}
        <div style={{ width: sbW, minWidth: 160, maxWidth: 320, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
          <Sidebar
            dept={dept}
            onSwitchDept={switchDept}
            situations={situations}
            selectedId={selItem?.id}
            onSelect={handleSelect}
            setFeedView={setFeedView}
            setRegJurFilter={setRegJurFilter}
            saved={saved}
            alertCount={alertCount}
            onSavedSelect={(s) => { setSelType('snapshot'); setSelItem(s) }}
            onSavedDelete={async (id) => {
              await deleteSaved(id)
              setSaved(saved.filter((s) => s.id !== id))
            }}
          />
        </div>

        <div
          className="resize-handle"
          onMouseDown={(e) => { dragRef.current = { which: 'sb', startX: e.clientX, start: sbW }; e.preventDefault() }}
        />

        {/* Feed */}
        <div style={{ width: feedW, minWidth: 300, maxWidth: 580, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          <Feed
            view={feedView}
            setView={setFeedView}
            dept={dept}
            situations={situations}
            signals={signals}
            regulations={regulations}
            selectedId={selItem?.id}
            onSelect={handleSelect}
            morningBrief={morningBrief}
            onMorningBrief={handleMorningBrief}
            regJurFilter={regJurFilter}
            setRegJurFilter={setRegJurFilter}
            lastUpdated={lastUpdated}
            onRefresh={refreshFeed}
            refreshing={refreshing}
          />
        </div>

        <div
          className="resize-handle"
          onMouseDown={(e) => { dragRef.current = { which: 'feed', startX: e.clientX, start: feedW }; e.preventDefault() }}
        />

        {/* Detail pane */}
        <div className="detail">
          {!selItem && (
            <div className="detail-empty">
              <div style={{ fontSize: 24, opacity: .2 }}>◈</div>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, letterSpacing: '.06em' }}>
                Select a situation, signal or regulation
              </span>
            </div>
          )}
          {selItem && (
            <div className="detail-scroll" ref={detailRef}>
              {selType === 'situation' && (
                <SituationDetail
                  sit={selItem}
                  dept={dept}
                  signals={signals}
                  regulations={regulations}
                  saved={saved}
                  onSave={handleSave}
                  onExport={exportBrief}
                  onViewReg={handleViewReg}
                  onSynthesize={handleSynthesize}
                />
              )}
              {selType === 'signal' && (
                <SignalDetail
                  sig={selItem}
                  allSituations={situations}
                  onSelectSituation={(s) => { setSelType('situation'); setSelItem(s); setFeedView('situations') }}
                />
              )}
              {selType === 'regulation' && (
                <RegulationDetail reg={selItem} dept={dept} />
              )}
              {selType === 'snapshot' && (
                <SnapshotDetail
                  snap={selItem}
                  onClose={() => { setSelItem(null); setSelType(null) }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
