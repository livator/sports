import type { CompetitionCategory, League } from '@sports/core';
import { useTranslations } from 'next-intl';
import { categoriesOf, competitionName } from '@/lib/competitions';
import { Chips, type Chip } from './chips';

/**
 * Two-level competition picker. The first row is categories (UEFA, National teams, Top 5,
 * More leagues); the second row lists the competitions of the active category. Twenty-odd
 * competitions would not fit one row on a phone, and this keeps each row short.
 */
export function CompetitionNav({
  leagues,
  activeCategory,
  activeLeague,
  categoryHref,
  leagueHref,
  leading,
  keep = () => true,
  leadingInCategory,
}: {
  leagues: readonly League[];
  activeCategory: CompetitionCategory | null;
  activeLeague: League | null;
  categoryHref: (category: CompetitionCategory) => string;
  leagueHref: (league: League) => string;
  /** Optional first chip of the category row, e.g. "All". */
  leading?: Chip;
  /** Hide competitions that make no sense on this screen, e.g. those without a table. */
  keep?: (league: League) => boolean;
  /** Optional first chip of the competition row, e.g. "All leagues" for a combined view. */
  leadingInCategory?: Chip;
}) {
  const t = useTranslations('competitions');
  const categories = categoriesOf(leagues, keep);
  const inCategory = activeCategory
    ? leagues.filter((l) => l.category === activeCategory && keep(l))
    : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Chips
        label={t('categoryNav')}
        items={[
          ...(leading ? [leading] : []),
          ...categories.map((c) => ({
            href: categoryHref(c),
            label: t(`categories.${c}`),
            active: c === activeCategory,
          })),
        ]}
      />
      {inCategory.length > 1 && (
        <Chips
          label={t(`categories.${activeCategory!}`)}
          muted
          items={[
            ...(leadingInCategory ? [leadingInCategory] : []),
            ...inCategory.map((l) => ({
              href: leagueHref(l),
              label: competitionName(l, t, true),
              active: l.slug === activeLeague?.slug,
            })),
          ]}
        />
      )}
    </div>
  );
}
