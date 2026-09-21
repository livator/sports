import { leaguesIn } from '@sports/core';
import { useTranslations } from 'next-intl';
import { NotFoundView } from '@/components/not-found-view';
import { Shell } from '@/components/shell';
import { Link } from '@/i18n/navigation';

/**
 * The 404 page for everything under a locale: unknown addresses (through the catch-all route)
 * and pages that call notFound() themselves, such as a match or an article that does not
 * exist. It sits above the route groups, so it brings its own page frame.
 */
export default function NotFound() {
  const t = useTranslations('errors');
  const nav = useTranslations('nav');
  return (
    <Shell>
      <NotFoundView
        kicker={t('notFoundKicker')}
        title={t('notFoundTitle')}
        text={t('notFoundText')}
        hint={t('notFoundHint')}
        actions={
          <>
            <Link href="/" className="btn btn-primary">
              {t('notFoundCta')}
            </Link>
            <Link href="/tables" className="btn btn-secondary">
              {nav('tables')}
            </Link>
            <Link href="/players" className="btn btn-secondary">
              {nav('players')}
            </Link>
          </>
        }
        links={leaguesIn('top5').map((league) => (
          <Link key={league.slug} href={`/tables/${league.slug}`} className="hover:text-accent">
            {league.name}
          </Link>
        ))}
      />
    </Shell>
  );
}
