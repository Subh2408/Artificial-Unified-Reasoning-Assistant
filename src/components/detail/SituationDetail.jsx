import { DEPTS } from '../../constants/depts'
import CollapsibleSection from '../CollapsibleSection'
import { SRC_DOT } from '../../constants/colors'
import { fmtDT } from '../../utils/format'
import AiPanel from '../AiPanel'
import Timeline from '../Timeline'
import RegActionBanner from './RegActionBanner'
import ThresholdStatus from './ThresholdStatus'
import SituationHistory from './SituationHistory'
import ClaimsPanel from '../dept/ClaimsPanel'
import UnderwritingPanel from '../dept/UnderwritingPanel'
import InvestmentsPanel from '../dept/InvestmentsPanel'
import ReinsurancePanel from '../dept/ReinsurancePanel'

import { useState } from 'react'

export default function SituationDetail({ sit, dept, signals, regulations, saved, onSave, onExport, onViewReg, onSynthesize }) {
  const [synthesizing, setSynthesizing] = useState(false)

  const handleSynthesize = async () => {
    setSynthesizing(true)
    try { await onSynthesize(sit) } finally { setSynthesizing(false) }
  }
  const isExec = dept === 'executive'
  const interp = isExec ? null : (sit.interpretations?.[dept] || null)
  const sitSignals = signals.filter((s) => sit.signalIds.includes(s.id))
  const actionRegs = regulations.filter((r) => r.urgency === 'ACTION' && sit.regJurisdictions?.includes(r.jurisdictionCode))
  const isSaved = saved.some((s) => s.situationId === sit.id && s.deptKey === dept)
  const deptInfo = DEPTS.find((d) => d.key === dept)

  const urgentActions = interp?.actions?.slice(0, 2) || []
  const remainingActions = interp?.actions?.slice(2) || []

  return (
    <>
      <RegActionBanner regs={actionRegs} dept={dept} onViewReg={onViewReg} />

      <div className="detail-header">
        <div className="detail-header-actions">
          <button className={`detail-action-btn ${isSaved ? 'saved' : ''}`} onClick={() => onSave(sit, dept, interp)}>
            {isSaved ? '◆ Saved' : '◇ Save Brief'}
          </button>
          <button className="detail-action-btn" onClick={() => onExport(sit, dept, interp)}>↓ Export PDF</button>
          {onSynthesize && (
            <button className="detail-action-btn resynth" onClick={handleSynthesize} disabled={synthesizing} title="Re-synthesize using latest live signals">
              {synthesizing ? '◆ Synthesizing…' : '↺ Re-synthesize'}
            </button>
          )}
        </div>
        <div className="detail-title">{sit.title}</div>
        <div className="detail-subtitle">{sit.subtitle}</div>
        <div className="detail-meta-row">
          <span className="detail-meta-item"><strong>Geography</strong> {sit.geography}</span>
          <span className="detail-meta-item"><strong>Updated</strong> {fmtDT(sit.updated)}</span>
        </div>
      </div>

      {/* Department brief — shown immediately */}
      {interp && (
        <div className="brief-section" style={{ marginBottom: 14 }}>
          <div className="brief-headline">{interp.headline}</div>
          <div className="brief-detail">{interp.detail}</div>
          {urgentActions.length > 0 && (
            <div className="inline-urgent-actions">
              {urgentActions.map((a, i) => (
                <div key={i} className="inline-urgent-action">{a}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {!interp && !isExec && (
        <div className="brief-section">
          <div className="brief-detail" style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>
            Select a department from the sidebar to see a tailored brief for this situation.
          </div>
        </div>
      )}

      {isExec && (
        <div className="brief-section">
          <div className="brief-detail">{sit.summary}</div>
        </div>
      )}

      {/* Compact threshold — one-line, only alert/breach */}
      {!isExec && ['claims','underwriting','reinsurance','investments','risk_compliance'].includes(dept) && (
        <ThresholdStatus situationId={sit.id} deptKey={dept} situation={sit} compact={true} />
      )}

      {/* AI Panel — immediately below brief */}
      {!isExec && <AiPanel sitId={sit.id} dept={dept} situation={sit} />}

      {/* Collapsed sections */}
      {remainingActions.length > 0 && (
        <CollapsibleSection label="All Actions" storageKey="aura_col_all_actions" defaultOpen={false}>
          <div className="brief-actions" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
            {interp.actions.map((a, i) => (
              <div key={i} className={`brief-action-item ${i < 2 ? 'urgent' : ''}`}>
                {i < 2 && <span className="urgent-tag">URGENT</span>}
                {a}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {interp?.affectedLines && (
        <CollapsibleSection label="Affected Lines" storageKey="aura_col_affected_lines" defaultOpen={false}>
          <div className="brief-lines-tags">
            {interp.affectedLines.map((l) => <span key={l} className="tag">{l}</span>)}
          </div>
        </CollapsibleSection>
      )}

      {/* Full threshold detail — collapsed */}
      {!isExec && ['claims','underwriting','reinsurance','investments','risk_compliance'].includes(dept) && (
        <CollapsibleSection label="Threshold Detail" storageKey="aura_col_threshold_full" defaultOpen={false}>
          <ThresholdStatus situationId={sit.id} deptKey={dept} situation={sit} compact={false} />
        </CollapsibleSection>
      )}

      {['claims','underwriting','reinsurance','investments'].includes(dept) && (
        <CollapsibleSection label="Department Tools" storageKey="aura_col_dept_tools" defaultOpen={false}>
          {dept === 'claims'       && <ClaimsPanel sit={sit} />}
          {dept === 'underwriting' && <UnderwritingPanel sit={sit} />}
          {dept === 'investments'  && <InvestmentsPanel sit={sit} />}
          {dept === 'reinsurance'  && <ReinsurancePanel sit={sit} />}
        </CollapsibleSection>
      )}

      <CollapsibleSection label="Signal Timeline" storageKey="aura_col_timeline" defaultOpen={false}>
        <Timeline signals={sitSignals} />
      </CollapsibleSection>

      <CollapsibleSection label={`Signals (${sitSignals.length})`} storageKey="aura_col_signals" defaultOpen={false}>
      <div className="signal-list" style={{ marginBottom: 0 }}>
        <div className="signal-list-label">Signals ({sitSignals.length})</div>
        {sitSignals.map((sig) => (
          <div key={sig.id} className="signal-row">
            <div className="signal-row-dot" style={{ background: SRC_DOT[sig.sourceType] || '#374151' }} />
            <div className="signal-row-body">
              <div className="signal-row-title">{sig.title}</div>
              <div className="signal-row-meta">
                <span className={`src-badge src-${sig.sourceType.toLowerCase()}`}>{sig.sourceType}</span>
                <span>{sig.source}</span>
                <span>{fmtDT(sig.timestamp)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>{sig.description}</div>
            </div>
          </div>
        ))}
      </div>
      </CollapsibleSection>

      {/* Evolution timeline — at the bottom */}
      <SituationHistory situationId={sit.id} />
    </>
  )
}
