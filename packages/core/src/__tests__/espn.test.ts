import { describe, expect, it } from 'vitest';
import { EspnProvider } from '../providers/espn';
import {
  mapEvent,
  mapEvents,
  mapScorers,
  mapStandings,
  mapStatus,
  seasonLabel,
  type EspnEvent,
} from '../providers/espn/mappers';
import { computeForm } from '../standings';
import { monthBounds, monthsBetween, shiftIsoDate, shiftIsoMonth } from '../utils/format';

const liverpool = {
  id: '364',
  displayName: 'Liverpool',
  shortDisplayName: 'Liverpool',
  abbreviation: 'LIV',
  logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
  color: 'D11317',
  alternateColor: 'FFFFFF',
};
const bournemouth = {
  id: '349',
  displayName: 'AFC Bournemouth',
  shortDisplayName: 'Bournemouth',
  abbreviation: 'BOU',
  logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/349.png',
};

function event(overrides: Partial<EspnEvent> = {}): EspnEvent {
  return {
    id: '1',
    date: '2026-09-20T13:00Z',
    status: {
      displayClock: "90'+5'",
      type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true },
    },
    competitions: [
      {
        venue: { fullName: 'Vitality Stadium' },
        competitors: [
          { homeAway: 'home', score: '0', team: bournemouth },
          { homeAway: 'away', score: '1', team: liverpool },
        ],
        details: [
          { type: { text: 'Yellow Card' }, clock: { displayValue: "46'" }, team: { id: '364' } },
          {
            type: { text: 'Goal' },
            clock: { displayValue: "57'" },
            team: { id: '364' },
            scoringPlay: true,
            athletesInvolved: [{ displayName: 'Alexander Isak', shortName: 'A. Isak' }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ESPN mappers', () => {
  it('maps a finished match with crests, score and goal events', () => {
    const match = mapEvent(event(), 'premier-league');
    expect(match).toMatchObject({
      id: '1',
      leagueSlug: 'premier-league',
      kickoff: '2026-09-20T13:00:00.000Z',
      status: 'finished',
      score: { home: 0, away: 1 },
      venue: 'Vitality Stadium',
    });
    expect(match?.homeTeam.crestUrl).toContain('/349.png');
    expect(match?.awayTeam.colors).toEqual({ primary: '#d11317', secondary: '#ffffff' });
    expect(match?.events).toEqual([
      { type: 'goal', minute: "57'", teamId: '364', player: 'A. Isak' },
    ]);
    expect(match?.displayClock).toBeUndefined();
  });

  it('leaves the score empty before kick-off and exposes the clock while live', () => {
    const scheduled = mapEvent(
      event({ status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } } }),
      'premier-league',
    );
    expect(scheduled?.status).toBe('scheduled');
    expect(scheduled?.score).toEqual({ home: null, away: null });

    const live = mapEvent(
      event({ status: { displayClock: "67'", type: { name: 'STATUS_SECOND_HALF', state: 'in' } } }),
      'premier-league',
    );
    expect(live?.status).toBe('live');
    expect(live?.displayClock).toBe("67'");
  });

  it('maps statuses', () => {
    const s = (name: string, state: 'pre' | 'in' | 'post') => mapStatus({ type: { name, state } });
    expect(s('STATUS_HALFTIME', 'in')).toBe('paused');
    expect(s('STATUS_FIRST_HALF', 'in')).toBe('live');
    expect(s('STATUS_POSTPONED', 'pre')).toBe('postponed');
    expect(s('STATUS_CANCELED', 'post')).toBe('cancelled');
    expect(s('STATUS_FINAL_PEN', 'post')).toBe('finished');
  });

  it('classifies penalties, own goals and red cards, and skips shoot-outs', () => {
    const events = mapEvents([
      { team: { id: 'a' }, scoringPlay: true, penaltyKick: true, clock: { displayValue: "12'" } },
      { team: { id: 'b' }, scoringPlay: true, ownGoal: true, clock: { displayValue: "30'" } },
      { team: { id: 'a' }, redCard: true, clock: { displayValue: "80'" } },
      { team: { id: 'a' }, scoringPlay: true, shootout: true },
    ]);
    expect(events.map((e) => e.type)).toEqual(['penalty-goal', 'own-goal', 'red-card']);
  });

  it('maps standings sorted by rank', () => {
    const rows = mapStandings({
      children: [
        {
          standings: {
            entries: [
              {
                team: liverpool,
                stats: [
                  { name: 'rank', value: 2 },
                  { name: 'points', value: 9 },
                ],
              },
              {
                team: bournemouth,
                stats: [
                  { name: 'rank', value: 1 },
                  { name: 'points', value: 12 },
                  { name: 'gamesPlayed', value: 4 },
                  { name: 'wins', value: 4 },
                  { name: 'pointsFor', value: 9 },
                  { name: 'pointsAgainst', value: 2 },
                  { name: 'pointDifferential', value: 7 },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(rows.map((r) => r.team.tla)).toEqual(['BOU', 'LIV']);
    expect(rows[0]).toMatchObject({
      position: 1,
      played: 4,
      won: 4,
      goalsFor: 9,
      goalDifference: 7,
      points: 12,
    });
  });

  it('maps top scorers', () => {
    const scorers = mapScorers(
      {
        stats: [
          {
            name: 'goalsLeaders',
            leaders: [
              {
                value: 4,
                athlete: {
                  id: '9',
                  displayName: 'Alexander Isak',
                  team: liverpool,
                  statistics: [
                    { name: 'appearances', value: 5 },
                    { name: 'totalGoals', value: 4 },
                    { name: 'goalAssists', value: 1 },
                  ],
                },
              },
            ],
          },
        ],
      },
      10,
    );
    expect(scorers).toEqual([
      expect.objectContaining({ rank: 1, goals: 4, assists: 1, playedMatches: 5 }),
    ]);
    expect(scorers[0]?.penalties).toBeUndefined();
  });

  it('formats season labels', () => {
    expect(seasonLabel(2026)).toBe('2026/27');
    expect(seasonLabel(2099)).toBe('2099/00');
  });
});

describe('EspnProvider', () => {
  it('fetches a range month by month and filters to the requested dates', async () => {
    const requested: string[] = [];
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input));
      const dates = url.searchParams.get('dates') ?? '';
      requested.push(dates);
      const day = dates === '202608' ? '2026-08-30' : '2026-09-12';
      return new Response(
        JSON.stringify({ events: [event({ id: dates, date: `${day}T14:00Z` })] }),
      );
    }) as typeof fetch;

    const provider = new EspnProvider({ fetch: fakeFetch });
    const matches = await provider.getMatches('premier-league', {
      dateFrom: '2026-08-31',
      dateTo: '2026-09-30',
    });
    expect(requested.sort()).toEqual(['202608', '202609']);
    expect(matches.map((m) => m.id)).toEqual(['202609']);
  });

  it('uses a single-day query when from and to are equal', async () => {
    const requested: string[] = [];
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      requested.push(new URL(String(input)).searchParams.get('dates') ?? '');
      return new Response(JSON.stringify({ events: [] }));
    }) as typeof fetch;
    await new EspnProvider({ fetch: fakeFetch }).getMatches('serie-a', {
      dateFrom: '2026-09-20',
      dateTo: '2026-09-20',
    });
    expect(requested).toEqual(['20260920']);
  });
});

describe('helpers', () => {
  it('computes recent form per team', () => {
    const base = mapEvent(event(), 'premier-league')!;
    const form = computeForm([
      base,
      { ...base, id: '2', kickoff: '2026-09-27T13:00:00.000Z', score: { home: 2, away: 2 } },
    ]);
    expect(form.get('349')).toEqual(['L', 'D']);
    expect(form.get('364')).toEqual(['W', 'D']);
  });

  it('does month and date arithmetic across year boundaries', () => {
    expect(monthsBetween('2026-11-15', '2027-01-02')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(shiftIsoMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
