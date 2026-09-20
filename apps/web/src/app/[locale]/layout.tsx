import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Archivo, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AuthUiProvider } from '@/components/auth-dialog';
import { FavouritesProvider } from '@/components/favourites';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteNav } from '@/components/site-nav';
import { TimeZoneSync } from '@/components/time-zone-sync';
import { VerifiedNotice } from '@/components/verified-notice';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';
import { getProvider } from '@/lib/provider';
import '../globals.css';

// latin-ext covers Romanian diacritics. Archivo has no Cyrillic, so Inter's Cyrillic subset sits
// behind it in the font stack: Latin text and figures stay Archivo, Russian letters use Inter.
const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
const cyrillic = Inter({
  subsets: ['cyrillic'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-cyrillic',
  display: 'swap',
  preload: false,
});

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
  themeColor: '#f3f2f2',
  width: 'device-width',
  initialScale: 1,
};

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
                <TimeZoneSync />
                <div className="flex min-h-dvh flex-col">
                  <SiteNav />
                  <Suspense fallback={null}>
                    <VerifiedNotice />
                  </Suspense>
                  <main className="mx-auto w-full max-w-[1240px] flex-1 px-[clamp(16px,4vw,48px)] pb-16">
                    {children}
                  </main>
                  <SiteFooter source={getProvider().name} />
                </div>
              </AuthUiProvider>
            </FavouritesProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
