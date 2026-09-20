import type { League, LeagueSlug } from './types';

const standardZones = {
  championsLeague: 4,
  europaLeague: 1,
  conferenceLeague: 1,
  relegation: 3,
  relegationPlayoff: 0,
} as const;

const leagueLogo = (id: number) => `https://a.espncdn.com/i/leaguelogos/soccer/500/${id}.png`;

export const LEAGUES: readonly League[] = [
  {
    slug: 'premier-league',
    name: 'Premier League',
    shortName: 'PL',
    country: 'England',
    countryCode: 'GB',
    logoUrl: leagueLogo(23),
    externalCode: 'PL',
    teamCount: 20,
    colors: { primary: '#3d195b', secondary: '#00ff85' },
    zones: { ...standardZones, championsLeague: 5 },
  },
  {
    slug: 'la-liga',
    name: 'LaLiga',
    shortName: 'LaLiga',
    country: 'Spain',
    countryCode: 'ES',
    logoUrl: leagueLogo(15),
    externalCode: 'PD',
    teamCount: 20,
    colors: { primary: '#ee8707', secondary: '#ffffff' },
    zones: { ...standardZones, championsLeague: 5 },
  },
  {
    slug: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    countryCode: 'IT',
    logoUrl: leagueLogo(12),
    externalCode: 'SA',
    teamCount: 20,
    colors: { primary: '#024494', secondary: '#1de9b6' },
    zones: { ...standardZones },
  },
  {
    slug: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    countryCode: 'DE',
    logoUrl: leagueLogo(10),
    externalCode: 'BL1',
    teamCount: 18,
    colors: { primary: '#d20515', secondary: '#ffffff' },
    zones: { ...standardZones, relegation: 2, relegationPlayoff: 1 },
  },
  {
    slug: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    country: 'France',
    countryCode: 'FR',
    logoUrl: leagueLogo(9),
    externalCode: 'FL1',
    teamCount: 18,
    colors: { primary: '#091c3e', secondary: '#dae025' },
    zones: { ...standardZones, relegation: 2, relegationPlayoff: 1 },
  },
];

export const LEAGUE_SLUGS = LEAGUES.map((l) => l.slug) as readonly LeagueSlug[];

export function isLeagueSlug(value: string): value is LeagueSlug {
  return (LEAGUE_SLUGS as readonly string[]).includes(value);
}

export function getLeague(slug: LeagueSlug): League {
  const league = LEAGUES.find((l) => l.slug === slug);
  if (!league) throw new Error(`Unknown league: ${slug}`);
  return league;
}

export function findLeague(slug: string): League | undefined {
  return isLeagueSlug(slug) ? getLeague(slug) : undefined;
}

export type ZoneKind =
  'champions-league' | 'europa-league' | 'conference-league' | 'relegation-playoff' | 'relegation';

/** Returns the qualification/relegation zone for a table position, or null for mid-table. */
export function zoneForPosition(league: League, position: number): ZoneKind | null {
  const { zones, teamCount } = league;
  const cl = zones.championsLeague;
  const el = cl + zones.europaLeague;
  const ecl = el + zones.conferenceLeague;

  if (position <= cl) return 'champions-league';
  if (position <= el) return 'europa-league';
  if (position <= ecl) return 'conference-league';

  const relegationStart = teamCount - zones.relegation + 1;
  const playoffStart = relegationStart - zones.relegationPlayoff;
  if (position >= relegationStart) return 'relegation';
  if (zones.relegationPlayoff > 0 && position >= playoffStart) return 'relegation-playoff';
  return null;
}
