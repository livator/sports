import type { ReactNode } from 'react';

/**
 * An assistant referee's flag, raised: the football way of saying "you cannot be here".
 * Flat and quartered in the accent colour and ink, like a real one, with square joins to sit
 * with the rest of the design.
 */
function OffsideFlag() {
  return (
    // The canvas is wider than the flag: tilting the pole swings the cloth to the right.
    <svg
      viewBox="0 0 152 150"
      width="152"
      height="150"
      aria-hidden
      className="h-[clamp(110px,16vw,190px)] w-auto flex-none"
    >
      {/* The pole, held at an angle as it is when the flag goes up. */}
      <g transform="rotate(14 60 140)">
        <rect x="57" y="8" width="5" height="138" className="fill-ink" />
        <rect x="62" y="12" width="26" height="20" className="fill-accent" />
        <rect x="88" y="12" width="26" height="20" className="fill-ink" />
        <rect x="62" y="32" width="26" height="20" className="fill-ink" />
        <rect x="88" y="32" width="26" height="20" className="fill-accent" />
      </g>
    </svg>
  );
}

/**
 * The 404 page's content, shared by every place a missing page can turn up: the localized
 * site, the admin console and the bare fallback. Text and links are passed in, because each
 * of those has its own language and its own idea of where "back to safety" is.
 */
export function NotFoundView({
  kicker,
  title,
  text,
  hint,
  actions,
  links,
}: {
  kicker: string;
  title: string;
  text: string;
  /** Introduces `links`, e.g. "Or pick up from here". */
  hint?: string;
  /** Buttons: the first is the main way out. */
  actions: ReactNode;
  /** A quieter list of other places to go. */
  links?: ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-x-16 gap-y-10 pt-[clamp(40px,8vw,96px)]">
      <div className="max-w-[640px] min-w-0 flex-[1_1_420px]">
        <span className="mb-3 block kicker">{kicker}</span>
        <h1 className="-ml-[0.04em] text-[clamp(56px,11vw,136px)] leading-[0.92] font-extrabold tracking-[-0.04em]">
          {title}
          <span className="text-accent">.</span>
        </h1>
        <div className="mt-8 rule-2" />
        <p className="pt-6 text-[19px] leading-[1.5] text-ink-2">{text}</p>
        <div className="flex flex-wrap gap-2.5 pt-7">{actions}</div>
        {links && (
          <div className="pt-12">
            {hint && <h2 className="pb-2.5 eyebrow">{hint}</h2>}
            <div className="rule-2" />
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm">{links}</div>
          </div>
        )}
      </div>
      <OffsideFlag />
    </section>
  );
}
