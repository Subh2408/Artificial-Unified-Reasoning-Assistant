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
          <div key={d.key} className="gate-tile" onClick={() => onSelect(d.key)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="gate-tile-dot" style={{ background: d.dotColor }} />
              <span className="gate-tile-name">{d.label}</span>
            </div>
            <div className="gate-tile-desc">{d.desc}</div>
          </div>
        ))}
        <div className="gate-tile coming-soon">
          <span className="gate-tile-name" style={{ fontSize: 13, opacity: 0.5 }}>Coming soon</span>
          <span className="gate-tile-desc" style={{ textAlign: 'center' }}>Finance · Legal · Operations</span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', margin: '16px auto 0', width: '100%', maxWidth: 640, paddingTop: 16 }}>
        <button className="gate-btn" onClick={() => onSelect('executive')} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
          <div className="gate-btn-left">
            <span className="gate-btn-name">Executive Overview</span>
            <span className="gate-btn-desc">Company-wide · All departments · Board view</span>
          </div>
          <span className="gate-btn-arrow">→</span>
        </button>
      </div>
    </div>
  )
}
