import type { CompetitionCategory, League } from '@sports/core';
import { useTranslations } from 'next-intl';
import { categoriesOf, competitionName } from '@/lib/competitions';
import { TwoLevelChips, type Chip } from './chips';

/**
 * Two-level competition picker. The first row is categories (UEFA, National teams, Top 5,
 * More leagues); the second row lists the competitions of the active category. Twenty-odd
 * competitions would not fit one row on a phone, and this keeps each row short.
 *
 * Every category's second row is sent to the browser, so picking a category shows its
 * competitions at once instead of after the server has rendered the new page.
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
  const groups = categoriesOf(leagues, keep).map((category) => ({
    chip: {
      href: categoryHref(category),
      label: t(`categories.${category}`),
      active: category === activeCategory,
    },
    childrenLabel: t(`categories.${category}`),
    children: leagues
      .filter((l) => l.category === category && keep(l))
      .map((l) => ({
        href: leagueHref(l),
        label: competitionName(l, t, true),
        active: l.slug === activeLeague?.slug,
      })),
  }));

  return (
    <TwoLevelChips
      label={t('categoryNav')}
      groups={groups}
      {...(leading ? { leading } : {})}
      {...(leadingInCategory ? { leadingChild: leadingInCategory } : {})}
    />
  );
}
