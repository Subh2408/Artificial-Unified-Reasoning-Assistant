import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude } from '../../api/client'

const IMPACT_DEPTS=[
  {key:'claims',label:'Claims',dotColor:'#B22222'},
  {key:'underwriting',label:'Underwriting',dotColor:'#6B7280'},
  {key:'reinsurance',label:'Reinsurance',dotColor:'#B87900'},
  {key:'investments',label:'Investments',dotColor:'#6B7280'},
];

function DeptImpactAnalysis({reg}){
  const [state,setState]=useState('idle');
  const [rows,setRows]=useState(null);
  const cacheKey=`aura_dia_${reg.id}`;

  useEffect(()=>{
    const cached=lsGet(cacheKey,null);
    if(cached){setRows(cached);setState('done');}
  },[reg.id]);

  const generate=async()=>{
    setState('loading');
    const system=`You are a senior risk and compliance officer at a Qatar-based Lloyd's-regulated insurer. Today is 10 March 2026.

Regulatory update: ${reg.title}
Jurisdiction: ${reg.jurisdiction} | Regulator: ${reg.regulatorFull} | Effective: ${reg.effectiveDate}
Summary: ${reg.summary}
Claims implication: ${reg.claimsImplication}
Compliance implication: ${reg.complianceImplication}

Return ONLY a JSON array with exactly 4 objects, one per department. No markdown, no preamble:
[
  {"dept":"claims","impact":"1-2 sentence practical impact on the Claims department"},
  {"dept":"underwriting","impact":"1-2 sentence practical impact on the Underwriting department"},
  {"dept":"reinsurance","impact":"1-2 sentence practical impact on the Reinsurance department"},
  {"dept":"investments","impact":"1-2 sentence practical impact on the Investments department"}
]`;
    try{
      const raw=await callClaude(system,[{role:'user',content:'Generate the department impact analysis now.'}],600);
      const clean=raw.replace(/```json|```/g,'').trim();
      const parsed=JSON.parse(clean);
      setRows(parsed);lsSet(cacheKey,parsed);setState('done');
    }catch{
      setRows(IMPACT_DEPTS.map(d=>({dept:d.key,impact:'Error generating analysis.'})));
      setState('done');
    }
  };

  return <div className="dia-section">
    {state==='idle'&&<button className="dia-btn" onClick={generate}>
      <span>◆</span> Generate Department Impact Analysis
    </button>}
    {state==='loading'&&<button className="dia-btn" disabled>
      <div className="ai-loading" style={{scale:'.7'}}><span/><span/><span/></div>
      Analysing cross-department impact…
    </button>}
    {state==='done'&&rows&&<div className="dia-panel">
      <div className="dia-panel-header">
        <span className="dia-panel-title">◆ DEPARTMENT IMPACT ANALYSIS</span>
        <button style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ai)',background:'none',border:'none',cursor:'pointer',opacity:.7}} onClick={()=>{setState('idle');setRows(null);lsSet(cacheKey,null)}}>↺ Regenerate</button>
      </div>
      {rows.map(row=>{
        const d=IMPACT_DEPTS.find(x=>x.key===row.dept)||IMPACT_DEPTS[0];
        return <div key={row.dept} className="dia-row">
          <div className="dia-dept-name">
            <span className="dia-dept-dot" style={{background:d.dotColor}}/>
            {d.label}
          </div>
          <div className="dia-row-text">{row.impact}</div>
        </div>;
      })}
    </div>}
  </div>;
}

// ─── REGULATION DETAIL ────────────────────────────────────────────────────────

export default DeptImpactAnalysis
