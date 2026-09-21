'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { teamHref } from '@/lib/view';
import { useAuthUi, useSessionUser } from './auth-dialog';
import { Crest } from './crest';
import { useFavourites } from './favourites';

/** Sidebar list of followed clubs, with a prompt when there are none yet. */
export function YourClubs() {
  const t = useTranslations('clubs');
  const { favs } = useFavourites();
  const { user } = useSessionUser();
  const { openAuth, openAccount } = useAuthUi();

  return (
    <section>
      <h2 className="pb-2.5 eyebrow">{t('title')}</h2>
      <div className="rule-2" />
      {favs.map((club) => (
        <Link
          key={club.id}
          href={teamHref(club.league, club.id)}
          className="flex items-center gap-2.5 px-1.5 py-2.5 text-sm font-semibold hover:bg-hover"
        >
          <Crest
            team={{
              id: club.id,
              name: club.name,
              shortName: club.name,
              tla: club.name.slice(0, 3).toUpperCase(),
              ...(club.crestUrl ? { crestUrl: club.crestUrl } : {}),
            }}
            size={22}
          />
          <span className="truncate">{club.name}</span>
        </Link>
      ))}
      {favs.length === 0 && (
        <>
          <p className="mt-3 text-[13px] leading-normal text-ink-2">{t('hint')}</p>
          <button
            type="button"
            className="btn btn-secondary mt-3 text-[13px]"
            onClick={() => (user ? openAccount() : openAuth())}
          >
            {user ? t('manage') : t('signIn')}
          </button>
        </>
      )}
    </section>
  );
}
