import { useState, useEffect, useRef } from 'react'
import { callClaude, getRegQueryHistory, saveRegQueryHistory } from '../../api/client'
import { lsGet, lsSet } from '../../utils/storage'
import Markdown from '../Markdown'

const RQA_SUGGESTIONS = [
  'What compliance actions are due before end of March 2026?',
  'Which regulations affect our UAE operations most urgently?',
  'What are our QFC reporting obligations this quarter?',
  'How does the SAMA reinsurance retention rule affect our KSA business?',
]

function RegQueryAssistant({regulations}){
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState(()=>lsGet('aura_rqa_messages',[]));
  const [input,setInput]=useState('');
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages,loading]);

  const regContext=regulations.map(r=>
    `[${r.id}] ${r.jurisdiction} — ${r.regulator} — ${r.title}\nEffective: ${r.effectiveDate} | Urgency: ${r.urgency} | Type: ${r.changeType}\nSummary: ${r.summary}\nCompliance obligation: ${r.complianceImplication}`
  ).join('\n\n');

  const system=`You are a senior regulatory compliance officer at a Lloyd's-regulated insurance company based in Qatar. Today is 10 March 2026.

You have access to the following regulatory intelligence across Qatar (QCB, QFCRA), UAE (CBUAE, Sanadak) and Saudi Arabia (SAMA):

${regContext}

Answer questions by citing specific regulation IDs (e.g. [reg2]) and providing direct, actionable compliance guidance. Be specific about deadlines and obligations. Flag any overdue items prominently. Do not fabricate obligations not in the data above.`;

  const send=async(text)=>{
    const q=(text||input).trim();
    if(!q||loading)return;
    setInput('');
    const updated=[...messages,{role:'user',content:q}];
    setMessages(updated);lsSet('aura_rqa_messages',updated);
    setLoading(true);
    try{
      const reply=await callClaude(system,updated.map(m=>({role:m.role,content:m.content})),1000);
      const final=[...updated,{role:'assistant',content:reply}];
      setMessages(final);lsSet('aura_rqa_messages',final);
    }catch{
      const final=[...updated,{role:'assistant',content:'Connection error. Please retry.'}];
      setMessages(final);lsSet('aura_rqa_messages',final);
    }
    setLoading(false);
  };

  const clear=()=>{setMessages([]);lsSet('aura_rqa_messages',[])};

  if(!open)return <button className="rqa-open-btn" onClick={()=>setOpen(true)}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontFamily:'IBM Plex Mono',fontSize:8,background:'var(--reg)',color:'#fff',padding:'2px 5px',borderRadius:2,letterSpacing:'.06em'}}>◆ AI</span>
      <span>Cross-Regulation Query Assistant</span>
      {messages.length>0&&<span style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--reg)',opacity:.7}}>{Math.floor(messages.length/2)} prior exchanges</span>}
    </div>
    <span style={{opacity:.5,fontSize:12}}>▼</span>
  </button>;

  return <div className="rqa-panel">
    <div className="rqa-header">
      <span className="rqa-title">◆ CROSS-REGULATION QUERY ASSISTANT</span>
      <div style={{display:'flex',gap:8}}>
        <button className="rqa-toggle" onClick={clear}>Clear</button>
        <button className="rqa-toggle" onClick={()=>setOpen(false)}>▲ Hide</button>
      </div>
    </div>
    {messages.length===0&&<div className="rqa-suggestions">
      <div style={{fontFamily:'IBM Plex Mono',fontSize:9,color:'var(--ink-4)',padding:'4px 0',letterSpacing:'.04em'}}>Ask about any regulation, deadline, or cross-jurisdiction obligation:</div>
      {RQA_SUGGESTIONS.map((s,i)=><button key={i} className="rqa-suggestion" onClick={()=>send(s)}>{s}</button>)}
    </div>}
    {messages.length>0&&<div className="rqa-messages">
      {messages.map((m,i)=><div key={i} className={`rqa-msg ${m.role==='user'?'rqa-msg-user':'rqa-msg-assistant'}`}>
        <div className="rqa-msg-label">{m.role==='user'?'YOU':'REGULATORY AI'}</div>
        {m.role==='assistant'?<Markdown>{m.content}</Markdown>:<div>{m.content}</div>}
      </div>)}
      {loading&&<div className="rqa-msg rqa-msg-assistant"><div className="ai-loading"><span/><span/><span/></div></div>}
      <div ref={endRef}/>
    </div>}
    <div className="rqa-input-row">
      <textarea className="rqa-input" placeholder="Ask about any regulation or compliance deadline…" value={input} rows={1}
        onChange={e=>setInput(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/>
      <button className="rqa-send-btn" onClick={()=>send()} disabled={!input.trim()||loading}>Send</button>
    </div>
  </div>;
}

// ─── 3. VERSION COMPARISON ────────────────────────────────────────────────────

export default RegQueryAssistant
