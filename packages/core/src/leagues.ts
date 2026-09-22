import type { CompetitionCategory, League, LeagueSlug, ZoneKind } from './types';

const standardZones = {
  championsLeague: 4,
  europaLeague: 1,
  conferenceLeague: 1,
  relegation: 3,
  relegationPlayoff: 0,
} as const;

const logo = (id: number) => `https://a.espncdn.com/i/leaguelogos/soccer/500/${id}.png`;

type Domestic = Pick<League, 'slug' | 'name' | 'shortName' | 'country' | 'countryCode'> &
  Partial<
    Pick<
      League,
      'logoUrl' | 'externalCode' | 'apiFootballId' | 'teamCount' | 'zones' | 'hasScorers'
    >
  >;

const domestic = (category: 'top5' | 'more', l: Domestic): League => ({
  category,
  hasTable: true,
  hasScorers: true,
  ...l,
});

const continental = (
  category: 'uefa' | 'national',
  l: Pick<League, 'slug' | 'name' | 'shortName' | 'hasTable' | 'hasScorers'> &
    Partial<Pick<League, 'logoUrl' | 'externalCode' | 'apiFootballId'>>,
): League => ({ category, country: 'Europe', countryCode: 'EU', ...l });

/** Order of categories wherever competitions are listed: the biggest stage first. */
export const CATEGORY_ORDER: readonly CompetitionCategory[] = ['uefa', 'national', 'top5', 'more'];

/**
 * Every competition, in display order. Match lists, chips and tables all follow this order,
 * so a Champions League night leads the scoreboard without any special casing.
 */
export const LEAGUES: readonly League[] = [
  continental('uefa', {
    slug: 'champions-league',
    name: 'Champions League',
    shortName: 'UCL',
    logoUrl: logo(2),
    externalCode: 'CL',
    apiFootballId: 2,
    hasTable: true,
    hasScorers: true,
  }),
  continental('uefa', {
    slug: 'europa-league',
    name: 'Europa League',
    shortName: 'UEL',
    logoUrl: logo(2310),
    apiFootballId: 3,
    hasTable: true,
    hasScorers: true,
  }),
  continental('uefa', {
    slug: 'conference-league',
    name: 'Conference League',
    shortName: 'UECL',
    logoUrl: logo(20296),
    apiFootballId: 848,
    hasTable: true,
    hasScorers: true,
  }),

  continental('national', {
    slug: 'nations-league',
    name: 'Nations League',
    shortName: 'Nations',
    logoUrl: logo(2395),
    apiFootballId: 5,
    hasTable: true,
    hasScorers: false,
  }),
  continental('national', {
    slug: 'euro-qualifying',
    name: 'Euro Qualifying',
    shortName: 'Euro Q',
    logoUrl: logo(56),
    apiFootballId: 960,
    hasTable: true,
    hasScorers: false,
  }),
  continental('national', {
    slug: 'friendlies',
    name: 'International Friendlies',
    shortName: 'Friendlies',
    logoUrl: logo(53),
    apiFootballId: 10,
    hasTable: false,
    hasScorers: false,
  }),

  domestic('top5', {
    slug: 'premier-league',
    name: 'Premier League',
    shortName: 'PL',
    country: 'England',
    countryCode: 'GB',
    logoUrl: logo(23),
    externalCode: 'PL',
    apiFootballId: 39,
    teamCount: 20,
    zones: { ...standardZones, championsLeague: 5 },
  }),
  domestic('top5', {
    slug: 'la-liga',
    name: 'LaLiga',
    shortName: 'LaLiga',
    country: 'Spain',
    countryCode: 'ES',
    logoUrl: logo(15),
    externalCode: 'PD',
    apiFootballId: 140,
    teamCount: 20,
    zones: { ...standardZones, championsLeague: 5 },
  }),
  domestic('top5', {
    slug: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    countryCode: 'IT',
    logoUrl: logo(12),
    externalCode: 'SA',
    apiFootballId: 135,
    teamCount: 20,
    zones: { ...standardZones },
  }),
  domestic('top5', {
    slug: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    countryCode: 'DE',
    logoUrl: logo(10),
    externalCode: 'BL1',
    apiFootballId: 78,
    teamCount: 18,
    zones: { ...standardZones, relegation: 2, relegationPlayoff: 1 },
  }),
  domestic('top5', {
    slug: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    country: 'France',
    countryCode: 'FR',
    logoUrl: logo(9),
    externalCode: 'FL1',
    apiFootballId: 61,
    teamCount: 18,
    zones: { ...standardZones, relegation: 2, relegationPlayoff: 1 },
  }),

  /*
   * ESPN has no current data for these three, so they come from TheSportsDB (see
   * providers/thesportsdb). That source publishes no scorer lists, and says nothing about
   * what a table position means, so there are no zone markers either.
   */
  domestic('more', {
    slug: 'romanian-superliga',
    name: 'SuperLiga România',
    shortName: 'Romania',
    country: 'Romania',
    countryCode: 'RO',
    apiFootballId: 283,
    teamCount: 16,
    hasScorers: false,
  }),
  domestic('more', {
    slug: 'moldovan-super-liga',
    name: 'Super Liga Moldova',
    shortName: 'Moldova',
    country: 'Moldova',
    countryCode: 'MD',
    apiFootballId: 394,
    teamCount: 8,
    hasScorers: false,
  }),
  domestic('more', {
    slug: 'ukrainian-premier-league',
    name: 'Ukrainian Premier League',
    shortName: 'Ukraine',
    country: 'Ukraine',
    countryCode: 'UA',
    apiFootballId: 333,
    teamCount: 16,
    hasScorers: false,
  }),
  domestic('more', {
    slug: 'eredivisie',
    name: 'Eredivisie',
    shortName: 'Eredivisie',
    country: 'Netherlands',
    countryCode: 'NL',
    logoUrl: logo(11),
    externalCode: 'DED',
    apiFootballId: 88,
    teamCount: 18,
  }),
  domestic('more', {
    slug: 'primeira-liga',
    name: 'Primeira Liga',
    shortName: 'Primeira',
    country: 'Portugal',
    countryCode: 'PT',
    logoUrl: logo(14),
    externalCode: 'PPL',
    apiFootballId: 94,
    teamCount: 18,
  }),
  domestic('more', {
    slug: 'belgian-pro-league',
    name: 'Belgian Pro League',
    shortName: 'Pro League',
    country: 'Belgium',
    countryCode: 'BE',
    logoUrl: logo(6),
    apiFootballId: 144,
    teamCount: 18,
  }),
  domestic('more', {
    slug: 'super-lig',
    name: 'Süper Lig',
    shortName: 'Süper Lig',
    country: 'Turkey',
    countryCode: 'TR',
    logoUrl: logo(18),
    apiFootballId: 203,
    teamCount: 18,
  }),
  domestic('more', {
    slug: 'scottish-premiership',
    name: 'Scottish Premiership',
    shortName: 'Scotland',
    country: 'Scotland',
    countryCode: 'GB',
    logoUrl: logo(45),
    apiFootballId: 179,
    teamCount: 12,
  }),
  domestic('more', {
    slug: 'super-league-greece',
    name: 'Super League Greece',
    shortName: 'Greece',
    country: 'Greece',
    countryCode: 'GR',
    logoUrl: logo(98),
    apiFootballId: 197,
    teamCount: 14,
  }),
  domestic('more', {
    slug: 'austrian-bundesliga',
    name: 'Austrian Bundesliga',
    shortName: 'Austria',
    country: 'Austria',
    countryCode: 'AT',
    logoUrl: logo(5),
    apiFootballId: 218,
    teamCount: 12,
  }),
  domestic('more', {
    slug: 'danish-superliga',
    name: 'Danish Superliga',
    shortName: 'Denmark',
    country: 'Denmark',
    countryCode: 'DK',
    apiFootballId: 119,
    teamCount: 12,
  }),
  domestic('more', {
    slug: 'allsvenskan',
    name: 'Allsvenskan',
    shortName: 'Sweden',
    country: 'Sweden',
    countryCode: 'SE',
    logoUrl: logo(16),
    apiFootballId: 113,
    teamCount: 16,
  }),
  domestic('more', {
    slug: 'eliteserien',
    name: 'Eliteserien',
    shortName: 'Norway',
    country: 'Norway',
    countryCode: 'NO',
    apiFootballId: 103,
    teamCount: 16,
  }),
  domestic('more', {
    slug: 'russian-premier-league',
    name: 'Russian Premier League',
    shortName: 'Russia',
    country: 'Russia',
    countryCode: 'RU',
    logoUrl: logo(106),
    apiFootballId: 235,
    teamCount: 16,
  }),
];

export const LEAGUE_SLUGS = LEAGUES.map((l) => l.slug) as readonly LeagueSlug[];

/** Where "Tables" and the scoreboard sidebar land when nothing is selected. */
export const DEFAULT_LEAGUE: LeagueSlug = 'premier-league';

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

export function isCompetitionCategory(value: string): value is CompetitionCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}

export function leaguesIn(
  category: CompetitionCategory,
  leagues: readonly League[] = LEAGUES,
): League[] {
  return leagues.filter((l) => l.category === category);
}

/**
 * Fallback zone for a table position, from `League.zones`. Returns null for mid-table and
 * for competitions without configured zones. Prefer `StandingRow.zone` when it is defined.
 */
export function zoneForPosition(league: League, position: number): ZoneKind | null {
  const { zones, teamCount } = league;
  if (!zones || !teamCount) return null;
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

/** The zone to show for a row: what the data source says, else the configured fallback. */
export function zoneOf(
  league: League,
  row: { position: number; zone?: ZoneKind | null },
): ZoneKind | null {
  return row.zone !== undefined ? row.zone : zoneForPosition(league, row.position);
}
