import type { Team } from '@sports/core';
import Image from 'next/image';
import { cn, contrastText } from '@/lib/utils';

const sizes = {
  sm: 'size-6 text-[9px]',
  md: 'size-8 text-[10px]',
  lg: 'size-11 text-xs',
  xl: 'size-14 text-sm',
} as const;

const px = { sm: 24, md: 32, lg: 44, xl: 56 } as const;

export function TeamBadge({
  team,
  size = 'md',
  className,
}: {
  team: Team;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (team.crestUrl) {
    return (
      <Image
        src={team.crestUrl}
        alt=""
        width={px[size]}
        height={px[size]}
        className={cn('shrink-0 object-contain', sizes[size], className)}
        unoptimized={team.crestUrl.endsWith('.svg')}
      />
    );
  }

  const primary = team.colors?.primary ?? '#334155';
  const secondary = team.colors?.secondary ?? '#0f172a';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tracking-wider ring-1 ring-white/10',
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${primary} 0%, ${primary} 55%, ${secondary} 140%)`,
        color: contrastText(primary),
        textShadow: '0 1px 1px rgb(0 0 0 / 0.35)',
      }}
    >
      {team.tla.slice(0, 3)}
    </span>
  );
}
