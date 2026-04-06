<div align="center">

<br/>

# ⚡ ScoutSelect

### Data-first alliance intelligence for FTC teams

**OPR · Monte Carlo · Synergy Scoring · Real-time Match Data**

<br/>

[![Built with Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FTCScout API](https://img.shields.io/badge/FTCScout-API-orange)](https://ftcscout.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br/>

> **ScoutSelect** replaces manual scouting spreadsheets with live, mathematically rigorous alliance analysis — powered exclusively by the [FTCScout API](https://ftcscout.org).

<br/>

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| **OPR Analytics** | True Offensive Power Ratings computed via least-squares regression (Gaussian elimination) across all qualification matches |
| **Monte Carlo Simulation** | Win-probability estimates using Box-Muller Gaussian sampling — 500–1000 simulations per matchup |
| **Bayesian Shrinkage** | Teams with fewer than 5 matches are shrunk toward the event median to prevent overconfidence on small samples |
| **3-Component Synergy** | Role fingerprints in auto/teleop/endgame space — Euclidean distance drives complementarity, shared dominance creates overlap penalty |
| **Picklist Modes** | 🛡 Safe · ⚖️ Balanced · 🚀 Ceiling · 🎯 Counter — each with different weight vectors |
| **Picklist Filters** | Filter by Auto/TeleOp/Endgame heavy, Low penalties, High reliability, High ceiling, Trending up |
| **Getting Picked Pitches** | Personalised data-backed pitch per top-4 captain with talking points, win-probability increase ring, and honest red flags |
| **Sparkline Trends** | Inline SVG sparklines showing match-by-match score trajectory with trend direction dot |
| **Phase Detection** | Auto-detects Quals Running → Alliance Selection → Playoffs Running → Complete and selects the right default tab |
| **Bracket Coach** | Live playoff bracket tracking grouped by semifinal and final rounds |
| **Smart Caching** | 90s TTL for live events, 24h for completed, 1h for team data — no API abuse |
| **Mobile-first** | Designed for phones in the pit — glass cards, smooth animations, fast skeleton loaders |

---

## 🧮 The Math

### Offensive Power Rating (OPR)

ScoutSelect solves the linear system using the **normal equations**:

```
A^T · A · x = A^T · b
```

Where:
- `A[i][j] = 1` if team `j` played on the same alliance in match-side `i`
- `b[i]` = score for that alliance in that match
- `x` = OPR vector (solved via Gaussian elimination with partial pivoting)

Computed separately for **total**, **auto**, **teleop**, and **endgame** components.

### Synergy Score

Each team is represented as a normalised role fingerprint:

```
fp = (auto/total, teleop/total, endgame/total)
```

Complementarity = `(Euclidean distance / √2) × 60`  
Overlap penalty = `max(min overlap per phase) × 20`  
Synergy = `combined_score + complementarity − overlap_penalty`

### Monte Carlo Win Probability

For each simulation:
1. Sample each team's score from `N(μ, σ)` using Box-Muller transform
2. Sum per alliance, compare
3. Tally wins / upset risks across 500–1000 runs

### Bayesian Shrinkage

```
α = min(matchCount, 5) / 5
expectedScore = α × observed_mean + (1−α) × event_median
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Run locally

```bash
git clone https://github.com/N0v4ont0p/Scoutselect
cd Scoutselect
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
npm run build
npm start
```

### Run tests

```bash
npm test
```

---

## 🔧 Configuration

### FTCScout API endpoints

All API calls are proxied through Next.js API routes in `src/app/api/`. The upstream endpoints are configured in `src/lib/ftcscout.ts`:

```ts
const GRAPHQL_ENDPOINT = 'https://api.ftcscout.org/graphql';
const REST_BASE        = 'https://api.ftcscout.org/rest/v1';
```

**GraphQL** is used for heavy pulls (matches, rankings, team stats).  
**REST** is used for team search and simple lookups.

### Caching strategy

Configured in `src/lib/cache.ts`:

| Data type | TTL |
|---|---|
| Live event matches/rankings | **90 seconds** |
| Completed event data | **24 hours** |
| Team info | **1 hour** |
| Team search | **5 minutes** |

The cache is in-memory (per server process). On Render, each instance has its own cache — this is intentional and keeps the architecture simple and dependency-free.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                         # Home — team search + season selector
│   ├── dashboard/page.tsx               # Dashboard — 5-tab analytics UI
│   ├── layout.tsx
│   ├── globals.css                      # Design tokens + CSS animations
│   └── api/
│       ├── team/[teamNumber]/route.ts
│       ├── team/[teamNumber]/events/route.ts
│       ├── event/[season]/[code]/matches/route.ts
│       ├── event/[season]/[code]/teams/route.ts
│       └── search/teams/route.ts
├── components/
│   ├── SparkLine.tsx                    # SVG sparkline with area fill
│   ├── MetricBars.tsx                   # Animated gradient phase bars
│   ├── PicklistCard.tsx                 # Pick card with sparkline + OPR
│   ├── PitchCard.tsx                    # Pitch card with win-probability ring
│   ├── BracketView.tsx                  # Playoff bracket grouped by round
│   ├── PhaseIndicator.tsx               # Pulsing live phase badge
│   ├── TeamCard.tsx                     # Glass team info card
│   └── SkeletonLoader.tsx               # Shimmer skeleton loaders
└── lib/
    ├── analytics.ts                     # OPR, metrics, synergy, Monte Carlo, picklist
    ├── ftcscout.ts                      # GraphQL + REST API client
    ├── cache.ts                         # In-memory TTL cache
    └── utils.ts
```

---

## 🌐 Deploy on Render

ScoutSelect is a **Next.js web service** — it uses server-side API routes and cannot be deployed as a static site.

### Step-by-step

1. Push your code to a GitHub repository.

2. Go to [render.com](https://render.com) → **New → Web Service**.

3. Connect your GitHub repo.

4. Fill in the settings:

   | Setting | Value |
   |---|---|
   | **Environment** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Branch** | `main` |

5. Click **Create Web Service** — Render will build and deploy automatically.

> **Free tier note:** On Render's free tier, the instance spins down after inactivity. The first load after spin-down takes ~30s. Upgrade to a paid plan for always-on hosting at competitions.

### Environment variables

No environment variables are required for basic operation. The FTCScout API is public and requires no API key.

---

## 🔬 Analytics accuracy

ScoutSelect is a **statistical estimation tool**, not an oracle. Results depend on:

- **Sample size** — OPR and averages become reliable after ~5+ qual matches
- **Alliance composition** — OPR assumes scores are linear in team contributions (the standard assumption)
- **Data availability** — FTCScout must have your event indexed

All confidence scores are surfaced in the UI. Low-data warnings are shown on cards.

---

## 🛠 Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 + custom CSS animations |
| UI components | shadcn/ui (Radix primitives) |
| Icons | lucide-react |
| Data | FTCScout GraphQL + REST API |
| Math | Pure TypeScript (no linear algebra library) |
| Charts | Inline SVG (no chart library) |
| Cache | In-memory Map with TTL |
| Tests | Jest + ts-jest |

---

<div align="center">

<br/>

Built with 🤖 by **[FTC Team 19859](https://ftcscout.org/teams/19859)**

*ScoutSelect is not affiliated with or endorsed by FIRST or FTCScout.*

<br/>

</div>
