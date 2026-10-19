/* Which dependency edges run through a hovered card, upstream and downstream.

   It is a module rather than a helper inside the board for the reason
   lineage.ts and spotlight.ts both give in their own headers: getting it
   slightly wrong has no visible symptom - an arrow points to the wrong card,
   or a walk that comes back round to where it started hangs the board - and
   there is no DOM in the web test run, so the decisions live in a lib and
   get tested there.

   Given the key of the card whose band is hovered, every card on the board
   and the work queue's rows, returns every edge in the chains that run
   through it: upstream for what holds it, downstream for what it holds. An
   edge's `from` is always the prerequisite and `to` is always the card that
   carries the edge in its `dependsOnKeys` - the direction the arrow is drawn
   - which is not the direction either walk runs in. `spotlight` lifts its own
   red set from here rather than walking the upstream half twice.

   Cards and rows are walked in full, not only the ones drawn: the type filter
   hides tasks by default and a column's fold hides waiting cards, but a
   hidden card in the middle of a chain still carries the chain on. Every walk
   carries a `seen` set, so a `parentKey` or dependency cycle - which the
   server refuses, but a client that loops on one hangs the board -
   terminates. */

import type { IssueCard, QueueEntry } from '../types';

export type Flow = 'upstream' | 'downstream';

export interface ChainEdge {
  /** The prerequisite. An arrow runs from here... */
  from: string;
  /** ...to the card that waits on it, which is where the arrowhead goes. */
  to: string;
  flow: Flow;
}

/**
 * @param hovered The key of the card whose band is hovered, or null.
 * @param cards Every card on the board.
 * @param rows The work queue's answer.
 */
export function chains(
  hovered: string | null,
  cards: readonly IssueCard[],
  rows: readonly QueueEntry[],
): ChainEdge[] {
  const cardByKey = new Map<string, IssueCard>();
  const childrenOf = new Map<string, string[]>();
  for (const card of cards) {
    cardByKey.set(card.key, card);
    if (card.parentKey === null) continue;
    const siblings = childrenOf.get(card.parentKey);
    if (siblings) siblings.push(card.key);
    else childrenOf.set(card.parentKey, [card.key]);
  }

  if (hovered === null || !cardByKey.has(hovered)) return [];

  const rowByKey = new Map<string, QueueEntry>();
  for (const row of rows) if (!rowByKey.has(row.issue.key)) rowByKey.set(row.issue.key, row);

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
  // edges are read in the same pass.
  const upstream = (): ChainEdge[] => {
    const edges: ChainEdge[] = [];
    const visited = new Set<string>([hovered, ...ancestorsOf(hovered)]);
    const work = [...visited];
    while (work.length > 0) {
      const holder = work.pop()!;
      for (const prerequisite of rowByKey.get(holder)?.issue.dependsOnKeys ?? []) {
        if (!cardByKey.has(prerequisite) || !rowByKey.has(prerequisite)) continue;
        edges.push({ from: prerequisite, to: holder, flow: 'upstream' });
        if (visited.has(prerequisite)) continue;
        for (const key of [prerequisite, ...ancestorsOf(prerequisite)]) {
          if (visited.has(key)) continue;
          visited.add(key);
          work.push(key);
        }
      }
    }
    return edges;
  };

  // The mirror: seeded with the hovered card alone, since the widening here
  // happens on the found dependent (and its descendants), not on hovered
  // itself - an edge on a dependent holds everything under it.
  const downstream = (): ChainEdge[] => {
    const edges: ChainEdge[] = [];
    const visited = new Set<string>([hovered]);
    const work = [hovered];
    while (work.length > 0) {
      const prerequisite = work.pop()!;
      for (const dependent of rowByKey.get(prerequisite)?.issue.dependentKeys ?? []) {
        if (!cardByKey.has(dependent) || !rowByKey.has(dependent)) continue;
        edges.push({ from: prerequisite, to: dependent, flow: 'downstream' });
        if (visited.has(dependent)) continue;
        for (const key of [dependent, ...descendantsOf(dependent)]) {
          if (visited.has(key)) continue;
          visited.add(key);
          work.push(key);
        }
      }
    }
    return edges;
  };

  // An edge reached both ways is upstream, so a card's own blockers read
  // first - merge upstream in first and let downstream fill only the gaps.
  const merged = new Map<string, ChainEdge>();
  for (const edge of upstream()) merged.set(`${edge.from}->${edge.to}`, edge);
  for (const edge of downstream()) {
    const key = `${edge.from}->${edge.to}`;
    if (!merged.has(key)) merged.set(key, edge);
  }
  return [...merged.values()];
}
