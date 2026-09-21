'use client';

import { useTranslations } from 'next-intl';
import { Shell } from '@/components/shell';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <Shell>
      <section className="max-w-xl">
        <div className="pt-10 pb-5">
          <span className="mb-2.5 block kicker">{t('errorKicker')}</span>
          <h1 className="display">{t('errorTitle')}</h1>
        </div>
        <div className="rule-2" />
        <p className="pt-6 text-[17px] text-ink-2">{t('errorText')}</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">
          {t('retry')}
        </button>
      </section>
    </Shell>
  );
}
