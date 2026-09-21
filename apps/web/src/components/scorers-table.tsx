'use client';

import type { LeagueSlug } from '@sports/core';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { playerHref, teamHref } from '@/lib/view';

export interface ScorerRow {
  /** Place in the unfiltered list, so a search does not turn the 14th scorer into the 1st. */
  rank: number;
  league: LeagueSlug;
  leagueName: string;
  player: { id: string; name: string };
  team: { id: string; name: string; shortName: string };
  apps: number;
  assists: number;
  goals: number;
}

/** Lower-cased and without accents, so "mbappe" finds "Mbappé". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Scorer list with the design's "Search player or club" box beside the competition picker. */
export function ScorersTable({ rows, children }: { rows: ScorerRow[]; children: React.ReactNode }) {
  const t = useTranslations('players');
  const [query, setQuery] = useState('');
  const needle = fold(useDeferredValue(query).trim());
  const shown = needle
    ? rows.filter((r) =>
        [r.player.name, r.team.name, r.team.shortName].some((text) => fold(text).includes(needle)),
      )
    : rows;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-3.5">
        <div className="min-w-0 flex-[1_1_auto]">{children}</div>
        <input
          type="search"
          className="input w-60 max-w-full"
          placeholder={t('search')}
          aria-label={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 ? (
        <p className="pt-8 text-[15px] text-ink-2" role="status">
          {t('noMatch', { query: query.trim() })}
        </p>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden pt-6">
          <table className="table min-w-[560px]">
            <thead>
              <tr>
                <th scope="col" className="w-10">
                  #
                </th>
                <th scope="col">{t('player')}</th>
                <th scope="col">{t('club')}</th>
                <th scope="col">{t('league')}</th>
                <th scope="col" className="num">
                  {t('apps')}
                </th>
                <th scope="col" className="num">
                  {t('assists')}
                </th>
                <th scope="col" className="num">
                  {t('goals')}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={`${row.league}-${row.player.id}`}>
                  <td className="text-ink-3">{row.rank}</td>
                  <td className="font-semibold">
                    <Link
                      href={playerHref(row.league, row.player.id)}
                      className="hover:text-accent"
                    >
                      {row.player.name}
                    </Link>
                  </td>
                  <td>
                    <Link href={teamHref(row.league, row.team.id)} className="hover:text-accent">
                      {row.team.shortName}
                    </Link>
                  </td>
                  <td className="text-ink-3">{row.leagueName}</td>
                  <td className="num">{row.apps}</td>
                  <td className="num">{row.assists}</td>
                  <td className="num text-lg font-extrabold">{row.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
