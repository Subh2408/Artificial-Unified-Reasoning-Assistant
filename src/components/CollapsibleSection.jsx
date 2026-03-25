import { useState } from 'react'
import { lsGet, lsSet } from '../utils/storage'

export default function CollapsibleSection({ label, storageKey, children, defaultOpen = true }) {
  const [open, setOpen] = useState(() => lsGet(storageKey, defaultOpen))
  const toggle = () => { const next = !open; setOpen(next); lsSet(storageKey, next) }

  return (
    <div className="collapsible-section">
      <div className="section-header-toggle" onClick={toggle}>
        <span className="brief-lines-label">{label}</span>
        <span className="collapse-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && <div className="section-content">{children}</div>}
    </div>
  )
}
