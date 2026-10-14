/** The glyph's own units. A 24-unit box, matching Robot.tsx's own. */
const SIZE = 24;

/**
 * An egg: the nav's overnight control.
 *
 * Hollow at rest, the shell alone. When the newest night holds something this
 * reader has not seen, a crack lights across it - the same "hollow then fills"
 * idea Robot.tsx uses for its lamp and eyes. Every part strokes `currentColor`,
 * so a call site's own `color` picks the nav's ink; `className` picks its size.
 */
export function Egg({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <path
        className="hatch-egg-shell"
        d="M12 3.5c-3.6 0-6.5 5.2-6.5 10.2 0 3.7 2.9 6.8 6.5 6.8s6.5-3.1 6.5-6.8c0-5-2.9-10.2-6.5-10.2z"
      />
      {lit && <path className="hatch-egg-crack" d="M9.5 9l2 3-2.5 2.5 2.5 2.5 2.5-2" />}
    </svg>
  );
}
