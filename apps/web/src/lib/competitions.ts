import {
  CATEGORY_ORDER,
  isCompetitionCategory,
  type CompetitionCategory,
  type League,
  type LeagueSlug,
} from '@sports/core';

/**
 * What the viewer has picked in a competition picker: everything, one category
 * ("UEFA", "National teams", ...) or one competition. The URL carries it as `?league=`,
 * whose value is either a category key or a competition slug.
 */
export type Selection =
  | { kind: 'all' }
  | { kind: 'category'; category: CompetitionCategory }
  | { kind: 'league'; league: League };

export function parseSelection(value: string | undefined, available: readonly League[]): Selection {
  if (!value) return { kind: 'all' };
  if (isCompetitionCategory(value) && available.some((l) => l.category === value)) {
    return { kind: 'category', category: value };
  }
  const league = available.find((l) => l.slug === value);
  return league ? { kind: 'league', league } : { kind: 'all' };
}

/** The `?league=` value for a selection, or undefined for "all". */
export function selectionParam(selection: Selection): string | undefined {
  if (selection.kind === 'category') return selection.category;
  if (selection.kind === 'league') return selection.league.slug;
  return undefined;
}

/** Category the selection sits in, for highlighting the first chip row. */
export function selectionCategory(selection: Selection): CompetitionCategory | null {
  if (selection.kind === 'category') return selection.category;
  if (selection.kind === 'league') return selection.league.category;
  return null;
}

/** Competition slugs a selection covers, or null for "everything". */
export function selectionSlugs(
  selection: Selection,
  available: readonly League[],
): LeagueSlug[] | null {
  if (selection.kind === 'league') return [selection.league.slug];
  if (selection.kind === 'category') {
    return available.filter((l) => l.category === selection.category).map((l) => l.slug);
  }
  return null;
}

/** Categories that have at least one competition passing `keep`, in display order. */
export function categoriesOf(
  available: readonly League[],
  keep: (league: League) => boolean = () => true,
): CompetitionCategory[] {
  return CATEGORY_ORDER.filter((c) => available.some((l) => l.category === c && keep(l)));
}

/**
 * Any next-intl translator scoped to the `competitions` namespace. Its real type is generic
 * over literal keys; these helpers build keys at runtime, so they only need this loose shape.
 */
type CompetitionTranslator = {
  (key: never, ...args: never[]): string;
  has(key: never): boolean;
};

/**
 * A competition's name in the reader's language ("Liga Campionilor", "Суперлига Греции"). Every
 * competition has one: a Russian page writes even the proper nouns in Cyrillic, and the short
 * form is usually the country, which translates too. Falls back to the source's own name.
 * Pass a translator for the `competitions` namespace.
 */
export function competitionName(league: League, t: CompetitionTranslator, short = false): string {
  const key = `${short ? 'short' : 'names'}.${league.slug}` as never;
  return t.has(key) ? t(key) : short ? league.shortName : league.name;
}

/** "Group A1" from the data source, with the word "Group" translated. */
export function groupName(name: string, t: CompetitionTranslator): string {
  const match = /^group\s+(.+)$/i.exec(name);
  return match?.[1] ? t('group' as never, { name: match[1] } as never) : name;
}
