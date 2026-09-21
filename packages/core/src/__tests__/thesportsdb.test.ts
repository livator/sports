import { describe, expect, it } from 'vitest';
import { CompositeProvider } from '../providers/composite';
import { TheSportsDbProvider } from '../providers/thesportsdb';
import {
  kickoffOf,
  mapEvent,
  mapStatus,
  tlaOf,
  type TsdbEvent,
} from '../providers/thesportsdb/mappers';
import type { SportsDataProvider } from '../providers/types';
import type { League, Match } from '../types';

const event = (overrides: Partial<TsdbEvent> = {}): TsdbEvent => ({
  idEvent: '2502940',
  strTimestamp: '2026-07-17T18:30:00',
  dateEvent: '2026-07-17',
  strTime: '18:30:00',
  strStatus: 'FT',
  strSeason: '2026-2027',
  intRound: '1',
  intHomeScore: '2',
  intAwayScore: '0',
  idHomeTeam: '134005',
  idAwayTeam: '138932',
  strHomeTeam: 'FCSB',
  strAwayTeam: 'Argeș Pitești',
  strHomeTeamBadge: 'https://r2.thesportsdb.com/images/media/team/badge/fcsb.png',
  strVenue: 'Arena Națională',
  ...overrides,
});

describe('TheSportsDB mappers', () => {
  it('maps a finished match, with prefixed ids and UTC kick-off', () => {
    const match = mapEvent(event(), 'romanian-superliga');
    expect(match).toMatchObject({
      id: 'tsdb-2502940',
      leagueSlug: 'romanian-superliga',
      matchday: 1,
      kickoff: '2026-07-17T18:30:00.000Z',
      status: 'finished',
      score: { home: 2, away: 0 },
      venue: 'Arena Națională',
      homeTeam: { id: 'tsdb-134005', name: 'FCSB', tla: 'FCS' },
      awayTeam: { id: 'tsdb-138932', tla: 'API' },
    });
    expect(match?.homeTeam.crestUrl).toContain('fcsb.png');
    expect(match?.awayTeam.crestUrl).toBeUndefined();
  });

  it('keeps the score empty until a match has started', () => {
    const match = mapEvent(
      event({ strStatus: 'NS', intHomeScore: null, intAwayScore: null }),
      'romanian-superliga',
    );
    expect(match?.status).toBe('scheduled');
    expect(match?.score).toEqual({ home: null, away: null });
  });

  it('reads the status codes the source uses', () => {
    const status = (strStatus: string, extra: Partial<TsdbEvent> = {}) =>
      mapStatus(event({ strStatus, ...extra }));
    expect(status('1H')).toBe('live');
    expect(status('HT')).toBe('paused');
    expect(status('2H')).toBe('live');
    expect(status('AET')).toBe('finished');
    expect(status('PST')).toBe('postponed');
    expect(status('NS', { strPostponed: 'yes' })).toBe('postponed');
    expect(status('CANC')).toBe('cancelled');
    expect(status('')).toBe('scheduled');
  });

  it('shows the period while live, since the source has no minute', () => {
    const match = mapEvent(event({ strStatus: '2H', intHomeScore: '1' }), 'romanian-superliga');
    expect(match).toMatchObject({
      status: 'live',
      displayClock: '2H',
      score: { home: 1, away: 0 },
    });
  });

  it('falls back to date and time when there is no timestamp', () => {
    expect(kickoffOf(event({ strTimestamp: null }))).toBe('2026-07-17T18:30:00.000Z');
    expect(kickoffOf(event({ strTimestamp: null, dateEvent: null }))).toBeNull();
  });

  it('makes three-letter codes that keep similar club names apart', () => {
    expect(tlaOf('Universitatea Craiova')).toBe('UCR');
    expect(tlaOf('Universitatea Cluj')).toBe('UCL');
    expect(tlaOf('Dinamo București')).toBe('DBU');
    expect(tlaOf('Bălți')).toBe('BAL');
    expect(tlaOf('Sheriff Tiraspol')).toBe('STI');
  });
});

/** A two-round season: A beat B, then B and C drew; round 3 is still to come. */
function fakeSource(options: { tooManyFirst?: number; brokenRound?: string } = {}) {
  const calls: string[] = [];
  let refusals = options.tooManyFirst ?? 0;
  const ev = (
    id: string,
    round: string,
    home: string,
    away: string,
    hs: string | null,
    as: string | null,
    date: string,
  ) =>
    event({
      idEvent: id,
      intRound: round,
      idHomeTeam: home,
      idAwayTeam: away,
      strHomeTeam: `Club ${home}`,
      strAwayTeam: `Club ${away}`,
      intHomeScore: hs,
      intAwayScore: as,
      strStatus: hs === null ? 'NS' : 'FT',
      strTimestamp: `${date}T17:00:00`,
      dateEvent: date,
    });
  const rounds: Record<string, TsdbEvent[]> = {
    '1': [ev('1', '1', '10', '20', '3', '1', '2026-09-05')],
    '2': [ev('2', '2', '20', '30', '0', '0', '2026-09-12')],
    '3': [ev('3', '3', '30', '10', null, null, '2026-09-26')],
  };
  const fetch = (async (input: Parameters<typeof globalThis.fetch>[0]) => {
    const url = new URL(String(input));
    calls.push(url.pathname.split('/').pop() + url.search);
    if (refusals > 0) {
      refusals--;
      return new Response('slow down', { status: 429 });
    }
    const json = (body: unknown) => new Response(JSON.stringify(body));
    if (url.pathname.endsWith('/lookupleague.php'))
      return json({ leagues: [{ strCurrentSeason: '2026-2027' }] });
    if (url.pathname.endsWith('/eventsnextleague.php')) return json({ events: rounds['3'] });
    if (url.pathname.endsWith('/eventspastleague.php')) return json({ events: rounds['2'] });
    if (
      url.pathname.endsWith('/eventsround.php') &&
      url.searchParams.get('r') === options.brokenRound
    )
      return new Response('oops', { status: 500 });
    if (url.pathname.endsWith('/eventsround.php'))
      return json({ events: rounds[url.searchParams.get('r') ?? ''] ?? null });
    if (url.pathname.endsWith('/eventsday.php')) return json({ events: null });
    return json({});
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('TheSportsDbProvider', () => {
  const now = () => new Date('2026-09-21T10:00:00Z');

  it('builds the table from round results, including clubs still without a result', async () => {
    const { fetch } = fakeSource();
    const table = await new TheSportsDbProvider({ fetch, now }).getStandings('moldovan-super-liga');
    expect(table.season).toBe('2026/27');
    expect(table.rows.map((r) => [r.team.name, r.played, r.points])).toEqual([
      ['Club 10', 1, 3],
      ['Club 30', 1, 1],
      ['Club 20', 2, 1],
    ]);
    expect(table.rows[2]?.form).toEqual(['L', 'D']);
  });

  it('asks for each round once, however many screens need it', async () => {
    const { fetch, calls } = fakeSource();
    const provider = new TheSportsDbProvider({ fetch, now });
    await Promise.all([
      provider.getStandings('moldovan-super-liga'),
      provider.getStandings('moldovan-super-liga'),
      provider.getMatches('moldovan-super-liga'),
    ]);
    const roundCalls = calls.filter((c) => c.startsWith('eventsround.php'));
    expect(new Set(roundCalls).size).toBe(roundCalls.length);
  });

  it('finds the matches of a day', async () => {
    const { fetch } = fakeSource();
    const provider = new TheSportsDbProvider({ fetch, now });
    const day = await provider.getMatchesByDate('2026-09-26');
    // Every league this source serves is asked, and the fake answers all of them alike.
    expect(new Set(day.map((m) => m.id))).toEqual(new Set(['tsdb-3']));
    expect(await provider.getMatchesByDate('2026-09-27')).toEqual([]);
  });

  it('waits and retries when told it is asking too fast', async () => {
    const { fetch, calls } = fakeSource({ tooManyFirst: 2 });
    const provider = new TheSportsDbProvider({ fetch, now, retryWaitsMs: [1, 1, 1] });
    await expect(provider.getSeason('romanian-superliga')).resolves.toMatchObject({
      label: '2026/27',
    });
    expect(calls.length).toBeGreaterThan(3);
  });

  it('gives no table rather than one built from the rounds that happened to load', async () => {
    const { fetch } = fakeSource({ brokenRound: '1' });
    const provider = new TheSportsDbProvider({ fetch, now });
    await expect(provider.getStandings('moldovan-super-liga')).rejects.toThrow();
    // A fixture list, on the other hand, is better off with what there is.
    const matches = await provider.getMatches('moldovan-super-liga');
    expect(matches.map((m) => m.id)).toEqual(['tsdb-2', 'tsdb-3']);
  });

  it('holds requests back once the budget for the minute is spent', async () => {
    const { fetch } = fakeSource();
    const slow = (async (...args: Parameters<typeof globalThis.fetch>) => {
      await new Promise((resume) => setTimeout(resume, 45)); // slower than a cache hit
      return fetch(...args);
    }) as typeof globalThis.fetch;
    const pauses: number[] = [];
    const provider = new TheSportsDbProvider({
      fetch: slow,
      now,
      budget: { requests: 3, perMs: 150 },
      sleep: async (ms) => {
        pauses.push(ms);
        await new Promise((resume) => setTimeout(resume, ms));
      },
    });
    const table = await provider.getStandings('moldovan-super-liga');
    expect(table.rows).toHaveLength(3);
    // Six requests against a budget of three: it had to wait at least once, and still finished.
    expect(pauses.length).toBeGreaterThan(0);
  });

  it('hands out a slightly old answer at once and refreshes it behind the caller', async () => {
    const { fetch, calls } = fakeSource();
    let clock = new Date('2026-09-21T10:00:00Z').getTime();
    const provider = new TheSportsDbProvider({ fetch, now: () => new Date(clock) });
    await provider.getStandings('moldovan-super-liga');
    const before = calls.length;

    clock += 20 * 60_000; // everything "recent" is now out of date, but not by much
    const table = await provider.getStandings('moldovan-super-liga');
    expect(table.rows).toHaveLength(3);
    await new Promise((resume) => setTimeout(resume, 20));
    expect(calls.length).toBeGreaterThan(before); // the refresh did happen, just not in the way
  });

  it('starts from the store after a restart instead of asking the source again', async () => {
    const saved = new Map<string, { until: number; value: unknown }>();
    const store = {
      read: async (key: string) => saved.get(key),
      write: async (key: string, entry: { until: number; value: unknown }) => {
        saved.set(key, entry);
      },
    };
    const first = fakeSource();
    await new TheSportsDbProvider({ fetch: first.fetch, now, store }).getStandings(
      'moldovan-super-liga',
    );
    expect(saved.size).toBeGreaterThan(0);

    const second = fakeSource();
    const table = await new TheSportsDbProvider({ fetch: second.fetch, now, store }).getStandings(
      'moldovan-super-liga',
    );
    expect(table.rows).toHaveLength(3);
    expect(second.calls).toEqual([]);
  });

  it('refuses leagues it is not meant for', async () => {
    const { fetch } = fakeSource();
    await expect(
      new TheSportsDbProvider({ fetch, now }).getStandings('premier-league'),
    ).rejects.toThrow();
  });
});

describe('CompositeProvider', () => {
  const league = (slug: League['slug']): League => ({
    slug,
    name: slug,
    shortName: slug,
    category: 'more',
    country: 'X',
    countryCode: 'XX',
    hasTable: true,
    hasScorers: true,
  });
  const match = (id: string, slug: League['slug'], kickoff: string): Match => ({
    id,
    leagueSlug: slug,
    matchday: 1,
    kickoff,
    status: 'scheduled',
    homeTeam: { id: 'h', name: 'H', shortName: 'H', tla: 'H' },
    awayTeam: { id: 'a', name: 'A', shortName: 'A', tla: 'A' },
    score: { home: null, away: null },
  });
  const source = (
    name: string,
    slugs: League['slug'][],
    day: Match[] | Error,
  ): SportsDataProvider => ({
    name,
    getLeagues: async () => slugs.map(league),
    getSeason: async () => ({ label: name, startDate: '', endDate: '' }),
    getStandings: async (slug) => ({ leagueSlug: slug, season: name, updatedAt: '', rows: [] }),
    getMatches: async () => [],
    getTopScorers: async () => [],
    getMatchesByDate: async () => {
      if (day instanceof Error) throw day;
      return day;
    },
  });

  it('sends each league to the source that covers it, the first one winning', async () => {
    const both = new CompositeProvider([
      source('main', ['premier-league', 'eredivisie'], []),
      source('extra', ['eredivisie', 'romanian-superliga'], []),
    ]);
    expect((await both.getStandings('eredivisie')).season).toBe('main');
    expect((await both.getStandings('romanian-superliga')).season).toBe('extra');
    await expect(both.getStandings('serie-a')).rejects.toThrow();
    expect(both.name).toBe('main');
    expect(both.sources).toEqual(['main', 'extra']);
  });

  it('lists leagues in the app order, not the order the sources answered in', async () => {
    const both = new CompositeProvider([
      source('main', ['russian-premier-league', 'premier-league'], []),
      source('extra', ['romanian-superliga'], []),
    ]);
    expect((await both.getLeagues()).map((l) => l.slug)).toEqual([
      'premier-league',
      'romanian-superliga',
      'russian-premier-league',
    ]);
  });

  it('merges the day by kick-off and drops matches from a source that does not own the league', async () => {
    const both = new CompositeProvider([
      source('main', ['premier-league'], [match('pl', 'premier-league', '2026-09-26T16:30:00Z')]),
      source(
        'extra',
        ['romanian-superliga'],
        [
          match('ro', 'romanian-superliga', '2026-09-26T15:00:00Z'),
          match('stray', 'premier-league', '2026-09-26T12:00:00Z'),
        ],
      ),
    ]);
    expect((await both.getMatchesByDate('2026-09-26')).map((m) => m.id)).toEqual(['ro', 'pl']);
  });

  it('survives the extra source failing, but not the main one', async () => {
    const pl = [match('pl', 'premier-league', '2026-09-26T16:30:00Z')];
    const extraDown = new CompositeProvider([
      source('main', ['premier-league'], pl),
      source('extra', ['romanian-superliga'], new Error('down')),
    ]);
    expect((await extraDown.getMatchesByDate('2026-09-26')).map((m) => m.id)).toEqual(['pl']);
    const mainDown = new CompositeProvider([
      source('main', ['premier-league'], new Error('down')),
      source('extra', ['romanian-superliga'], []),
    ]);
    await expect(mainDown.getMatchesByDate('2026-09-26')).rejects.toThrow('down');
  });
});
