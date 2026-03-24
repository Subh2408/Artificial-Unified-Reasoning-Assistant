import { fmtDate } from '../../utils/format'

function ComplianceActionDash({regulations, onSelectReg}){
  const REF_DATE=new Date();
  const actionRegs=regulations
    .filter(r=>r.urgency==='ACTION')
    .map(r=>{
      const eff=new Date(r.effectiveDate);
      const diffDays=Math.round((REF_DATE-eff)/(1000*60*60*24));
      return {...r,diffDays,eff};
    })
    .sort((a,b)=>b.diffDays-a.diffDays);

  const overdueCount=actionRegs.filter(r=>r.diffDays>0).length;

  return <div className="cad-panel">
    <div className="cad-header">
      <span className="cad-title">⚖ COMPLIANCE ACTION TRACKER</span>
      <span className="cad-subtitle">{overdueCount} OVERDUE · {actionRegs.length} TOTAL</span>
    </div>
    <div className="cad-list">
      {actionRegs.map(r=>{
        const overdue=r.diffDays>0;
        const today=r.diffDays===0;
        return <div key={r.id} className="cad-item" onClick={()=>onSelectReg(r)}>
          <div className="cad-item-left">
            <div className="cad-item-jur">{r.jurisdiction}</div>
            <div className="cad-item-title">{r.title}</div>
          </div>
          <div className="cad-item-right">
            {overdue&&<div className="cad-overdue">{r.diffDays}d overdue</div>}
            {today&&<div className="cad-due">Today</div>}
            {!overdue&&!today&&<div className="cad-due">Due in {Math.abs(r.diffDays)}d</div>}
            <div className="cad-days-label">Eff. {fmtDate(r.effectiveDate)}</div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ─── 2. CROSS-REGULATION QUERY ASSISTANT ─────────────────────────────────────
const RQA_SUGGESTIONS=[
  'What compliance actions are due before end of March 2026?',
  'Which regulations affect our UAE operations most urgently?',
  'What are our QFC reporting obligations this quarter?',
  'How does the SAMA reinsurance retention rule affect our KSA business?',
];

export default ComplianceActionDash
