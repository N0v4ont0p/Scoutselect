<div align="center">

# 🏆 ScoutSelect

**Data-first alliance selection intelligence for FTC teams**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![FTCScout API](https://img.shields.io/badge/Powered%20by-FTCScout%20API-orange)](https://ftcscout.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> ScoutSelect replaces manual scouting spreadsheets with a **mobile-first, data-driven** web app that uses the [FTCScout API](https://ftcscout.org) to give you real-time alliance selection recommendations — backed by Monte Carlo simulation, Bayesian statistics, and synergy analysis.

[Features](#-features) · [Getting Started](#-getting-started) · [API Endpoints](#-api-endpoints) · [Algorithm](#-algorithm) · [Deploy](#-deploy-to-render) · [Credits](#-credits)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Picking Mode** | SAFE / BALANCED / CEILING / COUNTER picklists with synergy scoring for alliance captains |
| 🎯 **Getting Picked Mode** | Personalized pitches for each potential captain with talking points & red flags |
| 📊 **Match Analytics** | Expected auto / teleop / endgame scores, reliability index, and trend sparklines |
| 🎲 **Monte Carlo Simulation** | 1,000-run win probability estimates per alliance matchup |
| 🏅 **Bracket Coach** | Real-time playoff bracket with simulated advancement probabilities |
| ⚡ **Auto Phase Detection** | Automatically shows the right tools based on event stage (quals → selection → playoffs) |
| 🔍 **Team & Event Search** | Find any FTC team or event globally by name or number |
| 📱 **Mobile-First** | Designed for pit phones and tablets at competition — fast skeleton loaders throughout |
| 🌐 **Any Region** | Works for every event FTCScout covers, worldwide |
| 🔒 **Server-Side Caching** | Smart TTL cache keeps data fresh without abusing the API |

---

## 🏗 Tech Stack

```
Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
FTCScout GraphQL API  ← heavy queries (matches, rankings, stats)
FTCScout REST API     ← team lookup, team search, event lookup
In-memory cache       ← configurable TTLs (live: 90s, completed: 24h)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+**
- **npm 9+** (or pnpm / yarn)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/N0v4ont0p/Scoutselect.git
cd Scoutselect

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **http://localhost:3000** in your browser.

### Build for Production

```bash
npm run build   # compile + optimize
npm start       # serve production build
```

### Run Tests

```bash
npm test
```

> Tests cover: phase detection, metric calculations (OPR/Bayesian shrinkage), synergy scoring, and Monte Carlo simulation.

---

## 🌐 API Endpoints

All endpoints are served from `/api/` and implement server-side caching.

| Endpoint | Description | Cache TTL |
|----------|-------------|-----------|
| `GET /api/team/:teamNumber` | Team info (name, location, rookie year) | 1 hour |
| `GET /api/team/:teamNumber/events?season=` | Events a team is attending for a given season | 1 hour |
| `GET /api/event/:season/:code/matches` | All matches for an event | 90 s (live) / 24 h (completed) |
| `GET /api/event/:season/:code/teams` | Rankings, stats, and team list | 90 s (live) / 24 h (completed) |
| `GET /api/search/teams?q=` | Full-text team name / number search | 5 minutes |

### FTCScout Configuration

No API key is required — FTCScout is a public API.

| Variable | Default |
|----------|---------|
| GraphQL endpoint | `https://api.ftcscout.org/graphql` |
| REST base URL | `https://api.ftcscout.org/rest/v1` |

These are configured in `src/lib/ftcscout.ts`. If you want to point at a self-hosted FTCScout instance, change the constants there.

---

## 🔧 Caching Strategy

ScoutSelect implements an in-memory TTL cache (`src/lib/cache.ts`) to respect FTCScout's rate-limit guidance (GraphQL preferred for large volumes):

```
Live event data  (matches, rankings)  →  90 seconds
Completed event data                  →  24 hours
Team info / search                    →  1 hour
```

On cache miss the server fetches fresh data from FTCScout; on error it returns the last cached value with a `stale: true` flag, so the UI can show "last updated X ago" rather than crashing.

Optional Redis support can be plugged into `cache.ts` by replacing the `Map` store with an `ioredis` client — the interface is identical.

---

## 🧮 Algorithm

### 1 · Team Performance Model

Each team's stats are derived exclusively from FTCScout match data:

- **Expected scores** per phase (auto / teleop / endgame / penalties) — mean of all qualification match contributions
- **Bayesian shrinkage** — for teams with < 5 matches, scores are pulled toward the event median to prevent small-sample overconfidence
- **Reliability Index** (0 – 100) — `100 − (coefficient of variation × 100)`, clamped; higher = more consistent
- **Trend score** — exponentially-weighted mean favouring recent matches

### 2 · Synergy Model

For a captain + candidate pair:

- Role fingerprint vector: (auto%, teleop%, endgame%, penalties, consistency)
- **Complementarity score** — reward if candidate covers the captain's weak phases
- **Overlap penalty** — penalise if both teams are dominant in the same phase

### 3 · Monte Carlo Win Probability

1,000 simulations per matchup; each run samples each team's score from `Normal(mean, stddev)`, sums alliance totals, and records the winner.

Outputs: **win %**, **expected margin**, **upset risk** (% of sims within 10 pts).

### 4 · Pick Modes

| Mode | Optimises For |
|------|---------------|
| **Safe** | Reliability (50%) + score (30%) + synergy (20%) |
| **Balanced** | Score (40%) + synergy (35%) + reliability (25%) |
| **Ceiling** | Score (60%) + trend (20%) + synergy (20%) |
| **Counter** | Auto (50%) + endgame (30%) + total (20%) |

### 5 · Getting Picked Score

`FitScore(team, captain)` = synergy with captain's fingerprint + Δwin% if team joins their alliance.

Output: top 5 captains to pitch, "why they need you" bullets, strongest talking points, honest red flags.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Home — team/event search
│   ├── dashboard/page.tsx                # Main 5-tab dashboard
│   └── api/
│       ├── team/[teamNumber]/route.ts
│       ├── team/[teamNumber]/events/route.ts
│       ├── event/[season]/[code]/
│       │   ├── matches/route.ts
│       │   └── teams/route.ts
│       └── search/teams/route.ts
├── components/
│   ├── BracketView.tsx                   # Playoff bracket
│   ├── MetricBars.tsx                    # Auto/teleop/endgame bars
│   ├── PhaseIndicator.tsx                # Event phase badge
│   ├── PicklistCard.tsx                  # Pick recommendation card
│   ├── PitchCard.tsx                     # Alliance pitch card
│   ├── SkeletonLoader.tsx                # Loading states
│   ├── TeamCard.tsx                      # Team info card
│   └── ui/                              # shadcn/ui primitives
└── lib/
    ├── analytics.ts                      # Core analytics engine
    ├── cache.ts                          # In-memory TTL cache
    └── ftcscout.ts                       # FTCScout API client
```

---

## 🚢 Deploy to Render

ScoutSelect is a standard Node.js web service and deploys to [Render](https://render.com) in minutes.

### Option A — Web Service (recommended)

1. Push the repo to GitHub (already done ✅).
2. Go to [render.com/new](https://dashboard.render.com/new) → **Web Service**.
3. Connect your GitHub repo.
4. Fill in the settings:

| Setting | Value |
|---------|-------|
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (512 MB RAM) or Starter |

5. Click **Create Web Service**.  Render will build and deploy automatically. Every `git push` triggers a redeploy.

### Option B — Static Export (no server required)

Add `output: 'export'` to `next.config.mjs`:

```js
const nextConfig = { output: 'export' };
export default nextConfig;
```

Then in Render → **Static Site**:

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `out` |

> ⚠️ Static export disables API routes (server-side caching). Use **Option A** for the full experience.

### Environment Variables (optional)

No environment variables are required to run. If you add Redis caching later:

| Variable | Example |
|----------|---------|
| `REDIS_URL` | `redis://red-xxxxx.render.com:6379` |

---

## 🧪 Tests

```bash
npm test
```

Coverage:
- ✅ `detectEventPhase` — all 5 phases
- ✅ `computeTeamMetrics` — zero matches, normal matches, DQ handling
- ✅ `computeSynergy` — complementarity and overlap penalty
- ✅ `generatePicklist` — sorting, captain exclusion, mode differences
- ✅ `simulateWinProbability` — stronger alliance wins, equal alliances ~50 %

---

## 📖 Methodology

ScoutSelect is data-first and transparent about its limitations:

- All analytics come **exclusively** from FTCScout match data — no manual inputs, no scouting sheets.
- Distributions and simulation replace point estimates wherever possible.
- Reliability and trend are *inferred* from match data and are proxies, not ground truth.
- Confidence scores shrink for teams with few matches — the UI shows a warning.
- We do **not** claim to predict outcomes perfectly; we surface probabilities and contributing factors.

See the **Methodology** tab in the dashboard for the full explanation shown to users.

---

## 🤝 Credits

ScoutSelect was designed and built by **FTC Team 19859**.

> *"We built the tool we wished existed at our first regional."*

- Data provided by the incredible [FTCScout.org](https://ftcscout.org) project — thank you for your public API!
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)

---

<div align="center">

**ScoutSelect** · MIT License · Made with ❤️ by FTC Team 19859

*Not affiliated with FIRST® or FTCScout. All match data © respective event organisers.*

</div>

