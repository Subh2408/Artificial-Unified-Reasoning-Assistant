export const fmtDate = (ts) => {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export const fmtDT = (ts) => {
  const d = new Date(ts)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
    'Z'
  )
}

export function fmtQAR(value) {
  if (value >= 1000000000) return `QAR ${(value / 1000000000).toFixed(1)}B`
  if (value >= 1000000)    return `QAR ${(value / 1000000).toFixed(0)}M`
  if (value >= 1000)       return `QAR ${(value / 1000).toFixed(0)}K`
  return `QAR ${value}`
}

export const timeAgo = (ts) => {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 3600)  return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}
