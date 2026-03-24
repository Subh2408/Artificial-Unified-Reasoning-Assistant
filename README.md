# AURA — Insurance Intelligence Platform

Internal insurance intelligence platform for a Qatar-based insurer. Covers Risk & Compliance, Claims, Underwriting, Reinsurance, and Investments.

---

## Quick Start

### 1. Backend (run first)

```bash
cd server
npm install
cp .env.example .env
# Edit .env and add your Anthropic API key
node index.js
```

Backend starts at `http://localhost:3001`. You should see:
```
AURA backend running at http://localhost:3001
API key loaded: sk-ant-api03...
Database: /path/to/aura/server/aura.db
```

### 2. Frontend (separate terminal)

```bash
# From the aura/ root directory
npm install
npm run dev
```

Opens at `http://localhost:5173`.

---

## Testing the API

Once the backend is running, test it from your terminal:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"system":"You are a test assistant.","messages":[{"role":"user","content":"Reply with: API working."}],"maxTokens":50}'
```

Expected response:
```json
{"text":"API working."}
```

Also check the health endpoint:
```bash
curl http://localhost:3001/api/health
```

---

## Project Structure

```
aura/
├── index.html
├── package.json
├── vite.config.js          # Proxies /api to localhost:3001
├── .env.example
│
├── src/
│   ├── main.jsx            # React entry point
│   ├── App.jsx             # Main app — all state lives here
│   ├── index.css           # All styles (design system variables)
│   │
│   ├── data/
│   │   ├── situations.js   # 6 situations — UPDATE MANUALLY
│   │   ├── signals.js      # 18 signals — UPDATE MANUALLY
│   │   └── regulations.js  # 10 regulations — REVIEW WITH COMPLIANCE OFFICER
│   │
│   ├── constants/
│   │   ├── depts.js        # Department config, AI personas, suggestions
│   │   └── colors.js       # Severity + source type colours
│   │
│   ├── utils/
│   │   ├── format.js       # Date/time formatting helpers
│   │   ├── storage.js      # localStorage (UI state only)
│   │   └── exportBrief.js  # PDF export via browser print
│   │
│   ├── api/
│   │   └── client.js       # All backend calls — Anthropic proxy + persistence
│   │
│   └── components/
│       ├── DeptGate.jsx    # Full-screen department selector on load
│       ├── Ticker.jsx      # Live news ticker
│       ├── Sidebar.jsx     # Navigation, situation index, reg watch
│       ├── AiPanel.jsx     # Per-situation / per-regulation AI chat
│       ├── Timeline.jsx    # Signal timeline in situation detail
│       │
│       ├── feed/
│       │   ├── Feed.jsx    # Middle column — situations/signals/regs
│       │   ├── HeroCard.jsx
│       │   └── Cards.jsx   # SitCard, SignalCard, RegCard
│       │
│       ├── detail/
│       │   ├── SituationDetail.jsx
│       │   ├── SignalDetail.jsx
│       │   ├── RegulationDetail.jsx
│       │   └── SnapshotDetail.jsx
│       │
│       ├── regulatory/     # R&C department — Regulatory Lens
│       │   ├── ComplianceActionDash.jsx
│       │   ├── RegQueryAssistant.jsx
│       │   ├── VersionComparison.jsx
│       │   └── DeptImpactAnalysis.jsx
│       │
│       └── dept/           # Department tool panels (in situation detail)
│           ├── ClaimsPanel.jsx       # Reserve memo + coverage checklist
│           ├── UnderwritingPanel.jsx # Appetite signal + rate guidance + exclusion drafter
│           ├── InvestmentsPanel.jsx  # Portfolio stress tester + opportunity scanner
│           └── ReinsurancePanel.jsx  # Cat declaration + PML builder + notification drafter
│
└── server/
    ├── index.js            # Express + SQLite backend (~130 lines)
    ├── package.json
    ├── .env.example
    └── aura.db             # Created automatically on first run
```

---

## Data Sources & Update Cadence

### Regulations (`src/data/regulations.js`)
- **Sources**: QCB (qcb.gov.qa), QFCRA (qfcra.com), CBUAE (cbuae.gov.ae), SAMA (sama.gov.sa)
- **Update**: Manual — monitor regulator websites for new circulars/rules
- **⚠ Required**: All compliance implications must be reviewed by your compliance officer before live deployment

### Situations (`src/data/situations.js`)
- **Sources**: Editorial synthesis by data owner
- **Update**: Manual — update when situation evolves, mark as resolved when appropriate
- **Owner**: Assign one person responsible for keeping this current

### Signals (`src/data/signals.js`)
- **Sources**: P&I club bulletins, GDELT, GDACS, OFAC, LMA, Gulf News
- **Update**: Manual — add new signals as events develop
- **Future**: GDACS provides a free API (gdacs.org/api) for automated signal ingestion

---

## Database

SQLite database at `server/aura.db` — created automatically on first run.

Four tables:
- `saved_briefs` — saved situation briefs per department
- `chat_history` — AI conversation history per situation/regulation per department
- `dept_actions` — underwriting appetite signals, cat declarations, PML figures, checklist states
- `reg_query_history` — cross-regulation query assistant conversation

To reset the database: `rm server/aura.db` and restart the server.

---

## Deployment (when ready)

When you're ready to host internally:

1. Build the frontend: `npm run build` — produces `dist/` folder
2. Serve `dist/` as static files from Express (add `app.use(express.static('../dist'))` to server/index.js)
3. Run the server on your internal network
4. Access from any browser at the server's IP address

The API key stays on the server. No changes to the frontend needed.

---

## AI Disclaimer

All AI-generated content in AURA (morning briefs, reserve memos, rate guidance, regulatory analysis, department impact) is for informational purposes only. It must be validated by a qualified professional before any action is taken. AURA does not provide legal, regulatory, underwriting or investment advice.
