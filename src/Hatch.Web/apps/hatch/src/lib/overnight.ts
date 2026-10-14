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

/** Resting or loud, matching attention.ts's own AttentionTone. */
export type OvernightTone = 'rest' | 'asking';

/** Loud only while the newest night holds rows this reader has not seen.
    `dto === null` (before the first poll answers) reads as 0 unseen, rest -
    not a third state, the same as attentionTone's own note. */
export const overnightTone = (dto: OvernightDto | null): OvernightTone =>
  (dto?.unseen ?? 0) > 0 ? 'asking' : 'rest';

/** What the control is called, in words - the whole of what a screen reader
    gets, and half of what makes the loud state legible without colour. */
export function overnightLabel(dto: OvernightDto | null): string {
  const unseen = dto?.unseen ?? 0;
  if (unseen === 0) return 'Nothing new since you last read the overnight page';
  return unseen === 1 ? '1 issue landed overnight, unread' : `${unseen} issues landed overnight, unread`;
}
