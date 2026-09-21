import { describe, expect, it } from 'vitest';
import {
  mapMatchDetail,
  mapTeamLineup,
  type EspnMatchRoster,
  type EspnSummary,
} from '../providers/espn/details';

type Entry = NonNullable<EspnMatchRoster['roster']>[number];

const player = (jersey: string, position: string, name: string, extra: Partial<Entry> = {}) => ({
  starter: position !== 'SUB',
  jersey,
  position: { abbreviation: position },
  athlete: { id: `p${jersey}`, displayName: name, lastName: name.split(' ').at(-1) ?? name },
  ...extra,
});

// The order ESPN really sends: not by line, and wide players mixed with central ones.
const bournemouth: EspnMatchRoster = {
  homeAway: 'home',
  formation: '4-2-3-1',
  roster: [
    player('1', 'G', 'Djordje Petrovic'),
    player('14', 'CD-L', 'António Silva'),
    player('5', 'CD-R', 'James Hill'),
    player('3', 'LB', 'Adrien Truffert'),
    player('15', 'RB', 'Adam Smith', { subbedOut: true }),
    player('10', 'AM', 'Ryan Christie'),
    player('8', 'LM', 'Alex Scott'),
    player('12', 'RM', 'Tyler Adams'),
    player('9', 'F', 'Evanilson'),
    player('16', 'AM-L', 'Marcus Tavernier'),
    player('37', 'AM-R', 'Rayan'),
    player('4', 'SUB', 'Lewis Cook', { subbedIn: true }),
    player('6', 'SUB', 'Julio Soler'),
  ],
};

const numbers = (rows: { number?: string }[][]) => rows.map((r) => r.map((p) => p.number));

describe('ESPN line-ups', () => {
  it('lays the starting XI out by line, left to right, following the formation', () => {
    const lineup = mapTeamLineup(bournemouth);
    expect(lineup?.formation).toBe('4-2-3-1');
    expect(numbers(lineup?.rows ?? [])).toEqual([
      ['1'],
      ['3', '14', '5', '15'],
      ['8', '12'],
      ['16', '10', '37'],
      ['9'],
    ]);
  });

  it('keeps the bench apart and records substitutions', () => {
    const lineup = mapTeamLineup(bournemouth);
    expect(lineup?.bench.map((p) => p.shortName)).toEqual(['Cook', 'Soler']);
    expect(lineup?.bench[0]?.subbedIn).toBe(true);
    expect(lineup?.rows[1]?.at(-1)).toMatchObject({ shortName: 'Smith', subbedOut: true });
  });

  it('falls back to grouping by position when the formation does not add up', () => {
    const lineup = mapTeamLineup({ ...bournemouth, formation: '4-4-2-9' });
    expect(numbers(lineup?.rows ?? []).map((r) => r.length)).toEqual([1, 4, 2, 3, 1]);
  });

  it('reports nothing before the teams are published', () => {
    expect(mapTeamLineup({ homeAway: 'home', roster: [] })).toBeNull();
    expect(mapTeamLineup(undefined)).toBeNull();
  });
});

describe('ESPN match detail extras', () => {
  const team = (id: string, name: string) => ({
    id,
    displayName: name,
    shortDisplayName: name,
    abbreviation: name.slice(0, 3).toUpperCase(),
  });
  const summary: EspnSummary = {
    header: {
      competitions: [
        {
          date: '2026-09-20T15:30Z',
          status: { type: { name: 'STATUS_SCHEDULED', state: 'pre', completed: false } },
          competitors: [
            { homeAway: 'home', team: team('349', 'Bournemouth') },
            { homeAway: 'away', team: team('364', 'Liverpool') },
          ],
        },
      ],
    },
    lastFiveGames: [
      {
        team: { id: '349' },
        events: [
          { gameDate: '2026-09-17T19:00Z', gameResult: 'W' },
          { gameDate: '2026-08-29T14:00Z', gameResult: 'D' },
          { gameDate: '2026-09-05T14:00Z', gameResult: 'L' },
        ],
      },
    ],
  };

  it('reads recent form oldest first and leaves line-ups out until they exist', () => {
    const detail = mapMatchDetail(summary, 'premier-league', '1');
    expect(detail?.form).toEqual({ home: ['D', 'L', 'W'], away: [] });
    expect(detail?.lineups).toBeUndefined();
  });
});
