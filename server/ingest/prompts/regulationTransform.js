/**
 * Build a Claude prompt to enrich raw regulation items into schema-compatible objects.
 * rawItems: array of { idx, regulator, jurisdiction, jurisdictionCode, title, snippet, publishedDate }
 * Returns { system, user }
 */
function buildRegulationPrompt(rawItems) {
  const system = `You are a senior regulatory compliance officer at a Lloyd's-regulated insurer operating in Qatar, UAE, and Saudi Arabia. You receive raw regulatory press release items and return structured JSON. Return ONLY valid JSON — no commentary, no markdown.`

  const user = `Enrich these ${rawItems.length} regulatory items. For each return a JSON object with EXACTLY these fields:
- "idx": the item index number as given
- "summary": 60-80 word executive summary of the regulatory change for compliance officers
- "changeType": one of "NEW" | "AMENDMENT" | "GUIDANCE" | "NEW LAW"
- "urgency": one of "ACTION" (immediate compliance required) | "MONITOR" (track, no immediate action) | "INFO" (informational only)
- "linesAffected": array of insurance lines affected (e.g. ["Marine", "Property", "Motor", "Life", "Reinsurance", "All Lines"])
- "claimsImplication": 1-2 sentence impact on claims operations
- "complianceImplication": 1-2 sentence compliance obligation or action required

Items:
${rawItems.map((item) => `[${item.idx}] Regulator: ${item.regulator} (${item.jurisdiction})\nTitle: ${item.title}\nSnippet: ${item.snippet || '(no snippet)'}\nPublished: ${item.publishedDate || 'unknown'}`).join('\n\n')}

Return ONLY a JSON array of ${rawItems.length} objects. Example: [{"idx":0,"summary":"...","changeType":"GUIDANCE","urgency":"MONITOR","linesAffected":["Marine"],"claimsImplication":"...","complianceImplication":"..."}]`

  return { system, user }
}

module.exports = { buildRegulationPrompt }
