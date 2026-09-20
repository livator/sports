import { describe, expect, it } from 'vitest';
import { LEAGUES } from '../leagues';
import { MockProvider } from '../providers/mock';
import { roundRobin } from '../providers/mock/season';

const seasonStart = new Date(Date.UTC(2026, 7, 14));
// A Wednesday: no matchday in progress, so every team has played the same number of games.
const midSeason = new Date(Date.UTC(2027, 0, 13, 12));

describe('roundRobin', () => {
  it('schedules every pair twice, once at each venue', () => {
    const teams = ['a', 'b', 'c', 'd'];
    const rounds = roundRobin(teams);
    expect(rounds).toHaveLength(6);
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(2);
      for (const [h, a] of round) {
        expect(h).not.toBe(a);
        seen.add(`${h}-${a}`);
      }
    }
    expect(seen.size).toBe(12);
  });
});

describe('MockProvider', () => {
  const provider = new MockProvider({ now: () => midSeason, seasonStart });

  it('is deterministic', async () => {
    const other = new MockProvider({ now: () => midSeason, seasonStart });
    const [a, b] = await Promise.all([
      provider.getStandings('serie-a'),
      other.getStandings('serie-a'),
    ]);
    expect(a.rows).toEqual(b.rows);
  });

  it('produces a full season for every league', async () => {
    for (const league of LEAGUES) {
      const matches = await provider.getMatches(league.slug);
      const n = league.teamCount;
      expect(matches).toHaveLength(n * (n - 1));
      const season = await provider.getSeason(league.slug);
      expect(season.totalMatchdays).toBe((n - 1) * 2);
      expect(season.currentMatchday).toBeGreaterThan(1);
      expect(season.currentMatchday).toBeLessThanOrEqual(season.totalMatchdays);
    }
  });

  it('marks past matches finished and future ones scheduled', async () => {
    const matches = await provider.getMatches('la-liga');
    for (const m of matches) {
      const past = m.kickoff < midSeason.toISOString();
      if (past && m.status === 'finished') {
        expect(m.score.home).not.toBeNull();
        expect(m.score.away).not.toBeNull();
      }
      if (!past) {
        expect(m.status).toBe('scheduled');
        expect(m.score).toEqual({ home: null, away: null });
      }
    }
  });

  it('standings games played is consistent per matchday', async () => {
    const standings = await provider.getStandings('bundesliga');
    const played = new Set(standings.rows.map((r) => r.played));
    expect(played.size).toBe(1);
    expect(standings.rows[0]?.position).toBe(1);
    expect(standings.rows.at(-1)?.position).toBe(18);
  });

  it('filters by matchday and date', async () => {
    const md1 = await provider.getMatches('ligue-1', { matchday: 1 });
    expect(md1).toHaveLength(9);
    expect(md1.every((m) => m.matchday === 1)).toBe(true);

    const first = md1[0]!;
    const date = first.kickoff.slice(0, 10);
    const sameDay = await provider.getMatchesByDate(date);
    expect(sameDay.some((m) => m.id === first.id)).toBe(true);
    expect(sameDay.every((m) => m.kickoff.startsWith(date))).toBe(true);
  });

  it('returns ranked top scorers', async () => {
    const scorers = await provider.getTopScorers('premier-league', 5);
    expect(scorers).toHaveLength(5);
    expect(scorers.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < scorers.length; i++) {
      expect(scorers[i - 1]!.goals).toBeGreaterThanOrEqual(scorers[i]!.goals);
    }
  });

  it('shows live matches during a kickoff window', async () => {
    const md1 = await provider.getMatches('serie-a', { matchday: 1 });
    const kickoff = new Date(md1[0]!.kickoff);
    const live = new MockProvider({
      now: () => new Date(kickoff.getTime() + 30 * 60_000),
      seasonStart,
    });
    const matches = await live.getMatches('serie-a', { matchday: 1 });
    const target = matches.find((m) => m.id === md1[0]!.id)!;
    expect(target.status).toBe('live');
    expect(target.minute).toBe(30);
  });
});
