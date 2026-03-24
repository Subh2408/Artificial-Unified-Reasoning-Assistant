// Local storage utility — used only for UI state (column widths, dept preference)
// All data persistence (saved briefs, chat history, dept actions) goes through the backend API

export const lsGet = (key, defaultVal) => {
  try {
    const r = localStorage.getItem(key)
    return r ? JSON.parse(r) : defaultVal
  } catch {
    return defaultVal
  }
}

export const lsSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
