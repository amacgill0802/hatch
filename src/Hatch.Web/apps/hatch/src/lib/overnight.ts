/* What the overnight page says, in words. The server already orders the rows
   biggest deliveries first and this app has no component tests, so the
   heading, the empty state and the beneath-it count are pure functions of one
   answer from the server, each pinned in overnight.test.ts. */

import type { OvernightDto } from '../types';

/** The page's empty state - one wording, like attention.ts's own. */
export const overnightEmptyWords = (): string => 'Nothing has landed yet.';

/** `Oct 5, 7:40pm – Oct 6, 7:40am, 3 issues landed.` Singular at one, the same
    idiom totalsPhrase pluralises sessions with. Falls back to the empty
    state's words when the server has no range to report - the component
    never takes this branch, since it draws the empty state instead, but the
    function stays total rather than printing `Invalid Date`. */
export function nightHeading(dto: Pick<OvernightDto, 'from' | 'to' | 'count'>): string {
  if (dto.from === null || dto.to === null) return overnightEmptyWords();

  const from = new Date(dto.from).toLocaleString();
  const to = new Date(dto.to).toLocaleString();
  const issues = dto.count === 1 ? 'issue' : 'issues';

  return `${from} – ${to}, ${dto.count} ${issues} landed.`;
}

/** `none beneath`, `1 beneath`, `4 beneath` - a phrase, not a bare number,
    matching WorkLog.tsx's ownPhrase idiom for a descendant count. */
export function beneathLabel(descendantCount: number): string {
  return descendantCount === 0 ? 'none beneath' : `${descendantCount} beneath`;
}
