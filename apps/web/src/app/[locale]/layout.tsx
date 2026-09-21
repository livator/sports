import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AuthUiProvider } from '@/components/auth-dialog';
import { FavouritesProvider } from '@/components/favourites';
import { PendingNavProvider } from '@/components/pending-nav';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteNav } from '@/components/site-nav';
import { TimeZoneSync } from '@/components/time-zone-sync';
import { VerifiedNotice } from '@/components/verified-notice';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';
import { archivo, cyrillic } from '@/lib/fonts';
import { dataSources } from '@/lib/provider';
import '../globals.css';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: t('title'), template: '%s | Pitchside' },
    description: t('description'),
  };
}

export const viewport: Viewport = {
  themeColor: '#fbfaf8',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Document, providers, navigation and footer. The page frame (`<Shell>`) is added by each
 * section: the home page brings its own sidebar, everything else uses `(site)/layout.tsx`.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${archivo.variable} ${cyrillic.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <FavouritesProvider>
              <AuthUiProvider>
                <PendingNavProvider>
                  <TimeZoneSync />
                  <div className="flex min-h-dvh flex-col">
                    <SiteNav />
                    <Suspense fallback={null}>
                      <VerifiedNotice />
                    </Suspense>
                    {children}
                    <SiteFooter sources={dataSources()} />
                  </div>
                </PendingNavProvider>
              </AuthUiProvider>
            </FavouritesProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
