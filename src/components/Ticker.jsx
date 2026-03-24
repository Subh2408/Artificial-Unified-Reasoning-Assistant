import { useState, useEffect, useMemo, useCallback } from 'react'
import { getLiveTickerItems } from '../api/client'

const STATIC_ITEMS = [
  'REUTERS — Gulf tensions escalate as regional powers respond',
  'GULF NEWS — Qatar financial centre reports strong Q1 growth',
  'LLOYDS LIST — Marine war risk premiums at historic highs',
  'OFAC — Treasury updates sanctions designations',
]

export default function Ticker() {
  const [items, setItems] = useState(STATIC_ITEMS)

  const refresh = useCallback(() => {
    getLiveTickerItems().then((live) => {
      if (live.length) setItems(live)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [refresh])

  const doubled = useMemo(() => [...items, ...items], [items])
  return (
    <div className="ticker">
      <div className="ticker-label">LIVE</div>
      <div className="ticker-track">
        {doubled.map((t, i) => (
          <span key={i} className="ticker-item">◆ {t}</span>
        ))}
      </div>
    </div>
  )
}
