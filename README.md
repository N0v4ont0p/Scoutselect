<div align="center">

<br/>

<img src="https://img.shields.io/badge/⚡-ScoutSelect-6366f1?style=for-the-badge&labelColor=080b14&color=6366f1" alt="ScoutSelect" height="40"/>

<br/><br/>

**The most intelligent alliance selection platform for FTC teams.**<br/>
*Know who to pick. Know who to pitch yourself to. Win.*

<br/>

[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FTCScout](https://img.shields.io/badge/Powered_by-FTCScout_API-6366f1?style=flat-square)](https://ftcscout.org)

<br/>

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡  ScoutSelect  —  FTC Alliance Intelligence              ║
║                                                              ║
║   OPR  ·  Monte Carlo  ·  Synergy  ·  Snake Draft Sim       ║
║   Bilingual (EN / 中文)  ·  Real-time  ·  Season-Aware      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

</div>

---

## ✨ What is ScoutSelect?

ScoutSelect is a **data-driven alliance selection intelligence platform** for FTC (FIRST Tech Challenge) teams. Built by FTC Team 19859, it pulls live match data from the [FTCScout public API](https://ftcscout.org) and runs a suite of advanced analytics in real-time — so you walk into alliance selection knowing *exactly* what to do.

> 🇨🇳 完整支持简体中文 — 点击界面右上角的语言切换按钮即可切换。

---

## 🚀 Feature Overview

<table>
<tr>
<td width="50%">

### 🎯 Alliance Role Detector
Instantly know if you're a **captain**, in the **pick pool**, or on the **bubble** — based on live qual rankings and OPR.

### 🧠 Smart Pick Optimizer
Snake-draft simulation that models which teams other captains will select *before your turn*, giving you **availability-adjusted** pick rankings.

### 🗣️ Pitch Strategy Engine
Ranked list of captains who need **you** most — with calculated improvement deltas and ready-to-say talking points for each one.

</td>
<td width="50%">

### 🔗 Synergy & Fit Scoring
Role fingerprints across auto / teleop / endgame space reveal complementarity gaps. No more guessing who fills what hole.

### 🎲 Win Probability Projections
**Monte Carlo simulation** (2,000 runs) forecasts your win probability against every projected opponent alliance using Box-Muller sampling.

### 🔍 Team-First Discovery
Enter your team number → see all your events by name. No event codes to memorise. Click any event → full analysis.

</td>
</tr>
</table>

---

## 📐 Analytics Engine

| Algorithm | Description |
|-----------|-------------|
| **OPR** | True offensive power ratings via Gaussian elimination (A<sup>T</sup>Ax = A<sup>T</sup>b) across all qual matches |
| **Bayesian Shrinkage** | Teams with < 5 matches shrunk toward event median to prevent overconfidence |
| **Synergy Score** | Euclidean distance in role-fingerprint space + overlap penalty |
| **Monte Carlo** | 2,000 × Box-Muller sampled simulations per matchup |
| **Reliability** | 60% consistency (IQR-based) + 40% match count composite |

---

## 🌐 Bilingual Support

ScoutSelect supports **English** and **Simplified Chinese (简体中文)** throughout the entire UI.  
Toggle the language with the `🌐` button in the top-right corner of any page.

---

## 🗓️ Season-Aware Defaults

The platform **automatically detects the current FTC season** based on the date:

- Season year = current calendar year if month ≥ September  
- Season year = previous calendar year otherwise

*Example: April 2026 → 2025 (Decoded 2025–26 season)*

No manual season selection needed — ScoutSelect always starts on the right season.

---

## 🗺️ Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with live team search |
| `/teams` | Team search |
| `/teams/[number]` | Team profile + current-season events |
| `/events` | Event lookup by team number or code |
| `/events/[season]/[code]` | Full event analytics dashboard |
| `/seasons` | Season browser |
| `/seasons/[season]` | Season detail |
| `/compare` | Side-by-side team comparison |
| `/methodology` | Algorithm documentation (bilingual) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 15** (App Router, React 19) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS v4** (CSS-based config, `@theme` blocks) |
| Fonts | **Geist** (Sans + Mono) |
| Icons | **Lucide React** |
| Data | **FTCScout GraphQL API** |
| Caching | In-memory TTL cache (`src/lib/cache.ts`) |
| i18n | Lightweight React context (`src/context/LanguageContext.tsx`) |

---

## ⚡ Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
open http://localhost:3000
```

### Production Build

```bash
npm run build && npm start
```

### Deployment

| Setting | Value |
|---------|-------|
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Node version | ≥ 20 |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                     # API route handlers
│   │   ├── event/[season]/[code]/
│   │   ├── search/teams/
│   │   ├── seasons/
│   │   └── team/[number]/
│   ├── compare/                 # Team comparison page
│   ├── events/
│   │   └── [season]/[code]/     # Event analytics dashboard
│   ├── methodology/             # Algorithm documentation
│   ├── seasons/                 # Season browser
│   ├── teams/                   # Team search + profiles
│   ├── globals.css              # Tailwind v4 config + animations
│   ├── layout.tsx               # Root layout + LanguageProvider
│   └── page.tsx                 # Home page
├── context/
│   └── LanguageContext.tsx      # Bilingual React context
└── lib/
    ├── analytics.ts             # OPR, synergy, Monte Carlo
    ├── cache.ts                 # TTL cache
    ├── ftcscout.ts              # FTCScout GraphQL client
    ├── i18n.ts                  # EN / ZH translation strings
    └── utils.ts                 # Helpers incl. getCurrentSeason()
```

---

## 🧪 Development

```bash
# Type check
npx tsc --noEmit

# Run tests
npm test

# Lint
npm run lint
```

---

## 📜 License

MIT — built with ❤️ by **FTC Team 19859**

---

<div align="center">

**[FTCScout API](https://ftcscout.org)** · **[FIRST Tech Challenge](https://www.firstinspires.org/robotics/ftc)**

<br/>

*Made for teams, by a team.* ⚡

</div>

