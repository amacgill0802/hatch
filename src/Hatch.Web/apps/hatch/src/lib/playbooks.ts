/* Reading a playbook row: which move it speaks for. */

import type { Playbook, PlaybookFileDto, PlaybookFileRowDto } from '../types';

/**
 * A row whose two ends are the same column is the review playbook: what an
 * agent is told when a pull request in review has stopped merging cleanly or its
 * build has failed - one row answers both, and the runner brings the facts.
 *
 * The server only accepts that for the review column, and says which column may
 * when it is tried on any other - so nothing here checks which column it is,
 * and a row that reached the page with both ends equal is one the server let
 * through.
 */
export const isReviewPlaybook = (p: Pick<Playbook, 'fromStatusId' | 'toStatusId'>): boolean =>
  p.fromStatusId === p.toStatusId;

/**
 * The move a row is for, as a phrase: `todo to in progress`, or `review
 * review` for the review playbook. What a control's accessible name is
 * built from, so two rows on one page never share one.
 */
export function transitionLabel(p: Pick<Playbook, 'fromStatusId' | 'toStatusId' | 'fromStatusName' | 'toStatusName'>): string {
  return isReviewPlaybook(p) ? `${p.fromStatusName} review` : `${p.fromStatusName} to ${p.toStatusName}`;
}

/** What the budget field shows: blank for no cap, the number otherwise.
    Mirrors wipLimitDraft - see lib/wip.ts. */
export function budgetDraft(budget: number | null): string {
  return budget === null ? '' : String(budget);
}

/** The field, trimmed, as the wire's `budget` - blank clears it. */
export function budgetRequest(draft: string): string {
  return draft.trim();
}

/** What the brief limit field shows: blank for no cap, the number otherwise.
    Mirrors budgetDraft. */
export function briefLimitDraft(briefLimit: number | null): string {
  return briefLimit === null ? '' : String(briefLimit);
}

/** The field, trimmed, as the wire's `briefLimit` - blank clears it. */
export function briefLimitRequest(draft: string): string {
  return draft.trim();
}

/** What the denied tools field shows: one rule per line, blank for none. */
export function deniedToolsDraft(rules: string[]): string {
  return rules.join('\n');
}

/** The field, split into rules for the wire: one per line, trimmed, blanks dropped. */
export function deniedToolsRequest(draft: string): string[] {
  return draft
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/** What a row's project reads as: "All projects" for a board-wide row, "KEY — Name" otherwise. */
export function projectLabel(p: Pick<Playbook, 'projectKey' | 'projectName'>): string {
  return p.projectKey === null || p.projectName === null
    ? 'All projects'
    : `${p.projectKey} — ${p.projectName}`;
}

/** A row's label: board-wide, or the project's own - see HA-460. Drawn on
    every row of the main table, filtered or not. */
export function playbookLabel(p: Pick<Playbook, 'projectKey'>): string {
  return p.projectKey === null ? 'board-wide' : `${p.projectKey}'s own`;
}

/** A file row's label - the third of the three, drawn once a repo-sourced
    project's own file is merged into the table under its filter. */
export function fileRowLabel(file: Pick<PlaybookFileDto, 'trunk' | 'sha'>): string {
  return `.hatch/playbooks.yaml on ${file.trunk} at ${file.sha.slice(0, 7)}`;
}

/** Whether a board-wide row is shadowed by one of a repo-sourced project's
    own file rows - the same transition, types and shape, so the file row
    already speaks for every move the board-wide one would and the
    board-wide one never will, for this project. Types compared as a set -
    HA-459's parser already de-duplicates a file row's own, and neither side's
    order carries meaning. */
export function shadowedByFile(
  boardRow: Pick<Playbook, 'fromStatusId' | 'toStatusId' | 'shape' | 'types'>,
  fileRows: Pick<PlaybookFileRowDto, 'fromStatusId' | 'toStatusId' | 'shape' | 'types'>[],
): boolean {
  const sortedBoardTypes = [...boardRow.types].sort();
  return fileRows.some((r) => {
    const sortedFileTypes = [...r.types].sort();
    return (
      r.fromStatusId === boardRow.fromStatusId &&
      r.toStatusId === boardRow.toStatusId &&
      r.shape === boardRow.shape &&
      sortedFileTypes.length === sortedBoardTypes.length &&
      sortedFileTypes.every((t, i) => t === sortedBoardTypes[i])
    );
  });
}

/** Whether the page's project filter keeps this row: every row when cleared, every
    board-wide row regardless, otherwise only a row naming that project. */
export function matchesProjectFilter(p: Pick<Playbook, 'projectKey'>, projectKey: string): boolean {
  return projectKey === '' || p.projectKey === null || p.projectKey === projectKey;
}

/** A check that can edit - the case the epic exists to prevent. */
export function isUncheckedEdit(p: Pick<Playbook, 'isCheck' | 'deniedTools'>): boolean {
  return p.isCheck && p.deniedTools.length === 0;
}
