export const DEPTS = [
  { key: 'risk_compliance', label: 'Risk & Compliance', desc: 'Sanctions · Regulatory · Geopolitical exposure', dotColor: '#0057B7' },
  { key: 'claims',          label: 'Claims',            desc: 'Marine · War Risk · Energy · Cyber',          dotColor: '#C8001E' },
  { key: 'underwriting',    label: 'Underwriting',      desc: 'Marine · Energy · Specialty lines',           dotColor: '#065F46' },
  { key: 'reinsurance',     label: 'Reinsurance',       desc: 'Treaty · Catastrophe · Accumulation',         dotColor: '#92400E' },
  { key: 'investments',     label: 'Investments',       desc: 'Fixed income · Equities · Alternatives',      dotColor: '#6D28D9' },
]

export const DEPT_SUGGESTIONS = {
  risk_compliance: [
    'What compliance actions are urgent in the next 48 hours?',
    'Which sanctions frameworks are most exposed here?',
    'What regulatory reporting obligations does this trigger?',
  ],
  claims: [
    'What are the key policy trigger questions on this situation?',
    'How should we approach reserving right now?',
    'What general average obligations apply to stranded vessels?',
  ],
  underwriting: [
    'Should we be suspending any lines of business?',
    'How does this affect our war risk pricing framework?',
    'What accumulation concerns should we prioritise?',
  ],
  reinsurance: [
    'What does this mean for our treaty capacity?',
    'How should we update our PML model for this scenario?',
    'What retrocession questions does this raise?',
  ],
  investments: [
    'What are the immediate portfolio implications?',
    'Which sectors should we be repositioning away from?',
    'What sovereign credit risks does this create?',
  ],
}

export const DEPT_AGENT = {
  risk_compliance: "You are a senior risk and compliance officer at a Lloyd's-regulated insurance company based in Qatar with 20 years of Gulf and MENA regulatory compliance, sanctions screening and prudential regulation experience. Date: 10 March 2026.",
  claims:          "You are the Head of Major Loss Claims at a Lloyd's-regulated insurance company based in Qatar, with deep expertise in marine, war risk, energy and cyber claims in the Gulf and MENA region. Date: 10 March 2026.",
  underwriting:    "You are a Senior Underwriter at a Lloyd's-regulated insurance company based in Qatar, specialising in marine, energy and specialty lines with 20 years of Gulf market experience. Date: 10 March 2026.",
  reinsurance:     "You are a Senior Reinsurance Analyst at a Lloyd's-regulated insurance company based in Qatar, expert in treaty structuring, catastrophe modelling and accumulation management. Date: 10 March 2026.",
  investments:     "You are an Insurance Asset Manager at a Lloyd's-regulated company based in Qatar, responsible for fixed income, equities and alternatives investment strategy with full balance sheet context. Date: 10 March 2026.",
}
