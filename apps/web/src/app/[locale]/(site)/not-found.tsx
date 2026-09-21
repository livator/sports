import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <section className="max-w-xl">
      <div className="pt-10 pb-5">
        <span className="mb-2.5 block kicker">{t('notFoundKicker')}</span>
        <h1 className="display">{t('notFoundTitle')}</h1>
      </div>
      <div className="rule-2" />
      <p className="pt-6 text-[17px] text-ink-2">{t('notFoundText')}</p>
      <Link href="/" className="btn btn-primary mt-6">
        {t('notFoundCta')}
      </Link>
    </section>
  );
}
