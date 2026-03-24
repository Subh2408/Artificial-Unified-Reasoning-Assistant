import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'

function VersionComparison({reg}){
  const [state,setState]=useState('idle'); // idle | loading | done
  const [result,setResult]=useState(null);
  const cacheKey=`aura_vc_${reg.id}`;

  useEffect(()=>{
    const cached=lsGet(cacheKey,null);
    if(cached){setResult(cached);setState('done');}
  },[reg.id]);

  const generate=async()=>{
    setState('loading');
    const system=`You are a regulatory compliance expert. Analyse the following regulatory amendment and produce a structured comparison.

Regulation: ${reg.title}
Jurisdiction: ${reg.jurisdiction} | Regulator: ${reg.regulatorFull}
Effective date: ${reg.effectiveDate}
Summary: ${reg.summary}
Compliance implication: ${reg.complianceImplication}

Return ONLY a JSON object with exactly these fields, no markdown, no preamble:
{
  "before": "What the previous obligation/requirement was (2-3 sentences)",
  "after": "What the new obligation/requirement is (2-3 sentences)",
  "keyChange": "The single most important change in one sentence",
  "actionRequired": "The specific action a Qatar-based insurer must take"
}`;
    try{
      const raw=await callClaude(system,[{role:'user',content:'Generate the version comparison now.'}],600);
      const clean=raw.replace(/```json|```/g,'').trim();
      const parsed=JSON.parse(clean);
      setResult(parsed);lsSet(cacheKey,parsed);setState('done');
    }catch{
      setResult({before:'',after:'',keyChange:'Error generating comparison.',actionRequired:'Please retry.'});
      setState('done');
    }
  };

  return <div className="vc-section">
    {state==='idle'&&<button className="vc-btn" onClick={generate}>
      <span style={{fontFamily:'IBM Plex Mono',fontSize:9,background:'var(--reg-light)',color:'var(--reg)',border:'1px solid var(--reg-border)',padding:'2px 5px',borderRadius:2}}>AMENDMENT</span>
      What changed in this amendment? →
    </button>}
    {state==='loading'&&<button className="vc-btn" disabled>
      <div className="ai-loading" style={{scale:'.7'}}><span/><span/><span/></div>
      Analysing amendment…
    </button>}
    {state==='done'&&result&&<div className="vc-panel">
      <div className="vc-panel-header">
        <span className="vc-panel-title">AMENDMENT COMPARISON — {reg.regulator}</span>
        <button style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--reg)',background:'none',border:'none',cursor:'pointer',opacity:.7}} onClick={()=>{setState('idle');setResult(null);lsSet(cacheKey,null)}}>↺ Regenerate</button>
      </div>
      <div className="vc-grid">
        <div className="vc-col vc-col-before">
          <div className="vc-col-label">← Previous obligation</div>
          <div className="vc-col-text">{result.before}</div>
        </div>
        <div className="vc-col vc-col-after">
          <div className="vc-col-label">→ New obligation</div>
          <div className="vc-col-text">{result.after}</div>
        </div>
      </div>
      <div className="vc-summary">
        <div className="vc-summary-label">Key change</div>
        <div style={{marginBottom:8}}>{result.keyChange}</div>
        <div className="vc-summary-label">Action required</div>
        <div style={{color:'var(--urgent)',fontWeight:500}}>{result.actionRequired}</div>
      </div>
    </div>}
  </div>;
}

// ─── 4. DEPARTMENT IMPACT ANALYSIS ───────────────────────────────────────────

export default VersionComparison
