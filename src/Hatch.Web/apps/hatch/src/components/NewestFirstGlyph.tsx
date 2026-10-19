import type { ReactNode } from 'react';
import { NEWEST_FIRST_LABEL, NEWEST_FIRST_TITLE } from '../lib/thread';

/* Vendored from Lucide's `arrow-down-to-line` (see packages/ui/src/icons/LICENSE);
   paths as shipped, retargeted to JSX attribute names only. It lives here and
   not in packages/ui/src/icons because that directory is the closed
   PROJECT_ICONS set a project may pick as its mark, curated to generic
   subjects - and every file in it is also an entry in that array. */
export function NewestFirstGlyph() {
  return (
    <span className="hatch-newest-first" role="img" aria-label={NEWEST_FIRST_LABEL} title={NEWEST_FIRST_TITLE}>
      <svg
        className="hatch-newest-first-glyph"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 17V3" />
        <path d="m6 11 6 6 6-6" />
        <path d="M19 21H5" />
      </svg>
    </span>
  );
}

/** A section title for a list drawn latest first: the words, then the glyph,
    in one inline-flex span so the layout never touches the <summary>. */
export function NewestFirstTitle({ children }: { children: ReactNode }) {
  return (
    <span className="hatch-section-title-row">
      {children}
      <NewestFirstGlyph />
    </span>
  );
}
