import { DEFAULT_LOCALE, LOCALES } from '@sports/i18n';
import { defineRouting } from 'next-intl/routing';

/** English lives at "/", Russian at "/ru", Romanian at "/ro". */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
});
