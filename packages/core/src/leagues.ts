import type { League, LeagueSlug } from './types';

const standardZones = {
  championsLeague: 4,
  europaLeague: 1,
  conferenceLeague: 1,
  relegation: 3,
  relegationPlayoff: 0,
} as const;

export const LEAGUES: readonly League[] = [
  {
    slug: 'premier-league',
    name: 'Premier League',
    country: 'England',
    countryCode: 'GB',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    externalCode: 'PL',
    teamCount: 20,
    colors: { primary: '#3d195b', secondary: '#00ff85' },
    zones: { ...standardZones, championsLeague: 5 },
  },
  {
    slug: 'la-liga',
    name: 'LaLiga',
    country: 'Spain',
    countryCode: 'ES',
    flag: '\u{1F1EA}\u{1F1F8}',
    externalCode: 'PD',
    teamCount: 20,
    colors: { primary: '#ee8707', secondary: '#ffffff' },
    zones: { ...standardZones, championsLeague: 5 },
  },
  {
    slug: 'serie-a',
    name: 'Serie A',
    country: 'Italy',
    countryCode: 'IT',
    flag: '\u{1F1EE}\u{1F1F9}',
    externalCode: 'SA',
    teamCount: 20,
    colors: { primary: '#024494', secondary: '#1de9b6' },
    zones: { ...standardZones },
  },
  {
    slug: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    countryCode: 'DE',
    flag: '\u{1F1E9}\u{1F1EA}',
    externalCode: 'BL1',
    teamCount: 18,
    colors: { primary: '#d20515', secondary: '#ffffff' },
    zones: { ...standardZones, relegation: 2, relegationPlayoff: 1 },
  },
  {
    slug: 'ligue-1',
    name: 'Ligue 1',
    country: 'France',
    countryCode: 'FR',
    flag: '\u{1F1EB}\u{1F1F7}',
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
