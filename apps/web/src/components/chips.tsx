import { Link } from '@/i18n/navigation';

export interface Chip {
  href: string;
  label: string;
  active: boolean;
}

/** Text tabs with an accent underline on the selected one. Each chip is a real link. */
export function Chips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-1 flex-wrap gap-x-[18px] gap-y-1">
      {items.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          scroll={false}
          aria-current={chip.active ? 'page' : undefined}
          className={`border-b-2 py-1.5 text-sm ${
            chip.active
              ? 'border-accent font-bold text-ink'
              : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
