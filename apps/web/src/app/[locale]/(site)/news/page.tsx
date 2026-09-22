import type { Locale } from '@sports/i18n';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsList } from '@/components/news-list';
import { PageHeader } from '@/components/page-header';
import { getNewsFeed } from '@/lib/news';

/** More than the sidebar teaser, but still one request: the source has no further pages. */
const LIMIT = 24;

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'news' });
  return { title: t('fallbackTitle') };
}

export default async function NewsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');

  const articles = await getNewsFeed([], LIMIT, locale);

  return (
    <section>
      <PageHeader kicker={t('football')} title={t('fallbackTitle')} />
      <div className="max-w-[720px] pt-3">
        <NewsList articles={articles} thumbnails />
      </div>
    </section>
  );
}
