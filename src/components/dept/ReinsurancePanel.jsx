import { useState, useEffect } from 'react'
import { lsGet, lsSet } from '../../utils/storage'
import { callClaude, getDeptAction, saveDeptAction } from '../../api/client'
import Markdown from '../Markdown'

function ReinsurancePanel({sit}){
  const [open,setOpen]=useState(true);
  const cacheKey=`aura_rei_${sit.id}`;
  const [declared,setDeclared]=useState(()=>lsGet(`${cacheKey}_declared`,false));
  const [eventDate,setEventDate]=useState(()=>lsGet(`${cacheKey}_edate`,'2026-03-10'));
  const [pml,setPml]=useState(()=>lsGet(`${cacheKey}_pml`,{opt:'',base:'',sev:''}));
  const [notifOutput,setNotifOutput]=useState(()=>lsGet(`${cacheKey}_notif`,null));
  const [notifLoading,setNotifLoading]=useState(false);

  const toggleDeclared=()=>{const d=!declared;setDeclared(d);lsSet(`${cacheKey}_declared`,d);};
  const updateDate=(v)=>{setEventDate(v);lsSet(`${cacheKey}_edate`,v);};
  const updatePml=(k,v)=>{const u={...pml,[k]:v};setPml(u);lsSet(`${cacheKey}_pml`,u);};

  const genNotif=async()=>{
    setNotifLoading(true);
    const system=`You are a Senior Reinsurance Analyst at a Lloyd's-regulated insurer in Qatar. Today: 10 March 2026.`;
    const hasPml=pml.opt||pml.base||pml.sev;
    const prompt=`Generate a formal reinsurance notification letter draft for:
Event: ${sit.title}
Event reference date: ${eventDate}
Situation: ${sit.summary}
Reinsurance brief: ${sit.interpretations?.reinsurance?.detail||''}
${hasPml?`PML estimates — Optimistic: ${pml.opt||'TBD'}, Base: ${pml.base||'TBD'}, Severe: ${pml.sev||'TBD'}`:'PML estimates to be confirmed.'}

Format as a formal notification letter to lead reinsurers. Include: event reference, date of loss, affected lines, preliminary loss estimate, reservation of rights language, and request for claims handler appointment. Mark clearly as DRAFT. Max 250 words.`;
    try{
      const r=await callClaude(system,[{role:'user',content:prompt}],600);
      setNotifOutput(r);lsSet(`${cacheKey}_notif`,r);
    }catch{setNotifOutput('Error generating notification.');}
    setNotifLoading(false);
  };

  return <div className="dept-panel rei-panel">
    <div className="dept-panel-header" onClick={()=>setOpen(!open)}>
      <span className="dept-panel-title">◆ REINSURANCE TOOLS</span>
      <button className="dept-panel-toggle">{open?'▲ Collapse':'▼ Expand'}</button>
    </div>
    {open&&<div className="dept-panel-body">
      <div className="rei-toggle-row">
        <button className={`rei-toggle-switch ${declared?'on':'off'}`} onClick={e=>{e.stopPropagation();toggleDeclared();}}/>
        <div>
          <div className="rei-toggle-label">{declared?'Cat Event Declared':'Declare as Cat Event'}</div>
          <span className="rei-toggle-sub">{declared?`Ref date: ${eventDate} — treaties under review`:'Toggle to open accumulation tracking'}</span>
        </div>
      </div>

      {declared&&<>
        <div className="rei-section-label">Event Reference Date</div>
        <input type="date" className="reserve-input" value={eventDate} onChange={e=>updateDate(e.target.value)} style={{marginBottom:10,width:'100%'}}/>

        <div className="rei-section-label">PML Scenario Builder</div>
        <div className="rei-pml-grid">
          {[['opt','Optimistic','sev-watch'],['base','Base Case','sev-elevated'],['sev','Severe','urgent']].map(([k,label,cls])=>
            <div key={k} className="rei-pml-col">
              <div className={`rei-pml-scenario ${k}`}>{label}</div>
              <input className="rei-pml-input" placeholder="$0m" value={pml[k]} onChange={e=>updatePml(k,e.target.value)}/>
              <div className="rei-pml-label">Gross loss est.</div>
            </div>)}
        </div>

        <button className="rei-gen-btn" onClick={genNotif} disabled={notifLoading}>
          {notifLoading?<><div className="ai-loading" style={{transform:'scale(.7)'}}><span/><span/><span/></div>Drafting notification…</>:<><span>◆</span>Draft Reinsurer Notification</>}
        </button>
        {notifOutput&&<div>
          <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-2)',textTransform:'uppercase',letterSpacing:'.06em',margin:'8px 0 4px'}}>Notification Draft</div>
          <div className="rei-output"><Markdown>{notifOutput}</Markdown></div>
          <button onClick={()=>{setNotifOutput(null);lsSet(`${cacheKey}_notif`,null)}} style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',background:'none',border:'none',cursor:'pointer',marginTop:4,opacity:.7}}>↺ Regenerate</button>
        </div>}
      </>}

      {!declared&&<div style={{padding:'16px',textAlign:'center',fontFamily:'IBM Plex Mono',fontSize:10,color:'var(--ink-4)',lineHeight:1.6}}>
        Toggle above to declare this situation as a cat event.<br/>Enables PML tracking and reinsurer notification drafting.
      </div>}

      <div className="ai-disclaimer" style={{marginTop:12}}>Notification drafts require review by reinsurance manager before sending. PML figures are working estimates only.</div>
    </div>}
  </div>;
}

export default ReinsurancePanel
