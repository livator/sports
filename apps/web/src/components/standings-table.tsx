import { signed, zoneForPosition, type League, type Standings, type ZoneKind } from '@sports/core';
import { cn } from '@/lib/utils';
import { FormPips } from './form-pips';
import { TeamBadge } from './team-badge';

const zoneColor: Record<ZoneKind, string> = {
  'champions-league': 'bg-zone-cl',
  'europa-league': 'bg-zone-el',
  'conference-league': 'bg-zone-ecl',
  'relegation-playoff': 'bg-zone-po',
  relegation: 'bg-zone-rel',
};

const zoneLabel: Record<ZoneKind, string> = {
  'champions-league': 'Champions League',
  'europa-league': 'Europa League',
  'conference-league': 'Conference League',
  'relegation-playoff': 'Relegation play-off',
  relegation: 'Relegation',
};

export function StandingsTable({
  league,
  standings,
  compact = false,
}: {
  league: League;
  standings: Standings;
  compact?: boolean;
}) {
  const zonesUsed = new Set<ZoneKind>();
  for (const row of standings.rows) {
    const z = zoneForPosition(league, row.position);
    if (z) zonesUsed.add(z);
  }

  return (
    <div className="overflow-hidden rounded-2xl glass">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] tracking-wider text-ink-faint uppercase">
              <th className="w-10 py-3 pl-4 text-left font-medium">#</th>
              <th className="py-3 text-left font-medium">Club</th>
              <th className="w-10 py-3 text-center font-medium tabular">P</th>
              {!compact && (
                <>
                  <th className="hidden w-10 py-3 text-center font-medium tabular sm:table-cell">
                    W
                  </th>
                  <th className="hidden w-10 py-3 text-center font-medium tabular sm:table-cell">
                    D
                  </th>
                  <th className="hidden w-10 py-3 text-center font-medium tabular sm:table-cell">
                    L
                  </th>
                  <th className="hidden w-14 py-3 text-center font-medium tabular md:table-cell">
                    GF:GA
                  </th>
                </>
              )}
              <th className="w-12 py-3 text-center font-medium tabular">GD</th>
              <th className="w-12 py-3 pr-4 text-center font-semibold text-ink tabular">Pts</th>
              {!compact && (
                <th className="hidden py-3 pr-4 text-right font-medium lg:table-cell">Form</th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => {
              const zone = zoneForPosition(league, row.position);
              return (
                <tr
                  key={row.team.id}
                  className="group relative border-b border-line/60 transition last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="relative py-2.5 pl-4">
                    {zone && (
                      <span
                        className={cn(
                          'absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r',
                          zoneColor[zone],
                        )}
                        title={zoneLabel[zone]}
                      />
                    )}
                    <span className="text-ink-muted tabular">{row.position}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-3">
                      <TeamBadge team={row.team} size="sm" />
                      <span className="font-medium">
                        <span className="hidden sm:inline">{row.team.shortName}</span>
                        <span className="sm:hidden">{row.team.tla}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-ink-muted tabular">{row.played}</td>
                  {!compact && (
                    <>
                      <td className="hidden py-2.5 text-center text-ink-muted tabular sm:table-cell">
                        {row.won}
                      </td>
                      <td className="hidden py-2.5 text-center text-ink-muted tabular sm:table-cell">
                        {row.drawn}
                      </td>
                      <td className="hidden py-2.5 text-center text-ink-muted tabular sm:table-cell">
                        {row.lost}
                      </td>
                      <td className="hidden py-2.5 text-center text-ink-muted tabular md:table-cell">
                        {row.goalsFor}:{row.goalsAgainst}
                      </td>
                    </>
                  )}
                  <td
                    className={cn(
                      'py-2.5 text-center tabular',
                      row.goalDifference > 0 && 'text-pitch-400',
                      row.goalDifference < 0 && 'text-loss/80',
                      row.goalDifference === 0 && 'text-ink-muted',
                    )}
                  >
                    {signed(row.goalDifference)}
                  </td>
                  <td className="py-2.5 pr-4 text-center font-display font-bold tabular">
                    {row.points}
                  </td>
                  {!compact && (
                    <td className="hidden py-2.5 pr-4 text-right lg:table-cell">
                      <FormPips form={row.form} className="justify-end" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs text-ink-muted">
          {[...zonesUsed].map((zone) => (
            <span key={zone} className="flex items-center gap-2">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', zoneColor[zone])} />
              {zoneLabel[zone]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
