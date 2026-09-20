import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { isDemoData } from '@/lib/provider';
import { env } from '@/lib/env';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'Pitchside — Top 5 football leagues',
    template: '%s · Pitchside',
  },
  description:
    'Live scores, standings, fixtures and top scorers for the Premier League, LaLiga, Serie A, Bundesliga and Ligue 1.',
  openGraph: {
    type: 'website',
    siteName: 'Pitchside',
    title: 'Pitchside — Top 5 football leagues',
    description: 'Live scores, standings, fixtures and top scorers across Europe’s top 5 leagues.',
  },
};

export const viewport: Viewport = {
  themeColor: '#070a0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <SiteHeader demo={isDemoData()} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
