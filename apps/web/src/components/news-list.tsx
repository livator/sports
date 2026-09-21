import { LEAGUES, type NewsArticle } from '@sports/core';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { NewsLink } from './news-link';
import { competitionName } from '@/lib/competitions';

/** Competition name when we know it, the publisher's own label otherwise. */
export function useNewsTag(): (article: NewsArticle) => string {
  const t = useTranslations('news');
  const tc = useTranslations('competitions');
  return (article) => {
    const league = LEAGUES.find((l) => l.slug === article.leagueSlug);
    const base = league ? competitionName(league, tc) : (article.tag ?? t('football'));
    return article.label ? `${base} · ${article.label}` : base;
  };
}

/** "Latest news": tag, age and a two-line headline per story, as in the design's sidebar. */
export function NewsList({
  articles,
  filterLabel,
  heading,
  activeId,
  thumbnails = false,
}: {
  articles: NewsArticle[] | null;
  /** What the list is filtered to, shown on the right of the heading. */
  filterLabel?: string;
  /** Defaults to "Latest news". */
  heading?: string;
  /** The article being read, when the list sits beside one: it is marked, not hidden. */
  activeId?: string;
  /** Show each story's photo beside its headline. For columns with the width to spare. */
  thumbnails?: boolean;
}) {
  const t = useTranslations('news');
  const format = useFormatter();
  const now = useNow();
  const tagOf = useNewsTag();

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 pb-2.5">
        <h2 className="flex-none eyebrow">{heading ?? t('latest')}</h2>
        {filterLabel && <span className="min-w-0 truncate text-xs text-ink-3">{filterLabel}</span>}
      </div>
      <div className="rule-2" />
      {!articles ? (
        <p className="py-4 text-sm text-ink-2">{t('unavailable')}</p>
      ) : articles.length === 0 ? (
        <p className="py-4 text-sm text-ink-2">{t('none')}</p>
      ) : (
        articles.map((article) => (
          <NewsLink
            key={article.id}
            articleId={article.id}
            active={article.id === activeId}
            {...(thumbnails ? { thumbnailUrl: article.imageUrl ?? null } : {})}
          >
            <span className="mb-1.5 flex flex-wrap gap-x-2.5 text-[11px] tracking-[0.08em] uppercase">
              <span className="font-semibold text-accent-700">{tagOf(article)}</span>
              <time dateTime={article.publishedAt} className="text-ink-3">
                {format.relativeTime(new Date(article.publishedAt), now)}
              </time>
            </span>
            <span
              className={`leading-[1.35] font-semibold ${thumbnails ? 'line-clamp-3 text-[15px]' : 'line-clamp-2 text-sm'}`}
            >
              {article.title}
            </span>
          </NewsLink>
        ))
      )}
    </section>
  );
}
