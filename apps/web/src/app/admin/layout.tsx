import type { Metadata, Viewport } from 'next';
import { archivo, cyrillic } from '@/lib/fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Pitchside Admin' },
  // Staff only: keep it out of search results even if someone links to it.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f3f2f2',
  width: 'device-width',
  initialScale: 1,
};

/**
 * The console has its own document: it sits outside the locale routes (it is English only),
 * so it does not inherit the site's navigation, footer or providers.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${cyrillic.variable}`}>
      <body>
        <div className="flex min-h-dvh flex-col">{children}</div>
      </body>
    </html>
  );
}
