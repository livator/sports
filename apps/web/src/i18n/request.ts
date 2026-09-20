import { loadMessages } from '@sports/i18n';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    // Server-rendered dates are UTC; kick-off times are re-rendered in the viewer's zone on the client.
    timeZone: 'UTC',
  };
});
