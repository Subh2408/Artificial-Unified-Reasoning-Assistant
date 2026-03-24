/**
 * Build a Claude prompt to enrich raw signal items into schema-compatible objects.
 * rawItems: array of { idx, source, title, snippet }
 * Returns { system, user }
 */
function buildSignalPrompt(rawItems) {
  const system = `You are a senior marine and insurance intelligence analyst specialising in MENA markets. You receive raw news feed items and return structured JSON enrichment. Return ONLY valid JSON — no commentary, no markdown.`

  const user = `Enrich these ${rawItems.length} raw intelligence items for an insurance intelligence platform. For each item return a JSON object with EXACTLY these fields:
- "idx": the item index number as given
- "description": 35-50 word editorial summary written for senior insurance professionals (claims, underwriting, reinsurance, risk)
- "tags": array of 2-5 UPPERCASE topic strings (e.g. ["WAR RISK", "P&I", "MARINE", "SANCTIONS", "CAT EVENT"])
- "geography": most specific geographic region (e.g. "Arabian Gulf", "Red Sea", "Global", "Qatar", "UAE", "Saudi Arabia", "Ukraine")
- "sourceType": one of "OFFICIAL" (regulator/govt), "MARKET" (industry body/market), "NEWS" (general news)

Items:
${rawItems.map((item) => `[${item.idx}] Source: ${item.source}\nTitle: ${item.title}\nSnippet: ${item.snippet || '(no snippet)'}`).join('\n\n')}

Return ONLY a JSON array of ${rawItems.length} objects. Example: [{"idx":0,"description":"...","tags":["WAR RISK"],"geography":"Arabian Gulf","sourceType":"OFFICIAL"}]`

  return { system, user }
}

module.exports = { buildSignalPrompt }
