'use client';

import { Link } from '@/i18n/navigation';
import { usePendingLink, usePendingNav } from './pending-nav';

export interface Chip {
  href: string;
  label: string;
  active: boolean;
}

function ChipLink({ chip, active, muted }: { chip: Chip; active: boolean; muted: boolean }) {
  const onClick = usePendingLink(chip.href, chip.active);
  return (
    <Link
      href={chip.href}
      scroll={false}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`border-b-2 py-1.5 ${muted ? 'text-[13px]' : 'text-sm'} ${
        active
          ? `font-bold text-ink ${muted ? 'border-ink' : 'border-accent'}`
          : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      {chip.label}
    </Link>
  );
}

/**
 * Text tabs with an accent underline on the selected one. Each chip is a real link.
 * `muted` is the quieter second row of a two-level picker. The chip that was just clicked
 * shows as selected straight away, before the server has answered.
 */
export function Chips({
  items,
  label,
  muted = false,
}: {
  items: Chip[];
  label: string;
  muted?: boolean;
}) {
  const { pendingHref } = usePendingNav();
  // Only a click on one of these chips moves the selection in this row.
  const heading = items.some((chip) => chip.href === pendingHref) ? pendingHref : null;
  return (
    <nav aria-label={label} className="flex flex-1 flex-wrap gap-x-[18px] gap-y-1">
      {items.map((chip) => (
        <ChipLink
          key={chip.href}
          chip={chip}
          muted={muted}
          active={heading ? chip.href === heading : chip.active}
        />
      ))}
    </nav>
  );
}

export interface ChipGroup {
  /** The first-row chip, e.g. a category. */
  chip: Chip;
  /** Its second row. */
  children: Chip[];
  childrenLabel: string;
}

/**
 * Two rows of chips where the first row picks which second row shows. All second rows are
 * known up front, so clicking a first-row chip swaps the second row immediately.
 */
export function TwoLevelChips({
  label,
  leading,
  groups,
  leadingChild,
}: {
  label: string;
  /** Optional first chip of the first row that belongs to no group, e.g. "All". */
  leading?: Chip;
  groups: ChipGroup[];
  /** Optional first chip of the second row, shown only for the group that is really active. */
  leadingChild?: Chip;
}) {
  const { pendingHref } = usePendingNav();
  const current = groups.find((g) => g.chip.active) ?? null;
  const heading =
    pendingHref === null
      ? undefined
      : pendingHref === leading?.href
        ? null
        : groups.find(
            (g) => g.chip.href === pendingHref || g.children.some((c) => c.href === pendingHref),
          );
  // `undefined` means the click was not on this picker at all.
  const open = heading === undefined ? current : heading;
  const moving = heading !== undefined;

  const firstRow = [...(leading ? [leading] : []), ...groups.map((g) => g.chip)].map((chip) =>
    moving ? { ...chip, active: chip.href === (open?.chip.href ?? leading?.href) } : chip,
  );
  const secondRow = open
    ? [...(leadingChild && open === current ? [leadingChild] : []), ...open.children].map((chip) =>
        // Heading for a category: nothing in its row is selected yet.
        moving && pendingHref === open.chip.href ? { ...chip, active: false } : chip,
      )
    : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Chips label={label} items={firstRow} />
      {open && open.children.length > 1 && (
        <Chips label={open.childrenLabel} muted items={secondRow} />
      )}
    </div>
  );
}
