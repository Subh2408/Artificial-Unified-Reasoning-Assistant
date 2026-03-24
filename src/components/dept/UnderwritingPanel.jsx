import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'
import Markdown from '../Markdown'

function UnderwritingPanel({sit}){
  const [open,setOpen]=useState(true);
  const [appetite,setAppetite]=useState(()=>lsGet(`aura_uw_appetite_${sit.id}`,''));
  const [rateOutput,setRateOutput]=useState(()=>lsGet(`aura_uw_rate_${sit.id}`,null));
  const [exclInput,setExclInput]=useState('');
  const [exclOutput,setExclOutput]=useState(()=>lsGet(`aura_uw_excl_${sit.id}`,null));
  const [rateLoading,setRateLoading]=useState(false);
  const [exclLoading,setExclLoading]=useState(false);

  const setApp=(v)=>{setAppetite(v);lsSet(`aura_uw_appetite_${sit.id}`,v);};

  const appColors={SUSPEND:{bg:'#FEF2F2',border:'#C8001E',text:'#C8001E'},CAUTION:{bg:'#FFFBEB',border:'#D97706',text:'#D97706'},WRITE:{bg:'var(--reg-light)',border:'var(--reg)',text:'var(--reg)'}};
  const appLabels={SUSPEND:'SUSPEND',CAUTION:'CAUTION',WRITE:'WRITE W/ CONDITIONS'};

  const genRate=async()=>{
    setRateLoading(true);
    const system=`You are a Senior Lloyd's Underwriter in Qatar with 20 years of marine/energy/specialty experience. Today: 10 March 2026.`;
    const prompt=`Situation: ${sit.title} — ${sit.subtitle}
Summary: ${sit.summary}
Underwriting brief: ${sit.interpretations?.underwriting?.detail||''}

Write a concise rate guidance note (3-4 sentences): what is the current market rate direction, what is the baseline vs current pricing implied by this situation, and what conditions or exclusions should apply. Be specific about line of business.`;
    try{
      const r=await callClaude(system,[{role:'user',content:prompt}],400);
      setRateOutput(r);lsSet(`aura_uw_rate_${sit.id}`,r);
    }catch{setRateOutput('Error generating guidance.');}
    setRateLoading(false);
  };

  const genExcl=async()=>{
    if(!exclInput.trim())return;
    setExclLoading(true);
    const system=`You are a Senior Lloyd's Underwriter drafting policy exclusion clauses. Today: 10 March 2026.`;
    const prompt=`Situation: ${sit.title}
Risk to exclude: ${exclInput}
Situation context: ${sit.summary}

Draft a concise policy exclusion clause (2-4 sentences, plain English with legal precision) that would exclude this risk from a standard marine/energy policy given the current situation. Note that this is a draft requiring legal review.`;
    try{
      const r=await callClaude(system,[{role:'user',content:prompt}],400);
      setExclOutput(r);lsSet(`aura_uw_excl_${sit.id}`,r);
    }catch{setExclOutput('Error generating clause.');}
    setExclLoading(false);
  };

  return <div className="dept-panel uw-panel">
    <div className="dept-panel-header" onClick={()=>setOpen(!open)}>
      <span className="dept-panel-title">◆ UNDERWRITING TOOLS</span>
      <button className="dept-panel-toggle">{open?'▲ Collapse':'▼ Expand'}</button>
    </div>
    {open&&<div className="dept-panel-body">
      <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--reg)',letterSpacing:'.06em',marginBottom:8,textTransform:'uppercase'}}>Appetite Signal</div>
      <div className="appetite-row">
        {['SUSPEND','CAUTION','WRITE'].map(v=><button key={v}
          className={`appetite-btn ${v.toLowerCase()} ${appetite===v?'active':''}`}
          onClick={()=>setApp(appetite===v?'':v)}>
          {appLabels[v]}
        </button>)}
      </div>
      {appetite&&<div style={{padding:'8px 12px',borderRadius:4,background:appColors[appetite]?.bg,border:`1px solid ${appColors[appetite]?.border}`,fontFamily:'IBM Plex Mono',fontSize:10,color:appColors[appetite]?.text,letterSpacing:'.04em',marginBottom:10}}>
        Current position: <strong>{appLabels[appetite]}</strong> — {appetite==='SUSPEND'?'No new business until further notice':appetite==='CAUTION'?'Write with enhanced scrutiny and senior approval':'Write with situation-specific conditions and exclusions'}
      </div>}

      <div className="uw-section-label">Rate Guidance</div>
      {!rateOutput&&<button className="uw-gen-btn" onClick={genRate} disabled={rateLoading}>
        {rateLoading?<><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Generating…</>:<><span>◆</span>Generate Rate Guidance</>}
      </button>}
      {rateOutput&&<div>
        <div className="uw-output"><Markdown>{rateOutput}</Markdown></div>
        <button onClick={()=>{setRateOutput(null);lsSet(`aura_uw_rate_${sit.id}`,null)}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:4,opacity:.7}}>↺ Regenerate</button>
      </div>}

      <div className="uw-section-label" style={{marginTop:12}}>Exclusion Drafter</div>
      <input className="excl-input" placeholder="Describe the risk to exclude (e.g. Gulf war risk, Iranian cyber)…"
        value={exclInput} onChange={e=>setExclInput(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();genExcl();}}}/>
      <button className="uw-gen-btn" onClick={genExcl} disabled={exclLoading||!exclInput.trim()}>
        {exclLoading?<><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Drafting…</>:<><span>◆</span>Draft Exclusion Clause</>}
      </button>
      {exclOutput&&<div>
        <div className="uw-output" style={{borderLeft:'3px solid var(--reg)',paddingLeft:10}}><Markdown>{exclOutput}</Markdown></div>
        <div style={{fontFamily:'IBM Plex Mono',fontSize:8,color:'var(--ink-4)',marginTop:4,letterSpacing:'.03em'}}>DRAFT ONLY — requires legal review before use</div>
        <button onClick={()=>{setExclOutput(null);lsSet(`aura_uw_excl_${sit.id}`,null);setExclInput('');}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:2,opacity:.7}}>↺ Clear</button>
      </div>}
      <div className="ai-disclaimer" style={{marginTop:12}}>Appetite signals are working records only. Rate guidance and exclusion clauses are AI-generated drafts — not binding underwriting decisions.</div>
    </div>}
  </div>;
}

// ─── INVESTMENTS PANEL ────────────────────────────────────────────────────────

export default UnderwritingPanel
