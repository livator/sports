import en from './messages/en.json';

export const LOCALES = ['en', 'ru', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, for the language switch. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  ro: 'Română',
};

/** BCP 47 tags for Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  ro: 'ro-RO',
};

/** English is the source catalog; its shape is the contract every other locale must match. */
export type Messages = typeof en;

export function isLocale(value: string | undefined | null): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? '');
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'ru':
      return (await import('./messages/ru.json')).default as Messages;
    case 'ro':
      return (await import('./messages/ro.json')).default as Messages;
    default:
      return en;
  }
}
