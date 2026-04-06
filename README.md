# ScoutSelect — FTC Alliance Intelligence

Data-driven alliance selection for FTC (FIRST Tech Challenge) teams. ScoutSelect pulls live match data from the FTCScout public API and computes OPR, synergy scores, Monte Carlo win probabilities, and picklists.

## Features

- **OPR Analytics** — True offensive power ratings via Gaussian elimination across all qual matches
- **Monte Carlo Sim** — Win-probability estimates using Box-Muller sampling (1,000 runs per matchup)
- **Synergy Scoring** — Role fingerprints in auto/teleop/endgame space with complementarity scoring
- **Picklist Generator** — Safe · Balanced · Ceiling · Counter modes with smart filters
- **Phase Detection** — Auto-detects event phase and surfaces the most relevant analytics
- **Live Data** — Powered by the FTCScout public API with smart TTL caching

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Deployment

**Build command:** `npm install && npm run build`
**Start command:** `npm start`

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **Data Source:** [FTCScout API](https://ftcscout.org)

## Pages

- `/` — Landing page with team search
- `/teams` — Team search
- `/teams/[number]` — Team detail and event history
- `/events` — Event lookup by code
- `/events/[season]/[code]` — Event dashboard with rankings and picklists
- `/seasons` — Season browser
- `/seasons/[season]` — Season detail
- `/compare` — Side-by-side team comparison
- `/methodology` — Algorithm documentation

## Built by

FTC Team 19859

---

Powered by [FTCScout API](https://ftcscout.org)
