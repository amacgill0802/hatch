import { afterEach, describe, expect, it, vi } from 'vitest';
import { OTHER_KEY } from './timeline';
import {
  TIMELINE_HIDDEN_STORAGE_KEY,
  hiddenEntries,
  readHidden,
  toggleHidden,
  writeHidden,
} from './timelineHidden';
import type { IssueCard, Timeline, TimelineEntry } from '../types';

/** A localStorage that holds what it is given, and can be made to throw - the
    same stub filter.test.ts uses for its storage pair. */
function stubStorage(initial: Record<string, string> = {}, throws = false) {
  const data = { ...initial };
  const storage = {
    getItem: (k: string) => {
      if (throws) throw new Error('blocked');
      return k in data ? data[k] : null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new Error('blocked');
      data[k] = v;
    },
  };
  vi.stubGlobal('window', { localStorage: storage });
  return data;
}

afterEach(() => vi.unstubAllGlobals());

const KEY = 'hatch.timeline.hidden';

describe('readHidden', () => {
  it('is empty when nothing is stored', () => {
    stubStorage();
    expect(readHidden()).toEqual([]);
  });

  it('round trips what was written', () => {
    stubStorage();
    writeHidden(['HA-2', 'HA-1']);
    expect(readHidden()).toEqual(['HA-2', 'HA-1']);
  });

  it('de-duplicates, keeping stored order', () => {
    stubStorage({ [KEY]: JSON.stringify(['HA-2', 'HA-1', 'HA-2']) });
    expect(readHidden()).toEqual(['HA-2', 'HA-1']);
  });

  it('drops members that are not strings', () => {
    stubStorage({ [KEY]: JSON.stringify(['HA-1', 2, null, { key: 'HA-3' }, 'HA-4']) });
    expect(readHidden()).toEqual(['HA-1', 'HA-4']);
  });

  it.each(['epic,task', '{}', '"HA-1"'])('is empty for %s', (junk) => {
    stubStorage({ [KEY]: junk });
    expect(readHidden()).toEqual([]);
  });
});

describe('writeHidden', () => {
  it('stores a JSON array under the namespaced key', () => {
    const data = stubStorage();
    writeHidden(['HA-1', 'HA-2']);
    expect(TIMELINE_HIDDEN_STORAGE_KEY).toBe(KEY);
    expect(data[KEY]).toBe('["HA-1","HA-2"]');
  });
});

describe('toggleHidden', () => {
  it('adds, then removes, returning the stored list each time', () => {
    const data = stubStorage();
    expect(toggleHidden('HA-1')).toEqual(['HA-1']);
    expect(toggleHidden('HA-2')).toEqual(['HA-1', 'HA-2']);
    expect(data[KEY]).toBe('["HA-1","HA-2"]');
    expect(toggleHidden('HA-1')).toEqual(['HA-2']);
    expect(toggleHidden('HA-2')).toEqual([]);
  });
});

describe('broken storage', () => {
  it('reads as empty and swallows writes, so hiding is a no-op', () => {
    stubStorage({}, true);
    expect(readHidden()).toEqual([]);
    expect(() => writeHidden(['HA-1'])).not.toThrow();
    expect(() => toggleHidden('HA-1')).not.toThrow();
    expect(toggleHidden('HA-1')).toEqual([]);
  });
});

const entry = (key: string, title = `title ${key}`, children: TimelineEntry[] = []): TimelineEntry => ({
  issue: { key, title } as IssueCard,
  createdBy: '',
  isLeaf: children.length === 0,
  segments: [],
  children,
});

const timeline = (epics: TimelineEntry[], other: TimelineEntry | null = null): Timeline => ({
  from: '2026-07-12T00:00:00.000Z',
  to: '2026-10-10T00:00:00.000Z',
  epics,
  other,
  creators: [],
  unresolved: 0,
});

describe('hiddenEntries', () => {
  it('titles a hidden epic that is in the answer', () => {
    expect(hiddenEntries(timeline([entry('E-1', 'First')]), ['E-1'])).toEqual([{ key: 'E-1', title: 'First' }]);
  });

  it('titles Other when the answer has it', () => {
    const t = timeline([entry('E-1')], entry(OTHER_KEY, 'Other'));
    expect(hiddenEntries(t, [OTHER_KEY])).toEqual([{ key: OTHER_KEY, title: 'Other' }]);
  });

  it('has a null title for a key not in the answer', () => {
    expect(hiddenEntries(timeline([entry('E-1')]), ['E-9', OTHER_KEY])).toEqual([
      { key: 'E-9', title: null },
      { key: OTHER_KEY, title: null },
    ]);
  });

  it('matches the top level only', () => {
    const t = timeline([entry('E-1', 'First', [entry('S-1', 'Nested')])]);
    expect(hiddenEntries(t, ['S-1'])).toEqual([{ key: 'S-1', title: null }]);
  });

  it('follows the order of hidden', () => {
    const t = timeline([entry('E-1'), entry('E-2')]);
    expect(hiddenEntries(t, ['E-2', 'E-1']).map((h) => h.key)).toEqual(['E-2', 'E-1']);
  });
});
