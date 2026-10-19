/* Which card a hovered flow-viz band lights, and in what colour.

   It is a module rather than a helper inside the board for the reason
   lineage.ts and closeSubtree.ts both give in their own headers: getting it
   slightly wrong has no visible symptom - a card lights the wrong colour, or
   a walk that comes back round to where it started hangs the board - and
   there is no DOM in the web test run, so the decisions live in a lib and
   get tested there.

   Given the key of the card whose band is hovered, every card on the board
   and the work queue's rows, returns an entry for every other card: red
   (`dependency`) for what the hovered card waits on, yellow (`turn`) for what
   the queue serves before it, `ancestor` and `descendant` for its family,
   and `dim` for the rest. A null hover, or a hover on a card that has since
   left the board, returns an empty map - the board reloads under a hover, and
   a card that has gone must not dim everything else.

   Cards and rows are walked in full, not only the ones drawn: the type filter
   hides tasks by default and a column's fold hides waiting cards, but a
   hidden card in the middle of a chain still carries the chain on. The order
   of `rows` is the server's and is never re-sorted here. Every walk carries
   a `seen` set, so a `parentKey` or dependency cycle - which the server
   refuses, but a client that loops on one hangs the board - terminates, and
   a walk that returns to the hovered card does not light it. */

import type { IssueCard, QueueEntry } from '../types';

export type Spot = 'dependency' | 'turn' | 'ancestor' | 'descendant' | 'dim';

/**
 * @param hovered The key of the card whose band is hovered, or null.
 * @param cards Every card on the board.
 * @param rows The work queue's answer, in the order the server sent it.
 */
export function spotlight(
  hovered: string | null,
  cards: readonly IssueCard[],
  rows: readonly QueueEntry[],
): Map<string, Spot> {
  const cardByKey = new Map<string, IssueCard>();
  const childrenOf = new Map<string, string[]>();
  for (const card of cards) {
    cardByKey.set(card.key, card);
    if (card.parentKey === null) continue;
    const siblings = childrenOf.get(card.parentKey);
    if (siblings) siblings.push(card.key);
    else childrenOf.set(card.parentKey, [card.key]);
  }

  if (hovered === null || !cardByKey.has(hovered)) return new Map();

  // A card's first row is the one that places it: the queue can hold a second
  // for the same key, and the earlier one is where it is served.
  const rowAt = new Map<string, number>();
  const rowByKey = new Map<string, QueueEntry>();
  rows.forEach((row, index) => {
    if (rowAt.has(row.issue.key)) return;
    rowAt.set(row.issue.key, index);
    rowByKey.set(row.issue.key, row);
  });

  const ancestorsOf = (key: string): string[] => {
    const seen = new Set<string>([key]);
    const found: string[] = [];
    let parent = cardByKey.get(key)?.parentKey ?? null;
    while (parent !== null && !seen.has(parent)) {
      seen.add(parent);
      found.push(parent);
      parent = cardByKey.get(parent)?.parentKey ?? null;
    }
    return found;
  };

  const descendantsOf = (key: string): Set<string> => {
    const seen = new Set<string>([key]);
    const work = [key];
    while (work.length > 0) {
      for (const child of childrenOf.get(work.pop()!) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        work.push(child);
      }
    }
    seen.delete(key);
    return seen;
  };

  // Seeded with the hovered card and its ancestors, since an ancestor's edge
  // holds everything below it. A prerequisite is followed only where the
  // queue holds a row for it - a met one stands in a terminal column, which
  // the queue never reads - and its own ancestors join the worklist so their
  // edges are read in the same pass, without being painted by it.
  const dependencies = (): Set<string> => {
    const red = new Set<string>();
    const queued = new Set<string>([hovered, ...ancestorsOf(hovered)]);
    const work = [...queued];
    while (work.length > 0) {
      for (const prerequisite of rowByKey.get(work.pop()!)?.issue.dependsOnKeys ?? []) {
        if (!rowByKey.has(prerequisite) || red.has(prerequisite)) continue;
        red.add(prerequisite);
        for (const key of [prerequisite, ...ancestorsOf(prerequisite)]) {
          if (queued.has(key)) continue;
          queued.add(key);
          work.push(key);
        }
      }
    }
    red.delete(hovered);
    return red;
  };

  const red = dependencies();
  const ancestors = new Set(ancestorsOf(hovered));
  const descendants = descendantsOf(hovered);
  const hoveredRow = rowAt.get(hovered);

  const spots = new Map<string, Spot>();
  for (const card of cards) {
    if (card.key === hovered) continue;
    const row = rowAt.get(card.key);
    if (red.has(card.key)) spots.set(card.key, 'dependency');
    else if (hoveredRow !== undefined && row !== undefined && row < hoveredRow) spots.set(card.key, 'turn');
    else if (ancestors.has(card.key)) spots.set(card.key, 'ancestor');
    else if (descendants.has(card.key)) spots.set(card.key, 'descendant');
    else spots.set(card.key, 'dim');
  }
  return spots;
}
