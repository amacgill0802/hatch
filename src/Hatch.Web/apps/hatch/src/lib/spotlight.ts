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

import { chains } from './chains';
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
  rows.forEach((row, index) => {
    if (!rowAt.has(row.issue.key)) rowAt.set(row.issue.key, index);
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

  const red = new Set(chains(hovered, cards, rows).filter((edge) => edge.flow === 'upstream').map((edge) => edge.from));
  red.delete(hovered);
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
