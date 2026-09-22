# Pitchside

Live scores, results, tables and players for European football: the top 5 leagues, fourteen more
domestic leagues, the three UEFA club competitions and national-team games, with real data and
real crests. Available in English, Russian and Romanian, with accounts and match comments.

Built as a monorepo so the domain logic, data layer and translations are shared between the
web app today and native mobile apps later.

## Structure

```
sports/
├── apps/
│   └── web/            Next.js 15 app (App Router, Tailwind v4). Also serves the APIs for mobile.
├── packages/
│   ├── core/           Pure TypeScript: domain models, league config, data providers, comments client.
│   ├── query/          React hooks (TanStack Query) over core providers. Works in React DOM and React Native.
│   └── i18n/           Locales and message catalogs (ICU). en is the source; ru and ro must match it.
├── design/             Source design exported from Claude Design (not formatted or linted).
├── turbo.json          Task pipeline (build / dev / lint / typecheck / test)
└── tsconfig.base.json  Strict shared compiler settings
```

### Screens

| Route                      | Screen                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                        | Matches for a day: strip, competition picker, grouped rows, table, scorers                                |
| `/match/:league/:id`       | Match: score, timeline, form, head to head, line-ups, stats (season comparison before kick-off), comments |
| `/tables/:league`          | Full league table with form and qualification zones                                                       |
| `/tables/:league/fixtures` | A league's fixtures and results by month                                                                  |
| `/team/:league/:id`        | Team: season numbers, form, next match, fixtures and results, squad, related news                         |
| `/players`                 | Top scorers, across all leagues or one, with search                                                       |
| `/player/:league/:id`      | Player: season numbers, goals by match, profile                                                           |
| `/news/:id`                | Article: a publisher headline with a link out, or one of our own articles in full; comments               |
| `/admin`                   | Staff console: overview, news editor, users. English only, not indexed                                    |

English is unprefixed. Russian lives under `/ru`, Romanian under `/ro` (for example
`/ro/tables/la-liga`). `/?date=YYYY-MM-DD&league=serie-a` selects the day and the filter.

### How the layers fit together

```
        ┌──────────────────────┐        ┌──────────────────────┐
        │  apps/web (Next.js)  │        │  apps/mobile (later) │
        │  server components   │        │  Expo / React Native │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │ direct call                    │ HTTP (/api/v1, /api/auth)
                   ▼                                ▼
        ┌──────────────────────┐        ┌──────────────────────┐
        │  @sports/query       │◄───────┤  @sports/query       │  shared hooks + cache keys
        └──────────┬───────────┘        └──────────┬───────────┘
                   ▼                                ▼
        ┌──────────────────────────────────────────────────────┐
        │  @sports/core  · SportsDataProvider · CommentsClient  │
        │  @sports/i18n  · en / ru / ro message catalogs        │
        └──────────────────────────────────────────────────────┘
```

`SportsDataProvider` is the single seam to sports data. Lists (matches, tables, scorers) are
required. Detail views (`getMatch`, `getTeam`, `getPlayer`) are optional, and pages show a notice
when the configured source cannot serve them.

| Provider               | Data                                                                                                | Details | Key |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------- | --- |
| `ApiFootballProvider`  | Real. [api-football.com](https://www.api-football.com) v3. Covers every competition this app knows. | Yes     | Yes |
| `FootballDataProvider` | Real. [football-data.org](https://www.football-data.org) v4.                                        | No      | Yes |
| `MockProvider`         | Simulated, deterministic season. For offline work and tests only.                                   | No      | No  |
| `HttpProvider`         | Whatever the web app serves at `/api/v1`. This is what mobile uses.                                 | Yes     | No  |

## Competitions

Twenty-five competitions, in four categories. The order below is the display order everywhere,
so a Champions League night leads the scoreboard with no special casing.

| Category   | Competitions                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uefa`     | Champions League, Europa League, Conference League                                                                                                                                                                                                            |
| `national` | Nations League, Euro Qualifying, International Friendlies                                                                                                                                                                                                     |
| `top5`     | Premier League, LaLiga, Serie A, Bundesliga, Ligue 1                                                                                                                                                                                                          |
| `more`     | SuperLiga România, Super Liga Moldova, Ukrainian Premier League, Eredivisie, Primeira Liga, Belgian Pro League, Süper Lig, Scottish Premiership, Super League Greece, Austrian Bundesliga, Danish Superliga, Allsvenskan, Eliteserien, Russian Premier League |

- Everything is configured in `packages/core/src/leagues.ts`. To add a competition: add its slug
  to `LeagueSlug`, an entry to `LEAGUES`, and its api-football league id (`apiFootballId`).
  UEFA and national-team names are translated in
  `@sports/i18n` (`competitions.names`); domestic league names are proper nouns and are not.
- Pickers are two-level (category, then competition) so they fit a phone. `?league=` accepts a
  category key (`uefa`) or a competition slug (`champions-league`).
- **Zones fall back to configured data.** `League.zones` gives qualification and relegation
  places by position for the top five leagues, used when a source does not say what a position
  means. api-football does not currently map its own position descriptions to a `ZoneKind`.
- **Grouped tables.** `Standings.groups` is present when a competition has several tables
  (Nations League has 14). `Standings.rows` always holds every row for lookups.
- `hasTable` and `hasScorers` switch screens off where there is nothing to show: friendlies
  have no table, and national-team competitions publish no scorer list.
- Providers report what they cover through `getLeagues()`. api-football covers every
  competition this app knows; football-data.org covers the ones with an `externalCode`, the
  demo provider the top five.
- The Swiss Super League is not included: no source in use has a current season for it.

## Getting started

Requirements: Node 22+ (see `.nvmrc`), npm 11.

```bash
npm install
npm run dev          # http://localhost:3000
```

- **Sports data** comes from [api-football.com](https://www.api-football.com) and needs a key
  (`API_FOOTBALL_KEY`); a request fails without one. Everything else needs nothing further:
- **The database** is a SQLite file at `apps/web/data/pitchside.db`. It is created and migrated
  automatically the first time an account or comment route is used.
- **Verification emails** are written to `apps/web/data/outbox/` when no SMTP server is
  configured, and the path is logged. Open the newest file and follow the link inside.
- **`apps/web/.env.local`** holds a generated `BETTER_AUTH_SECRET`. It is git-ignored. Create one
  on a new machine with the command in `.env.example`.

See `.env.example` for every setting.

## Switching competitions

Picking a competition should feel instant, and it is built in four layers:

- **The click is answered in the browser.** The scoreboard already holds every match of the
  day, so the picker and the match list follow the click at once (`PendingNavProvider`,
  `TwoLevelChips`, `useHeadingFilter`). Only the table and scorers wait for the server, dimmed
  meanwhile; the news list is the same general mix regardless of the filter, so it never waits.
- **No waterfall.** The home page asks for matches, news, table and scorers at the same time.
  A competition nobody has opened yet used to cost two trips to the data source in a row.
- **Warm-up after the response.** `after()` runs `warmCompetitions` for the competitions one
  click away, a few at a time and at most once per ten minutes each, so the next click finds
  its data cached. The provider also shares one in-flight request per URL.
- **Days work the same way.** The day switcher and the date heading follow the click at once.
  The scoreboard preloads the matches of the days the switcher offers (`usePrefetchMatchesByDate`),
  so a clicked day usually shows its matches from the browser's cache; otherwise the current list
  stays up, dimmed, until the new one arrives. On the server, a single day's scoreboard is
  cached for 30 seconds only from yesterday to tomorrow; a finished day keeps for six hours and a
  day further ahead for fifteen minutes.
- **No link prefetching** (`@/i18n/navigation`). Pages are rendered per request, so a prefetch
  brings back nothing reusable, and dozens of them per view queue ahead of the real click.

Two things that were tried and removed, so nobody repeats them: streaming the table and news
behind `<Suspense>` made some navigations never land in production builds (the response
arrived, the page did not update), and keyed boundaries hold their placeholder for at least
300ms, which slows every warm switch. The page now arrives in one response.

Measured in a production build, clicking through all 27 filters: picker 10 to 110ms, whole
page 45 to 190ms, from an empty cache. `next dev` adds about 300ms to every request, so
expect roughly 0.4s there.

## News

Every story is written in-house in the admin console, in all three site languages at once.
There is no outside headline source: `SportsDataProvider.getNews`/`getArticle` exist in the
interface for a source that wants to supply news, but nothing currently implements them.

- **One article, three languages.** `title`, `summary` and `body` are each stored per language
  (`titleEn`/`titleRu`/`titleRo`, and so on) on the same row; everything else (photo, byline,
  tag, publish time) is shared. English is required; Russian and Romanian may be written later,
  and the public site falls back to English for whichever is still blank.
- The scoreboard's left sidebar lists the latest headlines (the same mix regardless of the
  competition picker) with a link to `/news` for the full list. Each headline opens an article
  page with its photo, full text and a comment thread.
- Below 900px the design hides the sidebar, so the news moves under the matches instead.

## Admin console

`/admin` is for staff: write and publish news, and see who the users are. It follows
`design/Pitchside Admin.html`.

- **Signing in.** Admins are ordinary accounts with `role = "admin"` (better-auth's admin
  plugin). The first one comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` and is created on the
  first visit to `/admin/login`. In development, with those unset, the design's demo login
  works: `admin@pitchside.app` / `pitchside`. **Production has no fallback**, so a password
  printed in this README can never open a live console.
- **Every page and every action checks the role on the server**, against the database, on
  each request. Hiding a button protects nothing: server actions are public endpoints.
  A member who signs in at `/admin/login` is told they have no access and is signed out.
- **News.** Articles live in the `article` table and show up in the site's news list and under
  `/api/v1/news`, so the mobile app gets them too. "Feature on home" pins one to the top. The
  editor has a language tab per site language; English is required, Russian and Romanian are
  optional and fall back to English until written. The body is plain text, rendered as text,
  never as HTML.
- **Photos.** The editor uploads a JPEG, PNG or WebP of up to 5 MB (`POST /api/admin/uploads`,
  admins only, same origin only). The server decides what a file is from its first bytes, never
  from its name or declared type, so an SVG or a web page renamed to `.jpg` is refused. Files get
  a random name, live in `UPLOADS_DIR` (default `apps/web/data/uploads`) and are served from
  `/uploads/:name` with `nosniff`. Deleting an article, or replacing its photo, deletes the file.
  A photo uploaded to an article that is then never saved stays on disk. `NewsArticle.imageUrl`
  is then a path, not a full address: API clients resolve it against the API base.
- **Scheduling** needs no background job: an article published with a future "Publish at"
  is simply not served until then. Drafts and scheduled articles answer 404 to readers.
- **Views** are counted once per browser session by a small beacon, so refreshes and link
  previews do not inflate them. It is a rough figure for editors.
- **Users.** Name, email, verified or not, joined, last active, comments, upvotes received and
  recent comments. "Last active" is when a session was last renewed (at most hourly).
  The design also shows favourite club, country and match ratings; the app does not collect
  those, so they are left out rather than invented.
- **Suspend user** bans the account: its sessions are revoked at once and it cannot sign in
  until the suspension is lifted. Admins cannot suspend themselves or each other.
- To make another admin, set `role` to `admin` on their row in the `user` table
  (`npm run db:studio -w @sports/web`). There is no screen for it on purpose.

## Languages

`next-intl` with locale-prefixed routes. A first-time visitor is sent to the language their
browser prefers; the header switch keeps the current page, day and filters.

- Catalogs live in `packages/i18n/src/messages/{en,ru,ro}.json`, in ICU format with proper
  plural rules (Russian `one / few / many`, Romanian `one / few / other`).
- `en.json` is the source of truth and provides the TypeScript types, so a misspelled key is a
  compile error. A test fails if `ru` or `ro` is missing a key or uses different placeholders.
- Always import `Link`, `useRouter`, `usePathname` and `redirect` from `@/i18n/navigation`,
  never from `next/link` or `next/navigation`, so links keep the language.
- Club, league and player names are proper nouns from the data source and stay as they are.
- Archivo has no Cyrillic, so Inter's Cyrillic subset sits behind it in the font stack. Latin
  text and figures stay in Archivo in every language.
- To add a language: add it to `LOCALES`, `LOCALE_NAMES` and `LOCALE_TAGS`, add its JSON file
  and its case in `loadMessages`. The tests tell you what is missing.

"Today" follows the viewer, not the server: the browser stores its timezone in a `tz` cookie
and the server uses it, so the day labels are right just after midnight in any timezone.

## Accounts and comments

[better-auth](https://www.better-auth.com) with email and password, on SQLite through Drizzle
and libSQL.

- **Email verification is required.** A new account cannot log in, and so cannot comment, until
  the emailed link is opened. The link signs the user in and returns them to the page they were
  on. Logging in with an unconfirmed address sends a fresh link. The email is written in the
  language of the page the user signed up from.
- **Anyone can read comments. Only signed-in users can post.** A guest can still type: pressing
  "Post" opens the dialog with "Log in" and "Create account". The draft is kept in the browser,
  is posted automatically after logging in, and is still in the box after the email
  verification round trip.
- Comments live in threads: a match or a news article (`CommentThread`). Anyone signed in can
  upvote a comment once, and take it back. Nobody upvotes their own.
- Authors can delete their own comments. There is no moderation tooling yet.
- Limits: 1000 characters per comment, 5 comments per minute per account, and better-auth's
  rate limits on sign-in, sign-up and resending the link. State-changing requests from another
  origin are refused.
- Followed clubs are a per-browser preference in `localStorage` and need no account.
- Schema: `apps/web/src/db/schema.ts`. After changing it run
  `npm run db:generate -w @sports/web`. Migrations in `apps/web/drizzle/` apply at first use.

### Going to production

Set these, or accounts will not work:

| Variable                | Why                                                                               |
| ----------------------- | --------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | Base URL for email links, auth redirects, trusted origins, the sitemap.           |
| `BETTER_AUTH_SECRET`    | Signs sessions. Auth routes fail loudly without it.                               |
| `DATABASE_URL` (+token) | A hosted libSQL/Turso database. A local file does not survive serverless deploys. |
| `SMTP_*`, `EMAIL_FROM`  | Real email delivery. Sign-up refuses to run without it in production.             |

The sign-in rate limiter keeps its counters in memory, which is per server instance. Behind
several instances, give better-auth a shared store.

Not built yet: password reset, changing email or display name, comment moderation and reporting.

## Security

What is in place, and what a deployment still has to bring.

- **Headers** (`next.config.ts`): a content security policy (no framing, no plugins, forms and
  `<base>` cannot point elsewhere, scripts cannot call other hosts), `X-Frame-Options`,
  `nosniff`, a referrer policy, a permissions policy, and HSTS in production. Scripts and styles
  stay at `'unsafe-inline'`: Next.js inlines its bootstrap data, and nonces would make every
  page dynamic. `X-Powered-By` is off.
- **Rate limits** (`middleware.ts`, `lib/rate-limit.ts`), per client address: 300 page views,
  240 API reads and 40 writes a minute, answered with 429 and `Retry-After`. It counts in the
  memory of one process. **Run the app behind a proxy that sets the client address** (or name
  the header in `CLIENT_IP_HEADER`, for example `cf-connecting-ip`): without one a client can
  send its own `X-Forwarded-For` and dodge the limit. better-auth limits log in attempts on top.
- **Upstream budget.** Every distinct match id, team id or far-off day is a distinct request to
  the data source, bounded by the per-client rate limit above; a round number passed to
  `getMatches` is bounded too (`matchday <= 60`).
- **Writes** check the `Origin` header on top of `SameSite=Lax` cookies; server actions are
  same-origin by design. Every admin page and action reads the role from the database.
- **The demo admin cannot reach production.** Its password is printed in this README. In
  production the account is only created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and if a
  development database brings `admin@pitchside.app` along with the demo password, the account
  is suspended and signed out before the first log in is handled.
- **User content is text.** Comments, names and article bodies are rendered as text, never as
  HTML. Display names are cleaned on the server (NFKC, no control or direction-override
  characters, 40 characters). Names are not unique, so comments by staff carry a "Staff" tag
  that comes from the account's role, not from its name.
- **An article's photo address is checked before it reaches an `<img>`**: it must be `https`
  or one of our own uploads, never `javascript:` or `data:`.
- **Uploads**: admins only, type decided from the file's bytes, no SVG, random names, served
  with `nosniff` and a sandboxing policy of their own.
- **Dependencies**: `npm audit` is clean. Two fixes are `overrides` in the root
  `package.json` (the PostCSS bundled inside Next.js, and the esbuild inside drizzle-kit's
  loader), because the packages that pin them have not moved yet. Re-check them when
  upgrading Next.js or drizzle-kit, and drop them once they are no longer needed.

Not covered: there is no password reset, no two-factor log in, no moderation queue, and the
view counter can be inflated within the write limit. Secrets live in `apps/web/.env.local`,
which is git-ignored, as are the database, uploads and caches under `apps/web/data/`.

## Scripts

| Command                              | What it does                                 |
| ------------------------------------ | -------------------------------------------- |
| `npm run dev`                        | Start every app in dev mode (Turbopack)      |
| `npm run build`                      | Production build of every package            |
| `npm run lint`                       | ESLint across the workspace                  |
| `npm run typecheck`                  | `tsc --noEmit` across the workspace          |
| `npm run test`                       | Vitest: core logic, providers, i18n catalogs |
| `npm run format`                     | Prettier (with Tailwind class sorting)       |
| `npm run db:generate -w @sports/web` | Generate a migration after a schema change   |

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, tests and build on every push
and pull request. Tests never touch the network, and the build needs no secret and no database:
both are opened on first use, not at import.

To run a production build while `npm run dev` is running, give it its own output folder and
database so the two do not overwrite each other:

```bash
cd apps/web
NEXT_DIST_DIR=.next-verify DATABASE_URL=file:./data/verify.db npx next build
```

## APIs (consumed by mobile)

Sports data responses are cached at the edge for 60 s (20 s for the daily scoreboard).

| Route                                             | Notes                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| `GET /api/v1/leagues`                             |                                                |
| `GET /api/v1/leagues/:slug/season`                |                                                |
| `GET /api/v1/leagues/:slug/standings`             | `form=0` to skip recent form                   |
| `GET /api/v1/leagues/:slug/matches`               | `dateFrom`, `dateTo`, `matchday`               |
| `GET /api/v1/leagues/:slug/matches/:id`           |                                                |
| `GET /api/v1/leagues/:slug/matches/:id/comments`  | Public. Newest first, never cached             |
| `POST /api/v1/leagues/:slug/matches/:id/comments` | Signed in. `{ "body": "..." }`                 |
| `GET/POST /api/v1/news/:id/comments`              | Same rules, for an article thread              |
| `POST /api/v1/comments/:id/vote`                  | Signed in. Toggles an upvote                   |
| `DELETE /api/v1/comments/:id`                     | Signed in, own comments only                   |
| `GET /api/v1/news`                                | `leagues` (comma-separated), `limit`           |
| `GET /api/v1/news/:id`                            | One article's headline and summary             |
| `GET /api/v1/leagues/:slug/teams/:id`             |                                                |
| `GET /api/v1/leagues/:slug/players/:id`           |                                                |
| `GET /api/v1/leagues/:slug/scorers`               | `limit` (max 50)                               |
| `GET /api/v1/matches`                             | `date` (YYYY-MM-DD, default today)             |
| `/api/auth/*`                                     | better-auth: sign-up, sign-in, verify, session |

Slugs: see `GET /api/v1/leagues`, which lists every competition the active data source covers,
with its category, `hasTable` and `hasScorers`. Detail routes answer `501`
when the configured source cannot serve them. Comment errors carry a machine-readable code
(`unauthorized`, `empty`, `tooLong`, `tooFast`, `notFound`, `ownComment`) so each client shows its own translation.

## About the api-football source

`ApiFootballProvider` reads [api-football.com](https://www.api-football.com) v3, which needs a
paid key (`API_FOOTBALL_KEY`; the free tier's rate limit is too low for this app). It covers
every competition `LEAGUES` lists, including full coverage (scorers, line-ups, stats) for
Romania, Moldova, Ukraine and Russia, which older sources served thinly or not at all.

- There is no numeric matchday in the source itself: single-table leagues use rounds named
  "Regular Season - N", and `getMatches`'s `matchday` reconstructs that name directly, since it
  is the source's own convention. A round that does not exist yields an empty list.
- `getMatch` comes from a single `/fixtures?id=` call, which already carries events, line-ups
  and statistics inline; head-to-head and each side's recent form cost one request more each.
- Win/draw/win predictions are fetched only before kick-off (`getMatch`'s `prediction`), since
  asking for one after the match has started or finished is a wasted request.

## Design

The interface implements `design/Pitchside.html`, built on the "Modernist" design system:
one typeface (Archivo), a warm grey ground `#f3f2f2`, near-black ink `#201e1d`, one red-orange
accent `#ec3013`, square corners, and structure from 2px and 1px dividers. Tokens and the
`.btn`, `.input` and `.table` classes live in `apps/web/src/app/globals.css`.

Deliberate differences from the prototype:

- **Real crests and live data** replace the abbreviation tiles and generated season.
- **Goalscorers on hover.** Hovering or focusing a match row opens a panel with scorers and
  sendings-off. Clicking the row opens the match page.
- **Real accounts** replace the prototype's name-only local profile. Comments are real and
  stored, with upvotes. Match ratings are not built.
- **Match groups show a match count** rather than a matchday number, to read the same way
  across UEFA and national-team competitions, which are not single-table leagues.
- **Articles have a full body**, written in-house per language, since there is no publisher
  to link out to; the design's version pointed a headline at an outside story.
- **The results ticker** in the navigation shows final scores only, from the past week, and
  by default only from the top five leagues; live games stay on the scoreboard. It appears
  from 1200px up. How many fit is measured from the strip, not from the window, because the
  rest of the navigation changes width with the language. The rules are `latestResults` in
  `@sports/core` (`categories` widens it), so the mobile app can show the same strip.
- **Line-ups are the confirmed teams only.** The design sketches "probable line-ups" before
  kick-off; the data source has none, so the tab says when they will appear instead of guessing.
  Rows follow the published formation, and fall back to positions when it does not add up.
- **Season comparison** has points, wins, goals scored and conceded, read from the league
  table. The design's clean-sheets row is left out: the source does not publish it.
- **Player search** filters the loaded list (top 30) in the browser, ignoring accents, and
  keeps each player's real rank instead of renumbering the matches.
- **The match column's minimum width is 480px, not 560px**, so the table still sits beside the
  matches at 1280px now that the news sidebar takes 280px.

## Adding the mobile app

1. `npx create-expo-app apps/mobile` and add `@sports/core`, `@sports/query`, `@sports/i18n`.
2. Wrap the root in `<SportsProvider provider={new HttpProvider({ baseUrl })}>`.
3. Use the hooks from `@sports/query` with native UI. Query keys are shared with the web.
4. Load the same catalogs with `loadMessages(locale)` into any ICU-capable i18n library.
5. For accounts use better-auth's Expo client against `/api/auth`, and pass its authenticated
   `fetch` to `new CommentsClient({ baseUrl, fetch })`.

## Conventions

- TypeScript `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Internal packages export TypeScript source directly (`exports` → `src/index.ts`); Next.js
  transpiles them via `transpilePackages`, Metro will do the same for mobile.
- Server components call the provider directly; client components go through `@sports/query`.
- Pages wrap provider calls in `safe()`, so an upstream failure degrades one section, not the route.
- URL state over client state: language, day, league filter, month and match tab are all links.
- No user-facing string in a component: everything goes through `@sports/i18n`.
- Keep `packages/core` and `packages/i18n` free of React and DOM imports so they stay portable.
