'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Shown once after the email verification link brings the user back (`?verified=1`). */
export function VerifiedNotice() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('verified') !== '1') return;
    setVisible(true);
    // Drop the flag from the URL so a reload or a shared link does not repeat the message.
    const rest = new URLSearchParams(searchParams);
    rest.delete('verified');
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  if (!visible) return null;
  return (
    <div role="status" className="border-b-2 bg-accent-100 text-accent-800">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-[clamp(16px,4vw,48px)] py-2.5 text-sm">
        <span>{t('verified')}</span>
        <button
          type="button"
          className="cursor-pointer font-bold"
          onClick={() => setVisible(false)}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
