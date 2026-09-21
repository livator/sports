import { LEAGUES, type NewsArticle } from '@sports/core';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { competitionName } from '@/lib/competitions';

/** Competition name when we know it, the publisher's own label otherwise. */
export function useNewsTag(): (article: NewsArticle) => string {
  const t = useTranslations('news');
  const tc = useTranslations('competitions');
  return (article) => {
    const league = LEAGUES.find((l) => l.slug === article.leagueSlug);
    return league ? competitionName(league, tc) : (article.tag ?? t('football'));
  };
}

/** "Latest news": tag, age and a two-line headline per story, as in the design's sidebar. */
export function NewsList({
  articles,
  filterLabel,
}: {
  articles: NewsArticle[] | null;
  /** What the list is filtered to, shown on the right of the heading. */
  filterLabel: string;
}) {
  const t = useTranslations('news');
  const format = useFormatter();
  const now = useNow();
  const tagOf = useNewsTag();

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 pb-2.5">
        <h2 className="flex-none eyebrow">{t('latest')}</h2>
        <span className="min-w-0 truncate text-xs text-ink-3">{filterLabel}</span>
      </div>
      <div className="rule-2" />
      {!articles ? (
        <p className="py-4 text-sm text-ink-2">{t('unavailable')}</p>
      ) : articles.length === 0 ? (
        <p className="py-4 text-sm text-ink-2">{t('none')}</p>
      ) : (
        articles.map((article) => (
          <Link
            key={article.id}
            href={`/news/${article.id}`}
            className="block border-b px-1 py-3 hover:bg-hover"
          >
            <span className="mb-1.5 flex flex-wrap gap-x-2.5 text-[11px] tracking-[0.08em] uppercase">
              <span className="font-semibold text-accent-700">{tagOf(article)}</span>
              <time dateTime={article.publishedAt} className="text-ink-3">
                {format.relativeTime(new Date(article.publishedAt), now)}
              </time>
            </span>
            <span className="line-clamp-2 text-sm leading-[1.35] font-semibold">
              {article.title}
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
