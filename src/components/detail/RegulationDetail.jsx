import { useState, useEffect } from 'react'
import AiPanel from '../AiPanel'
import Markdown from '../Markdown'
import VersionComparison from '../regulatory/VersionComparison'
import DeptImpactAnalysis from '../regulatory/DeptImpactAnalysis'
import { fmtDate } from '../../utils/format'
import { getRegImplications, generateRegImplications } from '../../api/client'
import { DEPTS } from '../../constants/depts'

const NO_MATERIAL = 'No material implication for this department based on the current regulatory scope.'

const DEPT_IMPL_KEYS = {
  risk_compliance: 'complianceImplication',
  claims: 'claimsImplication',
  underwriting: 'underwritingImplication',
  reinsurance: 'reinsuranceImplication',
  investments: 'investmentsImplication',
}

const GRID_ORDER = ['claims', 'underwriting', 'reinsurance', 'investments']

export default function RegulationDetail({ reg, dept }) {
  const urgCls = { ACTION: 'urgency-action', MONITOR: 'urgency-monitor', INFO: 'urgency-info' }[reg.urgency] || 'urgency-info'
  const isRCDept = dept === 'risk_compliance'
  const isAmendment = ['AMENDMENT', 'NEW LAW', 'NEW'].includes(reg.changeType)

  const [implications, setImplications] = useState(null)
  const [implLoading, setImplLoading] = useState(false)
  const [implError, setImplError] = useState(false)

  const loadImplications = async () => {
    setImplError(false)
    try {
      const cached = await getRegImplications(reg.id)
      if (cached) {
        setImplications(cached)
        return
      }
      setImplLoading(true)
      const generated = await generateRegImplications(reg)
      setImplications(generated)
    } catch {
      setImplError(true)
    } finally {
      setImplLoading(false)
    }
  }

  useEffect(() => {
    setImplications(null)
    setImplLoading(false)
    setImplError(false)
    loadImplications()
  }, [reg.id])

  const activeDept = DEPTS.find((d) => d.key === dept)
  const gridDepts = GRID_ORDER.filter((k) => k !== dept)
  // If active dept is in GRID_ORDER, gridDepts has 3 items. If active is risk_compliance, gridDepts has all 4.
  const activeImplKey = DEPT_IMPL_KEYS[dept]
  const activeImplText = implications?.[activeImplKey] || ''
  const isMuted = (text) => !text || text === NO_MATERIAL

  return (
    <>
      <div className="detail-header">
        <div className="detail-sev-row">
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, background: 'var(--reg-light)', color: 'var(--reg)', padding: '2px 6px', borderRadius: 2 }}>{reg.jurisdiction}</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-3)' }}>{reg.regulatorFull}</span>
          <span className={`tag ${urgCls}`} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9 }}>{reg.urgency}</span>
        </div>
        <div className="detail-title" style={{ fontSize: 18 }}>{reg.title}</div>
        <div className="detail-meta-row" style={{ marginTop: 8 }}>
          <span className="detail-meta-item"><strong>Effective</strong> {fmtDate(reg.effectiveDate)}</span>
          <span className="detail-meta-item"><strong>Published</strong> {fmtDate(reg.publishedDate)}</span>
          <span className="detail-meta-item"><strong>Type</strong> {reg.changeType}</span>
        </div>
      </div>

      <div className="brief-section">
        <div className="brief-detail">{reg.summary}</div>
        <div className="brief-lines" style={{ marginTop: 8 }}>
          <div className="brief-lines-label">Lines Affected</div>
          <div className="brief-lines-tags">
            {(reg.linesAffected || []).map((l) => <span key={l} className="tag">{l}</span>)}
          </div>
        </div>
      </div>

      {/* ── Department Implications ── */}
      <div className="dept-impl-section">
        <div className="dept-impl-label">DEPARTMENT IMPLICATIONS</div>

        {implError && (
          <div style={{ background: 'var(--urgent-bg)', border: '1px solid var(--urgent-border)', borderRadius: 5, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--urgent)' }}>Could not generate implications.</span>
            <button className="detail-action-btn" onClick={loadImplications} style={{ marginLeft: 8 }}>Retry</button>
          </div>
        )}

        {/* Active department — full width */}
        <div className="dept-impl-active" style={{ background: `${activeDept.dotColor}12`, borderLeft: `3px solid ${activeDept.dotColor}`, border: `1px solid ${activeDept.dotColor}33`, borderLeftWidth: 3 }}>
          <div className="dept-impl-active-header">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeDept.dotColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 500, color: activeDept.dotColor }}>{activeDept.label}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 8, color: activeDept.dotColor, background: `${activeDept.dotColor}26`, padding: '2px 6px', borderRadius: 2 }}>YOUR DEPT</span>
          </div>
          {implLoading && !implications ? (
            <div style={{ marginTop: 8 }}>
              <div className="dept-impl-skeleton" style={{ width: '100%' }} />
              <div className="dept-impl-skeleton" style={{ width: '85%' }} />
              <div className="dept-impl-skeleton" style={{ width: '70%' }} />
            </div>
          ) : (
            <div className="dept-impl-active-text">
              <Markdown>{activeImplText || 'Generating...'}</Markdown>
            </div>
          )}
        </div>

        {/* 2x2 grid — remaining departments */}
        <div className="dept-impl-grid">
          {gridDepts.map((deptKey) => {
            const d = DEPTS.find((x) => x.key === deptKey)
            const implKey = DEPT_IMPL_KEYS[deptKey]
            const text = implications?.[implKey] || ''
            const muted = isMuted(text)

            return (
              <div key={deptKey} className={`dept-impl-cell ${muted ? 'dept-impl-cell-muted' : ''}`}>
                <div className="dept-impl-cell-header">
                  {muted
                    ? <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)' }}>—</span>
                    : <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.dotColor, flexShrink: 0 }} />
                  }
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: muted ? 'var(--ink-4)' : 'var(--ink-3)' }}>{d.label}</span>
                </div>
                {implLoading && !implications ? (
                  <div style={{ marginTop: 5 }}>
                    <div className="dept-impl-skeleton" style={{ width: '100%' }} />
                    <div className="dept-impl-skeleton" style={{ width: '75%' }} />
                  </div>
                ) : (
                  <div className={`dept-impl-cell-text ${muted ? 'dept-impl-text-muted' : ''}`}>
                    <Markdown>{text || 'Generating...'}</Markdown>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isAmendment && <VersionComparison reg={reg} />}
      {isRCDept && <DeptImpactAnalysis reg={reg} />}

      <AiPanel sitId={reg.id} dept={dept} isReg={true} regData={reg} />

      <div className="reg-source-ref">Source: {reg.sourceRef}</div>

      <div className="ai-disclaimer">
        AI-generated analysis — validate before acting. Not legal or regulatory advice.<br />
        Always refer to official regulator publications for authoritative guidance.
      </div>
    </>
  )
}
