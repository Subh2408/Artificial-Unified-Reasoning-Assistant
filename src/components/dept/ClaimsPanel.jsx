import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'
import Markdown from '../Markdown'

const COVERAGE_CHECKLISTS={
  'Marine Hull':['Is the vessel covered under a current hull policy — confirm period of cover?','Did the loss occur before or after P&I war risk cancellation notice expiry?','Has the owner declared General Average — if so, appoint GA adjuster immediately?','Is the vessel flagged with a P&I club that issued cancellation — check club membership?','Is there a separate war risk endorsement or is it within the main hull policy?','Confirm ISM certification and class survey status at time of loss'],
  'Marine Cargo':['Is there a clean bill of lading — any noted exceptions affect coverage?','Was the cargo in transit or in a warehouse at the time of the event?','Does the policy include war risk and strikes cover — check Institute Cargo Clauses?','Confirm the named insured and whether any intermediary holds the policy?','Is there a general average contribution claim — identify cargo interests?','Check for any accumulation with other cargo claims from the same vessel'],
  'War Risk':['Was valid war risk cover in force at the exact time of the incident?','Has a P&I or hull war risk notice been given — what is the cut-off timestamp?','Is this a state-sponsored act or non-state actor — affects treaty classification?','Are OFAC/UN sanctions relevant to the vessel owner or charterer?','Check for double insurance — hull and cargo may both have war risk sections'],
  'Energy':['Is the facility onshore or offshore — different policy structures apply?','Was there a physical loss or damage trigger — business interruption requires damage?','Check control of well coverage if applicable — blowout or seepage?','Confirm operator status — named insured vs additional insured distinction?','Is there a cyber exclusion in the energy policy — check NMA 2914 or equivalent?'],
  'Cyber':['Is the affected system covered under a standalone cyber policy or property policy?','Check for silent cyber in property/marine policies — NMA 2914 exclusion?','Was there a physical loss or just data/system compromise?','Identify whether this is a first-party (own damage) or third-party (liability) claim?','Check ransomware payment provisions — some policies require insurer consent?','Confirm the cyber incident response retainer has been notified'],
  'Property':['Confirm the material damage trigger — is there physical loss or damage?','Is business interruption covered — check indemnity period and waiting period?','War and civil commotion exclusion — check policy wording carefully?','Is there a sanctions exclusion that could affect the policyholder or counter-party?','Appoint a loss adjuster — confirm they have local market experience?'],
};

function getChecklist(sit){
  for(const cat of (sit.category||[])){
    if(COVERAGE_CHECKLISTS[cat])return{category:cat,items:COVERAGE_CHECKLISTS[cat]};
  }
  return{category:'General',items:['Confirm policy is in force and period of cover is current','Identify the named insured and verify insurable interest','Check for any relevant exclusions before accepting the claim','Appoint specialist adjusters appropriate to the loss type','Notify reinsurers per treaty notification obligations']};
}

// ─── CLAIMS PANEL ─────────────────────────────────────────────────────────────

function ClaimsPanel({sit}){
  const [open,setOpen]=useState(true);
  const [vessel,setVessel]=useState('');
  const [lossVal,setLossVal]=useState('');
  const [policyType,setPolicyType]=useState('');
  const [desc,setDesc]=useState('');
  const [loading,setLoading]=useState(false);
  const [memo,setMemo]=useState(null);
  const [checks,setChecks]=useState({});
  const cacheKey=`aura_claims_${sit.id}`;
  const checkKey=`aura_checks_${sit.id}`;

  useEffect(()=>{
    const c=lsGet(cacheKey,null);if(c)setMemo(c);
    const ch=lsGet(checkKey,{});setChecks(ch);
  },[sit.id]);

  const checklist=getChecklist(sit);

  const generate=async()=>{
    if(!vessel&&!desc)return;
    setLoading(true);
    const system=`You are the Head of Major Loss Claims at a Lloyd's-regulated insurance company in Qatar. Today is 10 March 2026.
Situation: ${sit.title} (${sit.severity})
Context: ${sit.summary}
Claims brief: ${sit.interpretations?.claims?.detail||''}`;
    const prompt=`Generate a structured claims reserve memo for:
Vessel/Asset: ${vessel||'Not specified'}
Estimated loss: ${lossVal||'Unknown'}
Policy type: ${policyType||'Not specified'}
Description: ${desc||sit.subtitle}

Format as a professional memo with these sections:
RECOMMENDED INITIAL RESERVE: (range with reasoning)
COVERAGE TRIGGER QUESTIONS: (3-4 specific questions to investigate)
GENERAL AVERAGE: (applicable / not applicable, with brief reason)
PRIORITY ACTIONS: (3 numbered immediate steps)

Be direct and specific. Max 300 words.`;
    try{
      const reply=await callClaude(system,[{role:'user',content:prompt}],800);
      setMemo(reply);lsSet(cacheKey,reply);
    }catch{setMemo('Error generating memo. Please retry.');}
    setLoading(false);
  };

  const toggleCheck=(i)=>{
    const updated={...checks,[i]:!checks[i]};
    setChecks(updated);lsSet(checkKey,updated);
  };

  const checkedCount=Object.values(checks).filter(Boolean).length;

  return <div className="dept-panel claims-panel">
    <div className="dept-panel-header" onClick={()=>setOpen(!open)}>
      <span className="dept-panel-title">◆ CLAIMS TOOLS</span>
      <button className="dept-panel-toggle">{open?'▲ Collapse':'▼ Expand'}</button>
    </div>
    {open&&<div className="dept-panel-body">
      <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'#991B1B',letterSpacing:'.06em',marginBottom:10,textTransform:'uppercase'}}>Loss Reserve Assistant</div>
      <div className="reserve-form">
        <div className="reserve-row">
          <div className="reserve-field">
            <span className="reserve-label">Vessel / Asset</span>
            <input className="reserve-input" placeholder="e.g. MV Nova Spirit" value={vessel} onChange={e=>setVessel(e.target.value)}/>
          </div>
          <div className="reserve-field">
            <span className="reserve-label">Est. Loss Value</span>
            <input className="reserve-input" placeholder="e.g. $12m" value={lossVal} onChange={e=>setLossVal(e.target.value)}/>
          </div>
        </div>
        <div className="reserve-field">
          <span className="reserve-label">Policy Type</span>
          <input className="reserve-input" placeholder="e.g. Marine Hull War Risk" value={policyType} onChange={e=>setPolicyType(e.target.value)}/>
        </div>
        <div className="reserve-field">
          <span className="reserve-label">Loss Description (optional)</span>
          <input className="reserve-input" placeholder="Brief description of loss event…" value={desc} onChange={e=>setDesc(e.target.value)}/>
        </div>
        <button className="reserve-btn" onClick={generate} disabled={loading||(!vessel&&!desc)}>
          {loading?<span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Generating memo…</span>:'Generate Reserve Memo →'}
        </button>
      </div>
      {memo&&<div style={{marginTop:12}}>
        <div className="reserve-output-label">Reserve Memo</div>
        <div className="reserve-output"><Markdown>{memo}</Markdown></div>
        <button onClick={()=>{setMemo(null);lsSet(cacheKey,null)}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:6,opacity:.7}}>↺ Clear memo</button>
      </div>}

      <div style={{borderTop:'1px solid var(--border)',paddingTop:12,marginTop:14}}>
        <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'#991B1B',letterSpacing:'.06em',marginBottom:8,textTransform:'uppercase',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Coverage Trigger Checklist — {checklist.category}</span>
          <span style={{color:'var(--ink-4)'}}>{checkedCount}/{checklist.items.length}</span>
        </div>
        <div className="checklist-grid">
          {checklist.items.map((item,i)=><div key={`${checklist.category}-${i}`} className={`checklist-item ${checks[i]?'checked':''}`} onClick={()=>toggleCheck(i)}>
            <div className="checklist-cb">{checks[i]&&<span style={{fontSize:9,fontWeight:700}}>✓</span>}</div>
            <span className="checklist-text">{item}</span>
          </div>)}
        </div>
      </div>
      <div className="ai-disclaimer" style={{marginTop:12}}>AI-generated memo — validate with senior claims handler before reserving. Not legal advice.</div>
    </div>}
  </div>;
}

// ─── UNDERWRITING PANEL ───────────────────────────────────────────────────────

export default ClaimsPanel
