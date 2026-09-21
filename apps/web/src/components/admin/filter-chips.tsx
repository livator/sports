'use client';

/** The design's underlined filter chips, for lists that filter in the browser. */
export function FilterChips<T extends string>({
  label,
  items,
  active,
  onSelect,
}: {
  label: string;
  items: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-[1_1_auto] flex-wrap gap-x-[18px] gap-y-1"
    >
      {items.map((item) => {
        const on = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(item.id)}
            className={`border-b-2 py-1.5 text-sm ${
              on
                ? 'border-accent font-bold text-ink'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
