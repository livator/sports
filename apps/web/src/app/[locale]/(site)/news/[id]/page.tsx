import { LEAGUES, ProviderError, type NewsArticle } from '@sports/core';
import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getFormatter, getNow, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Comments } from '@/components/comments';
import { DataNotice } from '@/components/data-notice';
import { BackLink } from '@/components/page-header';
import { ViewBeacon } from '@/components/view-beacon';
import { competitionName } from '@/lib/competitions';
import { countComments } from '@/lib/comments';
import { getAnyArticle, isArticleId } from '@/lib/news';
import { safe } from '@/lib/provider';

type Props = { params: Promise<{ locale: Locale; id: string }> };

async function load(id: string): Promise<NewsArticle | null | 'unsupported'> {
  if (!isArticleId(id)) notFound();
  let article: Awaited<ReturnType<typeof getAnyArticle>>;
  try {
    article = await getAnyArticle(id);
  } catch (error) {
    // An article the publisher does not have is a missing page, not a temporary failure.
    if (error instanceof ProviderError && error.status === 404) notFound();
    console.error('[data]', error instanceof Error ? error.message : error);
    return null;
  }
  // A draft, a scheduled article or a deleted one: as far as readers know, it does not exist.
  // Outside the try on purpose: notFound() works by throwing, and the catch would swallow it.
  if (article === null) notFound();
  return article;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const article = await load(id);
  if (article && article !== 'unsupported') {
    return { title: article.title, description: article.summary };
  }
  const t = await getTranslations({ locale, namespace: 'news' });
  return { title: t('fallbackTitle') };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');
  const tc = await getTranslations('competitions');

  const [article, commentCount] = await Promise.all([
    load(id),
    safe(countComments({ type: 'article', articleId: id })),
  ]);

  if (article === 'unsupported' || !article) {
    return (
      <section>
        <BackLink href="/" label={t('back')} />
        <DataNotice kind={article === 'unsupported' ? 'unsupported' : 'article'} />
      </section>
    );
  }

  const format = await getFormatter();
  const league = LEAGUES.find((l) => l.slug === article.leagueSlug);
  const section = league ? competitionName(league, tc) : (article.tag ?? t('football'));
  const tag = article.label ? `${section} · ${article.label}` : section;
  // Only articles written in our own console have a body; see NewsArticle.
  const own = article.body !== undefined;
  const paragraphs = (article.body ?? '').split(/\n\s*\n/).filter((p) => p.trim());
  const when = format.relativeTime(new Date(article.publishedAt), await getNow());

  return (
    <section className="max-w-[760px]">
      <BackLink href={league ? `/?league=${league.slug}` : '/'} label={t('back')} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-8 pb-3.5 text-[13px] tracking-[0.08em] uppercase">
        <span className="font-semibold text-accent-700">{tag}</span>
        <span className="text-ink-3">
          <time dateTime={article.publishedAt}>{when}</time>
          {article.author ? ` · ${article.author}` : ''}
        </span>
      </div>
      <h1 className="mb-5 -ml-[0.03em] text-[clamp(30px,4.5vw,52px)] leading-[1.05] font-extrabold tracking-[-0.02em]">
        {article.title}
      </h1>
      {article.summary && (
        <p className="mb-7 text-[19px] leading-[1.45] text-[color-mix(in_srgb,var(--color-ink)_80%,transparent)]">
          {article.summary}
        </p>
      )}
      <div className="rule-2" />

      {article.imageUrl && (
        <figure className="my-6">
          {/* A plain <img>: publisher photos come from several CDNs that an allow-list would keep missing. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            className="aspect-video w-full bg-neutral-300 object-cover contrast-[1.08] grayscale"
          />
          {article.imageCredit && (
            <figcaption className="mt-1 text-[11px] text-ink-3">
              {t('photoBy', { credit: article.imageCredit })}
            </figcaption>
          )}
        </figure>
      )}

      {own ? (
        <div className={article.imageUrl ? '' : 'pt-6'}>
          <ViewBeacon articleId={article.id} />
          {paragraphs.map((p, i) => (
            <p key={i} className="mb-4 text-[17px] leading-[1.6] whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      ) : (
        /* The full text belongs to the publisher, so this page links to it instead of copying it. */
        <div
          className={`flex flex-wrap items-center justify-between gap-4 ${article.imageUrl ? '' : 'pt-6'}`}
        >
          <p className="max-w-[440px] text-[13px] leading-normal text-ink-2">
            {t('sourceNote', { source: article.sourceName })}
          </p>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            {t('readFull', { source: article.sourceName })} ↗
          </a>
        </div>
      )}

      <h2 className="pt-10 pb-2.5 eyebrow">{t('comments', { count: commentCount ?? 0 })}</h2>
      <div className="rule-2" />
      <Comments
        thread={{ type: 'article', articleId: article.id }}
        {...(article.commentsOpen === false ? { closedNote: t('commentsClosed') } : {})}
      />
    </section>
  );
}
