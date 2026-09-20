import { useTranslations } from 'next-intl';

export function SiteFooter({ source }: { source: string }) {
  const t = useTranslations('footer');
  const credit =
    source === 'espn'
      ? t('sourceEspn')
      : source === 'football-data.org'
        ? t('sourceFootballData')
        : t('sourceMock');
  return (
    <footer className="border-t-2">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-3 px-[clamp(16px,4vw,48px)] py-6 text-[13px] text-ink-2">
        <span>{t('tagline')}</span>
        <span>
          {credit} · {t('localTimes')}
        </span>
      </div>
    </footer>
  );
}
