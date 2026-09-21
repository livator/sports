import { describe, expect, it } from 'vitest';
import {
  CATEGORY_ORDER,
  DEFAULT_LEAGUE,
  LEAGUES,
  findLeague,
  getLeague,
  isCompetitionCategory,
  isLeagueSlug,
  leaguesIn,
  zoneForPosition,
  zoneOf,
} from '../leagues';
import { SEED_TEAMS } from '../providers/mock/teams';

describe('competition config', () => {
  it('has unique slugs and short names', () => {
    const slugs = LEAGUES.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const shorts = LEAGUES.map((l) => l.shortName);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it('lists competitions category by category, in CATEGORY_ORDER', () => {
    const seen = [...new Set(LEAGUES.map((l) => l.category))];
    expect(seen).toEqual([...CATEGORY_ORDER]);
  });

  it('keeps the top five leagues and covers UEFA and national teams', () => {
    expect(leaguesIn('top5').map((l) => l.slug)).toEqual([
      'premier-league',
      'la-liga',
      'serie-a',
      'bundesliga',
      'ligue-1',
    ]);
    expect(leaguesIn('uefa').map((l) => l.slug)).toEqual([
      'champions-league',
      'europa-league',
      'conference-league',
    ]);
    expect(leaguesIn('national').map((l) => l.slug)).toContain('nations-league');
    expect(leaguesIn('more').length).toBeGreaterThanOrEqual(10);
  });

  it('points the default at a real competition with a table', () => {
    expect(getLeague(DEFAULT_LEAGUE).hasTable).toBe(true);
  });

  it('only friendlies lack a table, and scorers need a table', () => {
    expect(LEAGUES.filter((l) => !l.hasTable).map((l) => l.slug)).toEqual(['friendlies']);
    for (const league of LEAGUES) if (league.hasScorers) expect(league.hasTable).toBe(true);
  });

  it('seed teams exist for the top five only, with the configured club count', () => {
    for (const league of LEAGUES) {
      const seeded = SEED_TEAMS[league.slug];
      if (league.category === 'top5') {
        expect(seeded).toHaveLength(league.teamCount!);
        expect(new Set(seeded!.map((t) => t.id)).size).toBe(seeded!.length);
      } else {
        expect(seeded).toBeUndefined();
      }
    }
  });

  it('validates slugs and categories', () => {
    expect(isLeagueSlug('serie-a')).toBe(true);
    expect(isLeagueSlug('champions-league')).toBe(true);
    expect(isLeagueSlug('mls')).toBe(false);
    expect(findLeague('mls')).toBeUndefined();
    expect(() => getLeague('mls' as never)).toThrow();
    expect(isCompetitionCategory('uefa')).toBe(true);
    expect(isCompetitionCategory('premier-league')).toBe(false);
  });
});

describe('zones', () => {
  it('maps positions to zones for a 20-team league with 5 CL spots', () => {
    const pl = getLeague('premier-league');
    expect(zoneForPosition(pl, 1)).toBe('champions-league');
    expect(zoneForPosition(pl, 5)).toBe('champions-league');
    expect(zoneForPosition(pl, 6)).toBe('europa-league');
    expect(zoneForPosition(pl, 7)).toBe('conference-league');
    expect(zoneForPosition(pl, 10)).toBeNull();
    expect(zoneForPosition(pl, 18)).toBe('relegation');
    expect(zoneForPosition(pl, 20)).toBe('relegation');
  });

  it('maps positions to zones for an 18-team league with a relegation play-off', () => {
    const bl = getLeague('bundesliga');
    expect(zoneForPosition(bl, 15)).toBeNull();
    expect(zoneForPosition(bl, 16)).toBe('relegation-playoff');
    expect(zoneForPosition(bl, 17)).toBe('relegation');
  });

  it('has no positional fallback for competitions without configured zones', () => {
    expect(zoneForPosition(getLeague('champions-league'), 1)).toBeNull();
    expect(zoneForPosition(getLeague('eredivisie'), 1)).toBeNull();
  });

  it('prefers what the data source says over the fallback', () => {
    const pl = getLeague('premier-league');
    expect(zoneOf(pl, { position: 1 })).toBe('champions-league');
    expect(zoneOf(pl, { position: 1, zone: null })).toBeNull();
    expect(zoneOf(pl, { position: 10, zone: 'advance' })).toBe('advance');
  });
});
