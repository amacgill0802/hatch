import type { Timeline } from '../types';

/** Where the hidden timeline rows are persisted - namespaced next to
    `hatch.board.types` (lib/filter.ts). */
export const TIMELINE_HIDDEN_STORAGE_KEY = 'hatch.timeline.hidden';

/** The stored keys, or none - try/catch for the same reason `readBoardTypes`
    does one: localStorage throws in a partitioned or locked-down context, and
    the timeline still has to render. Only strings are kept, de-duplicated, in
    stored order. Always a fresh array. */
export function readHidden(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(TIMELINE_HIDDEN_STORAGE_KEY) ?? 'null');
    if (Array.isArray(stored)) {
      return [...new Set(stored.filter((key): key is string => typeof key === 'string'))];
    }
  } catch {
    /* See above. */
  }
  return [];
}

/** Persists the keys. A store that cannot be written is not worth surfacing:
    the choice holds until the next reload, as the board's types do. */
export function writeHidden(keys: readonly string[]): void {
  try {
    window.localStorage.setItem(TIMELINE_HIDDEN_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* See above. */
  }
}

/** Hides `key`, or shows it again if it is hidden. Returns what storage now
    holds rather than what was asked for, so where storage is broken nothing
    is ever hidden. */
export function toggleHidden(key: string): string[] {
  const hidden = readHidden();
  writeHidden(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  return readHidden();
}

/** The disclosure's list: one per hidden key, in `hidden` order, with the title
    of the top-level epic (or Other) it names, or null when the answer has no
    such row - a hidden epic with nothing active in the range is still hidden. */
export function hiddenEntries(
  timeline: Timeline,
  hidden: readonly string[],
): { key: string; title: string | null }[] {
  const top = timeline.other ? [...timeline.epics, timeline.other] : timeline.epics;
  return hidden.map((key) => ({ key, title: top.find((entry) => entry.issue.key === key)?.issue.title ?? null }));
}
