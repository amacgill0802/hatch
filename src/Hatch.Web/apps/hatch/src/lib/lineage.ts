/* A column's cards, regrouped so that cards sharing an ancestor sit together.

   It is a module rather than a helper inside BoardPage for the reason
   place.ts and closeSubtree.ts both give in their own headers: getting it
   slightly wrong has no visible symptom - the column simply reads a little
   surprising - and there is no DOM in the web test run, so the decisions
   live in a lib and get tested there.

   Given every card on the board and the cards one column is drawing, returns
   that column's cards regrouped, each with the depth it should be drawn at.
   Ancestry is walked off every card, not off the column's own - a parent
   usually sits in a different column, and the type filter hides tasks by
   default - while only the column's own visible cards come back. A group's
   own position comes from the order it was handed: the server orders the
   board by (status, effective priority desc, rank, id) and sorting here would
   be a second opinion about where a card sits, so this groups rather than
   sorts - a group sits where its first-served member sat, and within a group
   the served order is kept. Depth is relative to the group, not the tree: a
   missing generation, off-column or filtered out, costs no depth. Every card
   still appears exactly once, and a `parentKey` cycle - which the server
   refuses, but a client that loops on one hangs the board - terminates. */

import type { IssueCard } from '../types';

export interface LineageCard extends IssueCard {
  /** Ancestors in this card's group drawn above it in the column - 0 for the
      group's own first card. Relative to the group, not the tree: a missing
      generation (off-column, or filtered out) costs no depth. */
  depth: number;
}

/**
 * @param all Every card on the board, ancestry walked over this.
 * @param column The cards one column is drawing - what comes back, regrouped.
 */
export function lineage(all: IssueCard[], column: IssueCard[]): LineageCard[] {
  // Union-find over every parentKey edge in `all`, not a per-card upward walk.
  // A plain "walk to the top, use whatever you land on as the group id" breaks
  // on a cycle: walking from A and from B in an A<->B cycle lands on different
  // nodes, so the two ends of the same cycle disagree about their own group.
  // Merging is always root-to-root, so both ends of a cycle resolve to one.
  const uplink = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (uplink.has(root)) root = uplink.get(root)!;
    return root;
  };
  for (const card of all) {
    if (card.parentKey === null) continue;
    const a = find(card.key);
    const b = find(card.parentKey);
    if (a !== b) uplink.set(a, b);
  }

  const byKey = new Map(all.map((card) => [card.key, card]));
  const inColumn = new Set(column.map((card) => card.key));

  // A separate, per-card walk up the real parentKey chain - not `uplink`,
  // which only tells group membership - counting only the ancestors on that
  // chain that are themselves in `column`. A `seen` set stops the loop on a
  // cycle the same way closeSubtree's does.
  const depthOf = (key: string): number => {
    const seen = new Set<string>([key]);
    let depth = 0;
    let current = byKey.get(key) ?? null;
    while (current?.parentKey && !seen.has(current.parentKey)) {
      seen.add(current.parentKey);
      if (inColumn.has(current.parentKey)) depth++;
      current = byKey.get(current.parentKey) ?? null;
    }
    return depth;
  };

  // Stable grouping by first occurrence in `column`, never a sort: a group
  // sits where its earliest-served member sat, and within it the served
  // order is kept - which is what keeps a priority-floated child from
  // reordering its family.
  const order: string[] = [];
  const groups = new Map<string, IssueCard[]>();
  for (const card of column) {
    const root = find(card.key);
    const group = groups.get(root);
    if (group) group.push(card);
    else {
      groups.set(root, [card]);
      order.push(root);
    }
  }

  return order.flatMap((root) => groups.get(root)!.map((card) => ({ ...card, depth: depthOf(card.key) })));
}
