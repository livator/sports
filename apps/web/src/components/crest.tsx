import type { Team } from '@sports/core';
import Image from 'next/image';

/**
 * Club crest in a fixed square. The design's grey abbreviation tile is the fallback
 * for sources that have no crest image.
 */
export function Crest({ team, size = 28 }: { team: Team; size?: number }) {
  if (team.crestUrl) {
    const inner = Math.round(size * 0.86);
    return (
      <span className="grid flex-none place-items-center" style={{ width: size, height: size }}>
        <Image
          src={team.crestUrl}
          alt=""
          width={inner}
          height={inner}
          className="object-contain"
          style={{ width: inner, height: inner }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid flex-none place-items-center bg-neutral-200 font-extrabold tracking-[0.04em]"
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.32)) }}
    >
      {team.tla.slice(0, 4)}
    </span>
  );
}
