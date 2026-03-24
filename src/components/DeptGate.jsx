import { DEPTS } from '../constants/depts'

export default function DeptGate({ onSelect }) {
  return (
    <div className="gate">
      <div className="gate-logo">AURA</div>
      <div className="gate-title">Insurance Intelligence</div>
      <div className="gate-sub">{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}).toUpperCase()} · DOHA</div>
      <div className="gate-label">Select your department to begin</div>
      <div className="gate-grid">
        {DEPTS.map((d) => (
          <button key={d.key} className="gate-btn" onClick={() => onSelect(d.key)}>
            <div className="gate-btn-left">
              <span className="gate-btn-name">{d.label}</span>
              <span className="gate-btn-desc">{d.desc}</span>
            </div>
            <span className="gate-btn-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
