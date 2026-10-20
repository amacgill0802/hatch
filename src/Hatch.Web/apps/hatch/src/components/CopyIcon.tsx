/**
 * Two overlapping sheets: the copy mark, for a row whose press puts something
 * on the clipboard. `currentColor`, so it takes the ink of the row it sits in,
 * in either theme, the way GearIcon does.
 */
export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      /* Decoration: the row's own text is its accessible name. */
      aria-hidden="true"
      focusable="false"
    >
      <rect x={9} y={9} width={12} height={12} rx={2} />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}
