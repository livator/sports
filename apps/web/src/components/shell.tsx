import type { ReactNode } from 'react';

/**
 * Page frame from the design: a 1520px container holding an optional left sidebar and the
 * main column (up to 1240px). The sidebar is hidden below 900px, as in the design.
 * The main column is left-aligned in the frame on every page, so content lines up with the
 * brand in the navigation whether or not there is a sidebar.
 */
export function Shell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1520px] flex-1 px-[clamp(16px,4vw,48px)]">
      {aside && (
        <aside className="mr-10 hidden w-60 flex-none flex-col gap-8 border-r pt-11 pr-8 pb-16 min-[900px]:flex">
          {aside}
        </aside>
      )}
      <main className="w-full max-w-[1240px] min-w-0 flex-1 pb-16">{children}</main>
    </div>
  );
}
