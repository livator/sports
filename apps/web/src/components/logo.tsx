export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#46e69a" />
          <stop offset="1" stopColor="#0f9d5c" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="none" stroke="url(#logo-g)" strokeWidth="4" />
      <path d="M32 16l10 7.5-3.8 11.5H25.8L22 23.5z" fill="url(#logo-g)" />
      <path
        d="M32 16V8M42 23.5l7.5-3.5M38.2 35l6 8.5M25.8 35l-6 8.5M22 23.5L14.5 20"
        stroke="url(#logo-g)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
