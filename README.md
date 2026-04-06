# ScoutSelect

> Data-first, mobile-optimized alliance selection intelligence for FTC (FIRST Tech Challenge) teams.

ScoutSelect connects to the [FTCScout API](https://ftcscout.org) and turns raw match data into actionable recommendations — helping teams pick the right alliance partners and get picked by the best captains.

## Features

- **Alliance Picking** — SAFE / BALANCED / CEILING / COUNTER modes with synergy scoring
- **Getting Picked** — Personalized pitches for each potential captain alliance
- **Match Analytics** — Expected scores, reliability index, and performance trends
- **Monte Carlo Simulation** — 1,000-simulation win probability estimates
- **Bracket View** — Real-time playoff bracket visualization
- **Mobile-first** — Built for pit scouting on phones and tablets
- **Live Data** — 90-second cache refresh during events

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Data:** FTCScout GraphQL + REST API
- **Caching:** In-memory (configurable TTLs)
- **Deployment:** Vercel / Render

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

### Vercel (recommended)
```bash
npx vercel
```

### Render / Docker
Set `NODE_ENV=production` and run `npm run build && npm start`.

## Analytics Engine

### Expected Scores
Bayesian shrinkage toward the event median for teams with fewer than 5 matches prevents small sample sizes from distorting rankings.

### Reliability Index
`100 - (coefficient of variation × 100)` — Higher means more consistent performance. Clamped to [0, 100].

### Pick Modes
| Mode | Weights |
|------|---------|
| **Safe** | Reliability 50% · Score 30% · Synergy 20% |
| **Balanced** | Score 40% · Synergy 35% · Reliability 25% |
| **Ceiling** | Score 60% · Trend 20% · Synergy 20% |
| **Counter** | Auto 50% · Endgame 30% · Total 20% |

### Synergy Score
Measures complementarity between two teams' auto/teleop profiles. High synergy if one team excels at auto while the other dominates teleop.

### Win Probability
1,000 Monte Carlo simulations sampling each team's score distribution (normal distribution with their mean and standard deviation) to compute expected win probability and upset risk.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home / search
│   ├── dashboard/page.tsx    # Main analysis dashboard
│   └── api/
│       ├── team/[teamNumber]/route.ts
│       ├── team/[teamNumber]/events/route.ts
│       ├── event/[season]/[code]/matches/route.ts
│       ├── event/[season]/[code]/teams/route.ts
│       └── search/teams/route.ts
├── components/
│   ├── BracketView.tsx
│   ├── MetricBars.tsx
│   ├── PhaseIndicator.tsx
│   ├── PicklistCard.tsx
│   ├── PitchCard.tsx
│   ├── SkeletonLoader.tsx
│   └── TeamCard.tsx
└── lib/
    ├── analytics.ts          # Core analytics engine
    ├── cache.ts              # In-memory caching
    └── ftcscout.ts           # FTCScout API client
```

## License

MIT — see [LICENSE](LICENSE).

---

*Powered by [FTCScout.org](https://ftcscout.org) • Built for FTC teams competing in FIRST Tech Challenge*
