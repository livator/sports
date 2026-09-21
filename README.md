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

| Provider               | Data                                                                | Details | Key |
| ---------------------- | ------------------------------------------------------------------- | ------- | --- |
| `EspnProvider`         | Real. Scores, live clocks, goalscorers, cards, tables, crests.      | Yes     | No  |
| `FootballDataProvider` | Real. [football-data.org](https://www.football-data.org) v4.        | No      | Yes |
| `MockProvider`         | Simulated, deterministic season. For offline work and tests only.   | No      | No  |
| `HttpProvider`         | Whatever the web app serves at `/api/v1`. This is what mobile uses. | Yes     | No  |

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
  to `LeagueSlug`, an entry to `LEAGUES`, and its code to the provider that has it (`ESPN_CODES`,
  or `TSDB_LEAGUES` in the TheSportsDB provider).
  UEFA and national-team names are translated in
  `@sports/i18n` (`competitions.names`); domestic league names are proper nouns and are not.
- Pickers are two-level (category, then competition) so they fit a phone. `?league=` accepts a
  category key (`uefa`) or a competition slug (`champions-league`).
- **Zones come from the data.** ESPN says what each table position means, and
  `zoneFromNote` turns that into a `ZoneKind`, so nobody maintains European places per league.
  `League.zones` is only a fallback for sources that do not say.
- **Grouped tables.** `Standings.groups` is present when a competition has several tables
  (Nations League has 14). `Standings.rows` always holds every row for lookups.
- `hasTable` and `hasScorers` switch screens off where there is nothing to show: friendlies
  have no table, and national-team competitions publish no scorer list.
- Providers report what they cover through `getLeagues()`, and `CompositeProvider` sends each
  league to the first source that lists it. ESPN covers 22 competitions and is the main source;
  TheSportsDB covers Romania, Moldova and Ukraine, where ESPN has no current data (its Romanian
  feed stops in September 2025, and it has neither of the other two). football-data.org covers
  the ones with an `externalCode`, the demo provider the top five.
- The Swiss Super League is not included: no source in use has a current season for it.

## Getting started

Requirements: Node 22+ (see `.nvmrc`), npm 11.

```bash
npm install
npm run dev          # http://localhost:3000
```

Nothing else is needed locally:

- **Sports data** is real, from ESPN, with no key.
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
  `TwoLevelChips`, `useHeadingFilter`). Only the table, scorers and news wait for the server,
  dimmed meanwhile.
- **No waterfall.** The home page asks for matches, news, table and scorers at the same time.
  A competition nobody has opened yet used to cost two trips to the data source in a row.
- **Warm-up after the response.** `after()` runs `warmCompetitions` for the competitions one
  click away, a few at a time and at most once per ten minutes each, so the next click finds
  its data cached. The provider also shares one in-flight request per URL.
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

The scoreboard's left sidebar lists the latest headlines and follows the competition picker.
Each headline opens an article page with the publisher's headline, summary and photo, a link
to the full story, and a comment thread of our own.

- **The article body is never copied.** `NewsArticle` has no body field on purpose: the text
  belongs to the publisher, so the page links out instead of republishing it.
- Headlines come from the data source (`getNews`, `getArticle`, both optional). ESPN serves one
  feed per competition; merged lists are capped at six feeds, de-duplicated and sorted by time.
  Video clips are dropped. Headlines stay in the publisher's language, whatever the UI language.
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
- **News.** Articles live in the `article` table and show up in the site's news list and
  under `/api/v1/news` next to the data source's headlines, so the mobile app gets them too.
  "Feature on home" pins one to the top. Ours have a body (`NewsArticle.body`) because the
  text is ours; publisher stories still only link out. The body is plain text, rendered as
  text, never as HTML.
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

## About the ESPN source

`EspnProvider` reads ESPN's public site API, which is undocumented and comes with no stability
guarantee, so treat it as a convenience for development and personal use.

- `dates` accepts a single day, a month or a year, but not ranges. Ranges are fetched per month.
- There is no matchday concept, so fixtures navigate by month and match groups show a count.
- The standings feed has no form column. Form is derived from the last two months of results.
- The scorers feed has only full club names, so clubs are matched to the table for short names.
- The friendlies feed is worldwide. Only friendlies involving a European nation are kept, and
  the list of European nations is read from the Nations League table.
- Player profiles live on a second host (`site.web.api.espn.com`). Most players have no headshot.
- Crests and league logos are served from ESPN's CDN. They are trademarks of the clubs and
  leagues. Check licensing before running this commercially, and swap the provider if needed.

## About the TheSportsDB source

`TheSportsDbProvider` serves SuperLiga România, Super Liga Moldova and the Ukrainian Premier
League from [TheSportsDB](https://www.thesportsdb.com). It works without signing up, on the
public test key, and that key's limits shape the whole adapter:

- The free key cuts season lists short and returns only five rows of a league table, but it
  returns every match of a single round. So **the table is computed from the results**, round by
  round, with the same `computeStandings` the demo provider uses. It therefore always agrees
  with the results the app shows. It can differ from the source's own table, which comes from a
  different feed: at the time of writing the two disagree about one Ukrainian result.
- A table is never built from part of the rounds. If one round cannot be read the table fails,
  because a table from the rounds that happened to load is a wrong table that looks right.
- Romania and Moldova follow the regular season with a play-off phase with its own points rules
  (halved, or reset). The computed table stops at the end of the regular season (`regularRounds`).
- **About 30 requests a minute.** The provider counts its own requests and stays under that,
  shares identical requests, reuses a round for as long as its freshness allows (45 seconds when
  something in it is live, a quarter of an hour otherwise, half a day once it is over), and hands
  out a slightly old answer while it fetches a new one in the background.
- Answers are kept on disk (`apps/web/data/cache/thesportsdb`, or `TSDB_CACHE_DIR`) so a restart
  does not start from nothing. **The very first start is slow for these three leagues:** the
  tables need about fifty requests, so they take roughly three minutes to appear, and until then
  their pages say the data is still loading. The scoreboard never waits for this source for more
  than 2.5 seconds; its leagues are simply left out of that answer. A Patreon key
  (`THESPORTSDB_API_KEY`) raises the limit and shortens that first start.
- This source deliberately bypasses the Next.js data cache (`cache: "no-store"`). That cache
  refreshes stale entries on its own, outside the request budget, and route handlers wait for
  those refreshes before answering.
- It has no goalscorers, line-ups, match statistics, squads or scorer lists for these leagues.
  Match pages show the score, venue, recent form and this season's meetings (both worked out
  from the results); team pages show results and fixtures; there is no "Players" list.
- Clubs have no three-letter codes there, so `tlaOf` makes them ("Universitatea Craiova" is UCR,
  "Universitatea Cluj" is UCL). Ids are prefixed `tsdb-` so they never collide with ESPN's.

Both providers give every upstream request a hard timeout (8 and 10 seconds). Node's own limits
are about five minutes each for headers and body, and one stuck connection used to be able to
hold a response for that long.

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
- **Match groups show a match count**, because the data source has no matchday numbers.
- **Articles link out** to the publisher for the full text instead of showing a body.
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
