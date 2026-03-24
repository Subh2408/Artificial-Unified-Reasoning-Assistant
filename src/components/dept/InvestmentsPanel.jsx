import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'
import Markdown from '../Markdown'

function InvestmentsPanel({sit}){
  const [open,setOpen]=useState(true);
  const [positions,setPositions]=useState(()=>lsGet(`aura_inv_pos_${sit.id}`,{sov:'',ship:'',energy:'',alt:''}));
  const [stressOutput,setStressOutput]=useState(()=>lsGet(`aura_inv_stress_${sit.id}`,null));
  const [oppOutput,setOppOutput]=useState(()=>lsGet(`aura_inv_opp_${sit.id}`,null));
  const [stressLoading,setStressLoading]=useState(false);
  const [oppLoading,setOppLoading]=useState(false);

  const updatePos=(k,v)=>{const u={...positions,[k]:v};setPositions(u);lsSet(`aura_inv_pos_${sit.id}`,u);};

  const genStress=async()=>{
    setStressLoading(true);
    const system=`You are an insurance asset manager at a Qatar-based Lloyd's insurer managing a GCC-focused investment portfolio. Today: 10 March 2026.`;
    const hasPos=Object.values(positions).some(v=>v.trim());
    const posText=hasPos?`Current positions: Gulf sovereign bonds: ${positions.sov||'not entered'}, Shipping equities: ${positions.ship||'not entered'}, Energy equities: ${positions.energy||'not entered'}, Alternatives: ${positions.alt||'not entered'}`:'No specific positions entered — provide general portfolio guidance.';
    const prompt=`Situation: ${sit.title} — ${sit.subtitle}
Context: ${sit.summary}
Investments brief: ${sit.interpretations?.investments?.detail||''}
${posText}

Generate a stress scenario analysis (3-4 paragraphs): (1) immediate market impact of this situation on Gulf sovereign credit and relevant equities, (2) 30-day scenario if situation persists, (3) specific portfolio implications based on positions above, (4) one contrarian opportunity. Be specific with indicative bps or % moves where credible. Label all figures as illustrative.`;
    try{
      const r=await callClaude(system,[{role:'user',content:prompt}],600);
      setStressOutput(r);lsSet(`aura_inv_stress_${sit.id}`,r);
    }catch{setStressOutput('Error generating analysis.');}
    setStressLoading(false);
  };

  const genOpp=async()=>{
    setOppLoading(true);
    const system=`You are an insurance asset manager at a Qatar-based Lloyd's insurer. Today: 10 March 2026.`;
    const prompt=`Situation: ${sit.title} — ${sit.summary}

Identify 3-4 specific investment opportunities created by this situation. Include at least one contrarian call. For each: name the opportunity, why the situation creates it, and the key risk to the thesis. Be direct and specific. Max 200 words total.`;
    try{
      const r=await callClaude(system,[{role:'user',content:prompt}],400);
      setOppOutput(r);lsSet(`aura_inv_opp_${sit.id}`,r);
    }catch{setOppOutput('Error generating scanner.');}
    setOppLoading(false);
  };

  return <div className="dept-panel inv-panel">
    <div className="dept-panel-header" onClick={()=>setOpen(!open)}>
      <span className="dept-panel-title">◆ INVESTMENTS TOOLS</span>
      <button className="dept-panel-toggle">{open?'▲ Collapse':'▼ Expand'}</button>
    </div>
    {open&&<div className="dept-panel-body">
      <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ai)',letterSpacing:'.06em',marginBottom:8,textTransform:'uppercase'}}>Portfolio Position Inputs (optional)</div>
      <div className="inv-positions">
        {[['sov','Gulf Sovereign Bonds','e.g. QAT $10m, UAE $5m'],['ship','Shipping Equities','e.g. Long Frontline $2m'],['energy','Energy Equities','e.g. Long QatarEnergy $8m'],['alt','Alternatives/ILS','e.g. Cat bond exposure $3m']].map(([k,l,p])=>
          <div key={k} className="inv-field">
            <span className="inv-label">{l}</span>
            <input className="inv-input" placeholder={p} value={positions[k]} onChange={e=>updatePos(k,e.target.value)}/>
          </div>)}
      </div>
      <button className="inv-btn" onClick={genStress} disabled={stressLoading}>
        {stressLoading?<span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Running stress scenario…</span>:'Run Portfolio Stress Scenario →'}
      </button>
      {stressOutput&&<div>
        <div className="inv-output-label">Stress Scenario</div>
        <div className="inv-output"><Markdown>{stressOutput}</Markdown></div>
        <button onClick={()=>{setStressOutput(null);lsSet(`aura_inv_stress_${sit.id}`,null)}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:4,opacity:.7}}>↺ Regenerate</button>
      </div>}

      <div style={{borderTop:'1px solid var(--border)',paddingTop:10,marginTop:12}}>
        <button className="inv-opp-btn" onClick={genOpp} disabled={oppLoading}>
          {oppLoading?<><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Scanning…</>:<><span>◆</span>Opportunity Scanner</>}
        </button>
        {oppOutput&&<div>
          <div className="inv-output-label">Opportunities</div>
          <div className="inv-output"><Markdown>{oppOutput}</Markdown></div>
          <button onClick={()=>{setOppOutput(null);lsSet(`aura_inv_opp_${sit.id}`,null)}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:4,opacity:.7}}>↺ Clear</button>
        </div>}
      </div>
      <div className="ai-disclaimer" style={{marginTop:12}}>All figures are illustrative only. Not investment advice. Validate with portfolio manager before acting.</div>
    </div>}
  </div>;
}

// ─── REINSURANCE PANEL ────────────────────────────────────────────────────────

export default InvestmentsPanel
