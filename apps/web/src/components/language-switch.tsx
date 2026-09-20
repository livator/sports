'use client';

import { LOCALES, LOCALE_NAMES, type Locale } from '@sports/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Switches language in place: same page, same day, same filters. Closed, it shows only the
 * two-letter code so it fits a phone header; open, the native list shows full language names.
 */
export function LanguageSwitch() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => {
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { locale: next, scroll: false });
    });
  };

  return (
    <label className="relative flex flex-none items-center gap-1.5 border px-2.5 py-[7px] text-[13px] font-semibold uppercase hover:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
      <span className="sr-only">{t('language')}</span>
      <span aria-hidden>{locale}</span>
      <span aria-hidden className="text-[10px]">
        ▾
      </span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => change(e.target.value as Locale)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
