import { useId } from 'react';

/** Rim panels of the ball. They run past the outline on purpose and are clipped to it. */
const PANELS = [
  '12,5.1 15.54,4.05 15.11,0.41 8.89,0.41 8.46,4.05',
  '18.56,9.87 20.65,12.91 23.98,11.37 22.06,5.46 18.47,6.18',
  '16.06,17.58 13.81,20.51 16.3,23.2 21.33,19.55 19.53,16.35',
  '7.94,17.58 4.47,16.35 2.67,19.55 7.7,23.2 10.19,20.51',
  '5.44,9.87 5.53,6.18 1.94,5.46 0.02,11.37 3.35,12.91',
];
const SEAMS =
  'M12 8V5.1M15.8 10.76l2.76-.89M14.35 15.24l1.71 2.34M9.65 15.24l-1.71 2.34M8.2 10.76l-2.76-.89';

/**
 * A football, for marking goals. Drawn flat in the text colour with square joins, to sit with
 * the rest of the design: a centre panel, five seams and five rim panels, nothing shaded.
 * `label` is what screen readers hear; leave it out when the text beside it already says "goal".
 */
export function GoalIcon({
  label,
  size = 15,
  className = '',
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block flex-none align-[-0.2em] ${className}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <clipPath id={clip}>
        <circle cx="12" cy="12" r="10.5" />
      </clipPath>
      <g clipPath={`url(#${clip})`} fill="currentColor">
        <polygon points="12,8 15.8,10.76 14.35,15.24 9.65,15.24 8.2,10.76" />
        {PANELS.map((points) => (
          <polygon key={points} points={points} />
        ))}
        <path d={SEAMS} fill="none" stroke="currentColor" strokeWidth="1.4" />
      </g>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
