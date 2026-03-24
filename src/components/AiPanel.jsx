import { useState, useEffect, useRef } from 'react'
import { DEPTS, DEPT_SUGGESTIONS, DEPT_AGENT } from '../constants/depts'
import { callClaude, getChatHistory, saveChatHistory, clearChatHistory } from '../api/client'
import Markdown from './Markdown'

export default function AiPanel({ sitId, dept, situation, isReg = false, regData = null }) {
  const [open, setOpen] = useState(false)
  const chatKey = isReg ? `reg_${sitId}` : sitId
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)
  const deptInfo = DEPTS.find((d) => d.key === dept)
  const deptLabel = deptInfo?.label || 'All'

  useEffect(() => {
    getChatHistory(`${chatKey}_${dept}`).then(setMessages)
  }, [chatKey, dept])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const persona = DEPT_AGENT[dept] || DEPT_AGENT.risk_compliance
  const suggestions = DEPT_SUGGESTIONS[dept] || DEPT_SUGGESTIONS.risk_compliance

  const systemPrompt = isReg && regData
    ? `${persona}\n\nRegulatory change context:\nTitle: ${regData.title}\nJurisdiction: ${regData.jurisdiction}\nRegulator: ${regData.regulatorFull}\nEffective: ${regData.effectiveDate}\nType: ${regData.changeType}\nSummary: ${regData.summary}\nClaims implication: ${regData.claimsImplication}\nCompliance implication: ${regData.complianceImplication}\n\nAnswer directly and practically. Max 200 words unless depth required.`
    : `${persona}\n\nSituation: ${situation?.title}\nSeverity: ${situation?.severity}\nSummary: ${situation?.summary}\n\n${dept && situation?.interpretations?.[dept] ? `${deptLabel} brief:\n${situation.interpretations[dept].headline}\n${situation.interpretations[dept].detail}\n\nActions: ${situation.interpretations[dept].actions?.join(' | ')}` : ''}\nAnswer as a senior insurance professional. Direct, practical. Max 250 words.`

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const updated = [...messages, { role: 'user', content: q }]
    setMessages(updated)
    setLoading(true)
    try {
      const reply = await callClaude(systemPrompt, updated, 1000)
      const final = [...updated, { role: 'assistant', content: reply }]
      setMessages(final)
      await saveChatHistory(`${chatKey}_${dept}`, final)
    } catch {
      const final = [...updated, { role: 'assistant', content: 'Error connecting to AI.' }]
      setMessages(final)
    }
    setLoading(false)
  }

  const clear = async () => {
    setMessages([])
    await clearChatHistory(`${chatKey}_${dept}`)
  }

  const btnLabel = isReg ? 'Ask Regulatory AI' : `Ask ${deptLabel} AI`

  return (
    <div className="ai-section">
      {!open && (
        <button className="ai-toggle-btn" onClick={() => setOpen(true)}>
          <span>◆</span>
          <span>{btnLabel}{messages.length > 0 ? ` · ${Math.floor(messages.length / 2)} exchanges` : ''}</span>
        </button>
      )}
      {open && (
        <div className="ai-panel">
          <div className="ai-panel-header">
            <span className="ai-panel-title">◆ {btnLabel.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="ai-clear-btn" onClick={clear}>Clear</button>
              <button className="ai-clear-btn" onClick={() => setOpen(false)}>↑ Hide</button>
            </div>
          </div>
          {messages.length === 0 && (
            <div className="ai-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="ai-suggestion" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}
          {messages.length > 0 && (
            <div className="ai-messages">
              {messages.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
                  <div className="ai-msg-label">{m.role === 'user' ? 'YOU' : btnLabel.toUpperCase()}</div>
                  {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <div>{m.content}</div>}
                </div>
              ))}
              {loading && (
                <div className="ai-msg ai-msg-assistant">
                  <div className="ai-loading"><span /><span /><span /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
          <div className="ai-input-row">
            <textarea
              className="ai-input"
              placeholder="Ask a question…"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button className="ai-send-btn" onClick={() => send()} disabled={!input.trim() || loading}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}
