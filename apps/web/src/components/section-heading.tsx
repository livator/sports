import type { ReactNode } from 'react';

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold tracking-widest text-pitch-400 uppercase">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
