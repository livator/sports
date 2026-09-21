'use client';

import type { LeagueSlug } from '@sports/core';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** A club the viewer follows. Enough is stored to show and link to it without another request. */
export interface FavouriteClub {
  id: string;
  name: string;
  league: LeagueSlug;
  /** Absent for clubs followed before crests were stored. */
  crestUrl?: string;
}

interface FavouritesValue {
  favs: FavouriteClub[];
  isFollowing: (teamId: string) => boolean;
  toggleFollow: (club: FavouriteClub) => void;
  unfollow: (teamId: string) => void;
}

const STORAGE_KEY = 'pitchside.favs';
const FavouritesContext = createContext<FavouritesValue | null>(null);

export function useFavourites(): FavouritesValue {
  const value = useContext(FavouritesContext);
  if (!value) throw new Error('useFavourites must be used inside <FavouritesProvider>');
  return value;
}

/**
 * Followed clubs are a per-browser preference (localStorage) and need no account.
 * They pin "Your clubs" on the scoreboard and set those clubs bold in tables.
 */
export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favs, setFavs] = useState<FavouriteClub[]>([]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
      if (Array.isArray(raw)) setFavs(raw as FavouriteClub[]);
    } catch {
      // Unreadable or blocked storage: start with none.
    }
  }, []);

  const save = useCallback((next: FavouriteClub[]) => {
    setFavs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the choice still holds for this visit.
    }
  }, []);

  const value = useMemo<FavouritesValue>(
    () => ({
      favs,
      isFollowing: (teamId) => favs.some((f) => f.id === teamId),
      toggleFollow: (club) =>
        save(
          favs.some((f) => f.id === club.id)
            ? favs.filter((f) => f.id !== club.id)
            : [...favs, club],
        ),
      unfollow: (teamId) => save(favs.filter((f) => f.id !== teamId)),
    }),
    [favs, save],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

/** Follow button for team pages. */
export function FollowButton({ club }: { club: FavouriteClub }) {
  const t = useTranslations('team');
  const { isFollowing, toggleFollow } = useFavourites();
  const following = isFollowing(club.id);
  return (
    <button
      type="button"
      aria-pressed={following}
      className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`}
      onClick={() => toggleFollow(club)}
    >
      {following ? t('following') : t('follow')}
    </button>
  );
}

/** Renders a club name heavier when the viewer follows that club. */
export function ClubName({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { isFollowing } = useFavourites();
  return <span className={isFollowing(teamId) ? 'font-extrabold' : 'font-medium'}>{children}</span>;
}
