import { describe, expect, it } from 'vitest';
import { LEAGUES, findLeague, getLeague, isLeagueSlug, zoneForPosition } from '../leagues';
import { SEED_TEAMS } from '../providers/mock/teams';

describe('league config', () => {
  it('has exactly the top-5 leagues', () => {
    expect(LEAGUES.map((l) => l.slug)).toEqual([
      'premier-league',
      'la-liga',
      'serie-a',
      'bundesliga',
      'ligue-1',
    ]);
  });

  it('seed team counts match league config', () => {
    for (const league of LEAGUES) {
      expect(SEED_TEAMS[league.slug]).toHaveLength(league.teamCount);
    }
  });

  it('seed team ids are unique within a league', () => {
    for (const league of LEAGUES) {
      const ids = SEED_TEAMS[league.slug].map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('validates slugs', () => {
    expect(isLeagueSlug('serie-a')).toBe(true);
    expect(isLeagueSlug('mls')).toBe(false);
    expect(findLeague('mls')).toBeUndefined();
    expect(() => getLeague('mls' as never)).toThrow();
  });

  it('maps positions to zones for a 20-team league with 5 CL spots', () => {
    const pl = getLeague('premier-league');
    expect(zoneForPosition(pl, 1)).toBe('champions-league');
    expect(zoneForPosition(pl, 5)).toBe('champions-league');
    expect(zoneForPosition(pl, 6)).toBe('europa-league');
    expect(zoneForPosition(pl, 7)).toBe('conference-league');
    expect(zoneForPosition(pl, 10)).toBeNull();
    expect(zoneForPosition(pl, 17)).toBeNull();
    expect(zoneForPosition(pl, 18)).toBe('relegation');
    expect(zoneForPosition(pl, 20)).toBe('relegation');
  });

  it('maps positions to zones for an 18-team league with a relegation play-off', () => {
    const bl = getLeague('bundesliga');
    expect(zoneForPosition(bl, 15)).toBeNull();
    expect(zoneForPosition(bl, 16)).toBe('relegation-playoff');
    expect(zoneForPosition(bl, 17)).toBe('relegation');
    expect(zoneForPosition(bl, 18)).toBe('relegation');
  });
});
