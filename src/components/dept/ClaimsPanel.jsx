import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'
import Markdown from '../Markdown'

const CLAIM_TYPES = [
  'Marine Hull / War Risk',
  'Marine Cargo',
  'Property / Fire',
  'Motor',
  'Liability (D&O / E&O / General)',
  'Cyber',
  'Energy / Offshore',
  'Aviation',
  'Engineering / Construction',
  'Health / Medical',
  'Other',
]

const SUBJECT_PLACEHOLDERS = {
  'Marine Hull / War Risk': 'e.g. MV Nova Spirit, VLCC, 298,000 DWT',
  'Marine Cargo': 'e.g. 40x TEU containers, Bill of Lading MSCUXXX',
  'Property / Fire': 'e.g. Commercial warehouse, Al Rayyan Industrial Zone',
  'Motor': 'e.g. Fleet vehicle QA-12345, third party collision',
  'Liability (D&O / E&O / General)': 'e.g. D&O claim against board of directors',
  'Cyber': 'e.g. Ransomware attack on insured\'s ERP system',
  'Energy / Offshore': 'e.g. Offshore platform, Qatar North Field sector 4',
  'Aviation': 'e.g. Aircraft registration A7-XXX, hull damage',
  'Engineering / Construction': 'e.g. CAR policy, foundation works phase',
  'Health / Medical': 'e.g. Group medical policy, hospitalisation claim',
  'Other': 'e.g. Subject of loss',
}

const COVERAGE_CHECKLISTS = {
  'Marine Hull / War Risk': [
    'Is the vessel covered under a current hull policy — confirm period of cover?',
    'Did the loss occur before or after P&I war risk cancellation notice expiry?',
    'Has the owner declared General Average — if so, appoint GA adjuster immediately?',
    'Is the vessel flagged with a P&I club that issued cancellation — check club membership?',
    'Is there a separate war risk endorsement or is it within the main hull policy?',
    'Confirm ISM certification and class survey status at time of loss',
  ],
  'Marine Hull': [
    'Is the vessel covered under a current hull policy — confirm period of cover?',
    'Did the loss occur before or after P&I war risk cancellation notice expiry?',
    'Has the owner declared General Average — if so, appoint GA adjuster immediately?',
    'Is the vessel flagged with a P&I club that issued cancellation — check club membership?',
    'Is there a separate war risk endorsement or is it within the main hull policy?',
    'Confirm ISM certification and class survey status at time of loss',
  ],
  'Marine Cargo': [
    'Is there a clean bill of lading — any noted exceptions affect coverage?',
    'Was the cargo in transit or in a warehouse at the time of the event?',
    'Does the policy include war risk and strikes cover — check Institute Cargo Clauses?',
    'Confirm the named insured and whether any intermediary holds the policy?',
    'Is there a general average contribution claim — identify cargo interests?',
    'Check for any accumulation with other cargo claims from the same vessel',
  ],
  'War Risk': [
    'Was valid war risk cover in force at the exact time of the incident?',
    'Has a P&I or hull war risk notice been given — what is the cut-off timestamp?',
    'Is this a state-sponsored act or non-state actor — affects treaty classification?',
    'Are OFAC/UN sanctions relevant to the vessel owner or charterer?',
    'Check for double insurance — hull and cargo may both have war risk sections',
  ],
  'Property / Fire': [
    'Is there a physical loss or damage trigger — confirm material damage?',
    'Is business interruption covered — check indemnity period and waiting period?',
    'War, riot and civil commotion exclusion — check policy wording?',
    'Is there a sanctions exclusion affecting the policyholder or location?',
    'Appoint a loss adjuster with local Qatar/GCC market experience?',
    'Notify reinsurers if loss exceeds per-risk retention threshold?',
  ],
  'Property': [
    'Is there a physical loss or damage trigger — confirm material damage?',
    'Is business interruption covered — check indemnity period and waiting period?',
    'War, riot and civil commotion exclusion — check policy wording?',
    'Is there a sanctions exclusion affecting the policyholder or location?',
    'Appoint a loss adjuster with local Qatar/GCC market experience?',
    'Notify reinsurers if loss exceeds per-risk retention threshold?',
  ],
  'Motor': [
    'Is the vehicle insured under a current motor policy — confirm registration?',
    'Is this own damage, third party property, or bodily injury?',
    'Was the driver licensed and authorised under the policy?',
    'Is there a police report — mandatory for most Qatar motor claims?',
    'Check for fleet policy — confirm vehicle is scheduled on the fleet endorsement?',
  ],
  'Liability (D&O / E&O / General)': [
    'Is this a claims-made or occurrence-based policy — confirm trigger?',
    'Has the claim been notified within the policy notification period?',
    'Is there a related claims aggregation clause — check for series of acts?',
    'Confirm the entity and individual insured — check policy schedule?',
    'Check for dishonesty or fraud exclusions applicable to this claim?',
  ],
  'Cyber': [
    'Is the affected system covered under a standalone cyber policy or property policy?',
    'Was there a physical loss or purely digital compromise?',
    'Check for ransomware payment provisions — insurer consent required?',
    'Has the cyber incident response retainer been notified?',
    'Check silent cyber in property/marine policies — NMA 2914 exclusion?',
  ],
  'Energy / Offshore': [
    'Is the facility onshore or offshore — different policy structures apply?',
    'Was there a physical loss or damage trigger — business interruption requires damage?',
    'Check control of well coverage if applicable — blowout or seepage?',
    'Confirm operator status — named insured vs additional insured distinction?',
    'Is there a cyber exclusion in the energy policy — check NMA 2914 or equivalent?',
  ],
  'Energy': [
    'Is the facility onshore or offshore — different policy structures apply?',
    'Was there a physical loss or damage trigger — business interruption requires damage?',
    'Check control of well coverage if applicable — blowout or seepage?',
    'Confirm operator status — named insured vs additional insured distinction?',
    'Is there a cyber exclusion in the energy policy — check NMA 2914 or equivalent?',
  ],
  'Aviation': [
    'Confirm aircraft registration and hull value at time of loss?',
    'Was the aircraft airworthy and operating within approved flight envelope?',
    'Is this hull, liability, or passenger personal accident claim?',
    'Notify aviation reinsurers — most aviation treaties require immediate notification?',
    'Appoint aviation specialist adjuster — AGAS or equivalent?',
  ],
  'Engineering / Construction': [
    'Is this a Contractors All Risk (CAR) or Erection All Risk (EAR) policy?',
    'Is the project in the testing/commissioning phase — different cover applies?',
    'Was the loss caused by a design defect — check design exclusions?',
    'Has the contract value changed since inception — check sum insured adequacy?',
    'Is there a delay in start-up (DSU) section — check trigger requirements?',
  ],
  'Health / Medical': [
    'Is the treatment covered under the policy schedule of benefits?',
    'Was pre-authorisation obtained where required?',
    'Is the treating facility on the approved network?',
    'Check for pre-existing condition exclusions — review underwriting history?',
    'Is this a group or individual policy — check employer contribution structure?',
  ],
}

const GENERAL_CHECKLIST = [
  'Confirm policy is in force and period of cover is current',
  'Identify the named insured and verify insurable interest',
  'Check for any relevant exclusions before accepting the claim',
  'Appoint specialist adjusters appropriate to the loss type',
  'Notify reinsurers per treaty notification obligations',
]

function getChecklist(sit, claimType) {
  if (claimType && COVERAGE_CHECKLISTS[claimType]) {
    return { category: claimType, items: COVERAGE_CHECKLISTS[claimType] }
  }
  for (const cat of (sit.category || [])) {
    if (COVERAGE_CHECKLISTS[cat]) return { category: cat, items: COVERAGE_CHECKLISTS[cat] }
  }
  return { category: 'General', items: GENERAL_CHECKLIST }
}

// ─── CLAIMS PANEL ─────────────────────────────────────────────────────────────

function ClaimsPanel({ sit }) {
  const [open, setOpen] = useState(true)
  const [claimType, setClaimType] = useState('')
  const [subject, setSubject] = useState('')
  const [lossVal, setLossVal] = useState('')
  const [policyType, setPolicyType] = useState('')
  const [desc, setDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [memo, setMemo] = useState(null)
  const [checks, setChecks] = useState({})
  const cacheKey = `aura_claims_${sit.id}`
  const checkKey = `aura_checks_${sit.id}`

  useEffect(() => {
    const c = lsGet(cacheKey, null); if (c) setMemo(c)
    const ch = lsGet(checkKey, {}); setChecks(ch)
  }, [sit.id])

  const checklist = getChecklist(sit, claimType)
  const placeholder = SUBJECT_PLACEHOLDERS[claimType] || 'e.g. Subject of loss'

  const generate = async () => {
    if (!subject && !desc) return
    setLoading(true)
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const system = `You are the Head of Major Loss Claims at a Lloyd's-regulated insurance company in Qatar. Today is ${today}.
Claim type: ${claimType || 'Not specified'}
Situation: ${sit.title} (${sit.severity})
Context: ${sit.summary}
Claims brief: ${sit.interpretations?.claims?.detail || ''}`
    const prompt = `Generate a structured claims reserve memo appropriate for a ${claimType || 'general'} claim:
Subject of loss: ${subject || 'Not specified'}
Estimated loss: ${lossVal || 'Unknown'}
Policy type: ${policyType || 'Not specified'}
Description: ${desc || sit.subtitle}

Format as a professional memo with these sections:
RECOMMENDED INITIAL RESERVE: (range with reasoning)
COVERAGE TRIGGER QUESTIONS: (3-4 specific questions to investigate)
GENERAL AVERAGE: (applicable / not applicable, with brief reason)
PRIORITY ACTIONS: (3 numbered immediate steps)

Be direct and specific. Max 300 words.`
    try {
      const reply = await callClaude(system, [{ role: 'user', content: prompt }], 800)
      setMemo(reply); lsSet(cacheKey, reply)
    } catch { setMemo('Error generating memo. Please retry.') }
    setLoading(false)
  }

  const toggleCheck = (i) => {
    const updated = { ...checks, [i]: !checks[i] }
    setChecks(updated); lsSet(checkKey, updated)
  }

  const checkedCount = Object.values(checks).filter(Boolean).length

  return <div className="dept-panel claims-panel">
    <div className="dept-panel-header" onClick={() => setOpen(!open)}>
      <span className="dept-panel-title">◆ CLAIMS TOOLS</span>
      <button className="dept-panel-toggle">{open ? '▲ Collapse' : '▼ Expand'}</button>
    </div>
    {open && <div className="dept-panel-body">
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 10, textTransform: 'uppercase' }}>Loss Reserve Assistant</div>
      <div className="reserve-form">
        <div className="reserve-field">
          <span className="reserve-label">Claim Type</span>
          <select className="reserve-input" value={claimType} onChange={e => setClaimType(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="">— Select claim type —</option>
            {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="reserve-row">
          <div className="reserve-field">
            <span className="reserve-label">Subject of Loss</span>
            <input className="reserve-input" placeholder={placeholder} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="reserve-field">
            <span className="reserve-label">Est. Loss Value</span>
            <input className="reserve-input" placeholder="e.g. $12m" value={lossVal} onChange={e => setLossVal(e.target.value)} />
          </div>
        </div>
        <div className="reserve-field">
          <span className="reserve-label">Policy Type</span>
          <input className="reserve-input" placeholder={claimType ? `e.g. ${claimType} policy` : 'e.g. Marine Hull War Risk'} value={policyType} onChange={e => setPolicyType(e.target.value)} />
        </div>
        <div className="reserve-field">
          <span className="reserve-label">Loss Description (optional)</span>
          <input className="reserve-input" placeholder="Brief description of loss event…" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <button className="reserve-btn" onClick={generate} disabled={loading || (!subject && !desc)}>
          {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><div className="ai-loading" style={{ transform: 'scale(.7)' }}><span /><span /><span /></div>Generating memo…</span> : 'Generate Reserve Memo →'}
        </button>
      </div>
      {memo && <div style={{ marginTop: 12 }}>
        <div className="reserve-output-label">Reserve Memo</div>
        <div className="reserve-output"><Markdown>{memo}</Markdown></div>
        <button onClick={() => { setMemo(null); lsSet(cacheKey, null) }} style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, opacity: .7 }}>↺ Clear memo</button>
      </div>}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 14 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '.06em', marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Coverage Trigger Checklist — {checklist.category}</span>
          <span style={{ color: 'var(--ink-4)' }}>{checkedCount}/{checklist.items.length}</span>
        </div>
        <div className="checklist-grid">
          {checklist.items.map((item, i) => <div key={`${checklist.category}-${i}`} className={`checklist-item ${checks[i] ? 'checked' : ''}`} onClick={() => toggleCheck(i)}>
            <div className="checklist-cb">{checks[i] && <span style={{ fontSize: 9, fontWeight: 700 }}>✓</span>}</div>
            <span className="checklist-text">{item}</span>
          </div>)}
        </div>
      </div>
      <div className="ai-disclaimer" style={{ marginTop: 12 }}>AI-generated memo — validate with senior claims handler before reserving. Not legal advice.</div>
    </div>}
  </div>
}

export default ClaimsPanel
