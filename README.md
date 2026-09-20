# Pitchside

Live scores, standings, fixtures and top scorers for Europe's top 5 football leagues
(Premier League, LaLiga, Serie A, Bundesliga, Ligue 1).

Built as a monorepo so the domain logic and data layer are shared between the web app today
and native mobile apps later.

## Structure

```
sports/
├── apps/
│   └── web/            Next.js 15 app (App Router, Tailwind v4). Also serves /api/v1 for mobile.
├── packages/
│   ├── core/           Pure TypeScript: domain models, league config, standings math, data providers.
│   └── query/          React hooks (TanStack Query) over core providers. Works in React DOM and React Native.
├── turbo.json          Task pipeline (build / dev / lint / typecheck / test)
└── tsconfig.base.json  Strict shared compiler settings
```

### How the layers fit together

```
        ┌──────────────────────┐        ┌──────────────────────┐
        │  apps/web (Next.js)  │        │  apps/mobile (later) │
        │  server components   │        │  Expo / React Native │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │ direct call                    │ HTTP (/api/v1)
                   ▼                                ▼
        ┌──────────────────────┐        ┌──────────────────────┐
        │  @sports/query       │◄───────┤  @sports/query       │  shared hooks + cache keys
        └──────────┬───────────┘        └──────────┬───────────┘
                   ▼                                ▼
        ┌─────────────────────────────────────────────────────┐
        │  @sports/core  · SportsDataProvider interface        │
        │    MockProvider · FootballDataProvider · HttpProvider│
        └─────────────────────────────────────────────────────┘
```

- **`SportsDataProvider`** is the single seam to the outside world. Every screen is written
  against it, never against a concrete API.
- **`MockProvider`** simulates a full deterministic season (double round-robin, Poisson-scored
  results biased by club strength, live matches during kick-off windows). No network needed.
- **`FootballDataProvider`** adapts [football-data.org](https://www.football-data.org) v4.
- **`HttpProvider`** talks to the web app's own `/api/v1` routes. Mobile apps use this so API
  keys never ship in a client bundle and the server can cache upstream calls.

## Getting started

Requirements: Node 22+ (see `.nvmrc`), npm 11.

```bash
npm install
npm run dev          # http://localhost:3000
```

Without configuration the app runs on demo data and shows a "Demo data" badge.
For real data, register for a free key and create `.env` in `apps/web/`:

```bash
cp .env.example apps/web/.env
# then set FOOTBALL_DATA_API_KEY=...
```

## Scripts

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start every app in dev mode (Turbopack)  |
| `npm run build`     | Production build of every package        |
| `npm run lint`      | ESLint across the workspace              |
| `npm run typecheck` | `tsc --noEmit` across the workspace      |
| `npm run test`      | Vitest (core domain logic and providers) |
| `npm run format`    | Prettier (with Tailwind class sorting)   |

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, tests and build on every push
and pull request.

## Public API (consumed by mobile)

All responses are JSON and cached at the edge for 60 s (20 s for live matches).

| Route                                 | Query params                       |
| ------------------------------------- | ---------------------------------- |
| `GET /api/v1/leagues`                 |                                    |
| `GET /api/v1/leagues/:slug/season`    |                                    |
| `GET /api/v1/leagues/:slug/standings` |                                    |
| `GET /api/v1/leagues/:slug/matches`   | `matchday`, `dateFrom`, `dateTo`   |
| `GET /api/v1/leagues/:slug/scorers`   | `limit` (max 50)                   |
| `GET /api/v1/matches`                 | `date` (YYYY-MM-DD, default today) |

Slugs: `premier-league`, `la-liga`, `serie-a`, `bundesliga`, `ligue-1`.

## Adding the mobile app

1. `npx create-expo-app apps/mobile` and add `"@sports/core": "*"`, `"@sports/query": "*"`.
2. Wrap the root in `<SportsProvider provider={new HttpProvider({ baseUrl: 'https://your-deployment' })}>`.
3. Use `useStandings`, `useMatches`, `useTopScorers`, `useMatchesByDate` from `@sports/query`
   with native UI. Query keys are shared, so caching semantics are identical to the web.

## Conventions

- TypeScript `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Internal packages export TypeScript source directly (`exports` → `src/index.ts`); Next.js
  transpiles them via `transpilePackages`, Metro will do the same for mobile.
- Server components call the provider directly; client components go through `@sports/query`.
- Keep `packages/core` free of React and DOM imports so it stays portable.
