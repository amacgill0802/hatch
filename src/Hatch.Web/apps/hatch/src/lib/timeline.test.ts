import { describe, expect, it } from 'vitest';
import type { IssueCard, Project, Status, Timeline, TimelineEntry, TimelineSegment } from '../types';
import { DEFAULT_STATUS_COLOR } from './color';
import {
  CHART_UNITS,
  CREATOR,
  DEFAULT_DAYS,
  OTHER_KEY,
  PROJECT,
  WINDOW_PRESETS,
  creatorChoices,
  foldRows,
  makeScale,
  parsePreset,
  presetOf,
  resizeWindow,
  resolveCreator,
  resolveProject,
  resolveWindow,
  segmentStyle,
  segmentTitle,
  tickUnit,
  sameWindow,
  shiftWindow,
  ticks,
  todayX,
  toggled,
  unresolvedPhrase,
  windowEndingToday,
  withFilter,
  withWindow,
  xOf,
  type TimelineWindow,
} from './timeline';

const NOW = new Date('2026-10-09T12:00:00Z');
const DAY_MS = 86_400_000;
const LOCALE = 'en-GB';

const params = (query: string) => new URLSearchParams(query);

/** The ninety days ending at `to`, the default window's `from`. */
const ninetyBefore = (to: string) => new Date(Date.parse(to) - DEFAULT_DAYS * DAY_MS).toISOString();

/** A scale `days` wide, from a fixed start. */
const days = (n: number) => {
  const from = '2026-10-01T00:00:00.000Z';

  return makeScale(from, new Date(Date.parse(from) + n * DAY_MS).toISOString());
};

describe('resolveWindow', () => {
  it('defaults to ninety days ending at the next midnight at offset 0', () => {
    const window = resolveWindow(params(''), NOW, 0);

    expect(window.to).toBe('2026-10-10T00:00:00.000Z');
    expect(window.from).toBe(ninetyBefore(window.to));
    expect(window.from).toBe('2026-07-12T00:00:00.000Z');
  });

  it("ends at the reader's midnight, not the runtime's, at offset 600", () => {
    const window = resolveWindow(params(''), NOW, 600);

    expect(window.to).toBe('2026-10-09T14:00:00.000Z');
    expect(window.from).toBe(ninetyBefore(window.to));
  });

  it('puts `to` strictly after now when now is exactly a midnight', () => {
    expect(resolveWindow(params(''), new Date('2026-10-10T00:00:00Z'), 0).to).toBe(
      '2026-10-11T00:00:00.000Z',
    );
    expect(resolveWindow(params(''), new Date('2026-10-09T14:00:00Z'), 600).to).toBe(
      '2026-10-10T14:00:00.000Z',
    );
  });

  it('uses an explicit pair, normalised', () => {
    expect(resolveWindow(params('from=2026-10-01&to=2026-10-20T06:30:00%2B02:00'), NOW, 600)).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-20T04:30:00.000Z',
    });
  });

  const fallback = resolveWindow(params(''), NOW, 0);

  it.each([
    ['from alone', 'from=2026-10-01'],
    ['to alone', 'to=2026-10-20'],
    ['a blank value', 'from=2026-10-01&to=%20'],
    ['an unparseable from', 'from=yesterday&to=2026-10-20'],
    ['an unparseable to', 'from=2026-10-01&to=soon'],
    ['an inverted pair', 'from=2026-10-20&to=2026-10-01'],
    ['an equal pair', 'from=2026-10-01&to=2026-10-01T00:00:00Z'],
  ])('falls back to the default for %s', (_, query) => {
    expect(resolveWindow(params(query), NOW, 0)).toEqual(fallback);
  });
  it.each([
    ['1y', 365],
    ['2w', 14],
  ])('ends at the next midnight and reaches back the preset for range=%s', (key, count) => {
    const window = resolveWindow(params(`range=${key}`), NOW, 0);

    expect(window.to).toBe('2026-10-10T00:00:00.000Z');
    expect(window.from).toBe(new Date(Date.parse(window.to) - count * DAY_MS).toISOString());
  });

  it("ends a range at the reader's midnight at offset 600", () => {
    expect(resolveWindow(params('range=1y'), NOW, 600).to).toBe('2026-10-09T14:00:00.000Z');
  });

  it.each([['range=bogus'], ['range=']])('ignores %s', (query) => {
    expect(resolveWindow(params(query), NOW, 0)).toEqual(fallback);
  });

  it('lets a valid pair beat range', () => {
    expect(resolveWindow(params('range=1y&from=2026-10-01&to=2026-10-20'), NOW, 0)).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-20T00:00:00.000Z',
    });
  });

  it('uses range when the pair is only half there', () => {
    const window = resolveWindow(params('range=1y&from=2026-10-01'), NOW, 0);

    expect(window.from).toBe(new Date(Date.parse(window.to) - 365 * DAY_MS).toISOString());
  });
});

describe('xOf', () => {
  const scale = makeScale('2026-10-01T00:00:00.000Z', '2026-10-11T00:00:00.000Z');

  it('runs from 0 at from to the full width at to', () => {
    expect(xOf(scale, '2026-10-01T00:00:00.000Z')).toBe(0);
    expect(xOf(scale, '2026-10-11T00:00:00.000Z')).toBe(CHART_UNITS);
    expect(CHART_UNITS).toBe(100);
  });

  it('puts the midpoint at 50', () => {
    expect(xOf(scale, '2026-10-06T00:00:00.000Z')).toBe(50);
  });

  it('clamps before from and after to', () => {
    expect(xOf(scale, '2026-09-01T00:00:00.000Z')).toBe(0);
    expect(xOf(scale, '2026-12-01T00:00:00.000Z')).toBe(100);
  });

  it('takes epoch milliseconds as well as an ISO string', () => {
    expect(xOf(scale, scale.from + 2.5 * DAY_MS)).toBe(25);
  });
});

describe('tickUnit', () => {
  it.each([
    [7, 'day'],
    [31, 'day'],
    [32, 'week'],
    [183, 'week'],
    [184, 'month'],
  ] as const)('is %i days -> %s', (n, unit) => {
    expect(tickUnit(days(n))).toBe(unit);
  });
});

describe('ticks', () => {
  const at = (iso: string) => Date.parse(iso);

  describe('by day', () => {
    const scale = makeScale('2026-10-28T00:00:00.000Z', '2026-11-07T00:00:00.000Z');

    it('has one tick per midnight, ends included, with the month on the first and on the 1st', () => {
      const result = ticks(scale, 0, LOCALE);

      expect(result.map((t) => t.label)).toEqual([
        '28 Oct',
        '29',
        '30',
        '31',
        '1 Nov',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
      ]);
      expect(result.map((t) => t.x)).toEqual(Array.from({ length: 11 }, (_, i) => i * 10));
      expect(result.every((t) => t.unit === 'day')).toBe(true);
    });

    it("lands on the reader's midnights at offset 600", () => {
      const result = ticks(scale, 600, LOCALE);

      // The first local midnight after 10:00 local on the 28th is the 29th, 14 h in.
      expect(result[0]).toEqual({ x: (14 / 240) * 100, label: '29 Oct', unit: 'day' });
      expect(result.map((t) => t.label)).toEqual([
        '29 Oct',
        '30',
        '31',
        '1 Nov',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
      ]);
      expect(result[1].x - result[0].x).toBeCloseTo(10, 10);
    });
  });

  describe('by week', () => {
    it('has a tick on each Monday, labelled with its date', () => {
      const scale = makeScale('2026-10-01T00:00:00.000Z', '2026-12-24T00:00:00.000Z');
      const result = ticks(scale, 0, LOCALE);

      expect(result.map((t) => t.label)).toEqual([
        '5 Oct',
        '12 Oct',
        '19 Oct',
        '26 Oct',
        '2 Nov',
        '9 Nov',
        '16 Nov',
        '23 Nov',
        '30 Nov',
        '7 Dec',
        '14 Dec',
        '21 Dec',
      ]);
      expect(result[0].x).toBeCloseTo((4 / 84) * 100, 10);
      expect(result.every((t) => t.unit === 'week')).toBe(true);
    });

    it('includes a boundary exactly at from and at to, in the reader\'s offset', () => {
      // Local Monday 5 Oct 00:00 and local Monday 28 Dec 00:00, at +10:00.
      const scale = makeScale('2026-10-04T14:00:00.000Z', '2026-12-27T14:00:00.000Z');
      const result = ticks(scale, 600, LOCALE);

      expect(result).toHaveLength(13);
      expect(result[0]).toEqual({ x: 0, label: '5 Oct', unit: 'week' });
      expect(result[12]).toEqual({ x: 100, label: '28 Dec', unit: 'week' });
    });
  });

  describe('by month', () => {
    const scale = makeScale('2026-11-15T00:00:00.000Z', '2028-01-15T00:00:00.000Z');

    it('has a tick on each 1st, with the year on the first and on every January', () => {
      const result = ticks(scale, 0, LOCALE);

      expect(result).toHaveLength(14);
      expect(result[0].label).toBe('Dec 2026');
      expect(result[1].label).toBe('Jan 2027');
      expect(result[2].label).toBe('Feb');
      expect(result[13].label).toBe('Jan 2028');
      // Every other month is bare letters, whichever way the locale spells September.
      expect(result.slice(2, 13).every((t) => /^\D+$/.test(t.label))).toBe(true);
      expect(result.every((t) => t.unit === 'month')).toBe(true);
    });

    it('places each tick at its 1st', () => {
      const result = ticks(scale, 0, LOCALE);

      expect(result[0].x).toBeCloseTo(((at('2026-12-01T00:00:00Z') - scale.from) / (scale.to - scale.from)) * 100, 10);
      expect(result[1].x).toBeCloseTo(((at('2027-01-01T00:00:00Z') - scale.from) / (scale.to - scale.from)) * 100, 10);
    });

    it("lands on the reader's 1st at offset 600", () => {
      const wide = makeScale('2026-11-15T00:00:00.000Z', '2027-06-01T00:00:00.000Z');
      const result = ticks(wide, 600, LOCALE);

      // 1 Dec 00:00 at +10:00 is 30 Nov 14:00 UTC.
      expect(result[0].label).toBe('Dec 2026');
      expect(result[0].x).toBeCloseTo(((at('2026-11-30T14:00:00Z') - wide.from) / (wide.to - wide.from)) * 100, 10);
      expect(result.map((t) => t.label).slice(0, 3)).toEqual(['Dec 2026', 'Jan 2027', 'Feb']);
    });
  });

  it('returns nothing for an empty window', () => {
    expect(ticks({ from: 5, to: 5 }, 0, LOCALE)).toEqual([]);
  });
});

describe('todayX', () => {
  const scale = makeScale('2026-10-01T00:00:00.000Z', '2026-10-11T00:00:00.000Z');

  it('is where now sits inside the window', () => {
    expect(todayX(scale, new Date('2026-10-06T00:00:00Z'))).toBe(50);
  });

  it('is 0 at from', () => {
    expect(todayX(scale, new Date('2026-10-01T00:00:00Z'))).toBe(0);
  });

  it('is null at to, and outside the window', () => {
    expect(todayX(scale, new Date('2026-10-11T00:00:00Z'))).toBeNull();
    expect(todayX(scale, new Date('2026-09-30T23:59:59Z'))).toBeNull();
    expect(todayX(scale, new Date('2026-12-01T00:00:00Z'))).toBeNull();
  });
});

const entry = (
  key: string,
  children: TimelineEntry[] = [],
  extra: Partial<TimelineEntry> = {},
): TimelineEntry => ({
  issue: { key, title: `title ${key}` } as IssueCard,
  createdBy: 'someone',
  isLeaf: children.length === 0,
  segments: [],
  children,
  ...extra,
});

const timeline = (epics: TimelineEntry[], other: TimelineEntry | null = null): Timeline => ({
  from: '2026-07-12T00:00:00.000Z',
  to: '2026-10-10T00:00:00.000Z',
  epics,
  other,
  creators: [],
  unresolved: 0,
});

const keys = (rows: { entry: TimelineEntry }[]) => rows.map((row) => row.entry.issue.key);

const segment = (statusId: number, from: string, to: string | null): TimelineSegment => ({ statusId, from, to });

describe('foldRows', () => {
  const tree = timeline(
    [entry('E-2', [entry('S-1', [entry('T-1')]), entry('S-2')]), entry('E-1')],
    entry(OTHER_KEY, [entry('L-1')]),
  );

  it('keeps the epics in the order answered and puts Other last', () => {
    expect(keys(foldRows(tree, new Set()))).toEqual(['E-2', 'E-1', OTHER_KEY]);
  });

  it('draws no Other row when other is null', () => {
    const rows = foldRows(timeline([entry('E-1')]), new Set());

    expect(keys(rows)).toEqual(['E-1']);
    expect(rows.some((row) => row.isOther)).toBe(false);
  });

  it('shows top-level rows only when everything is collapsed', () => {
    const rows = foldRows(tree, new Set());

    expect(rows.map((row) => row.depth)).toEqual([0, 0, 0]);
    expect(rows.map((row) => row.expanded)).toEqual([false, false, false]);
  });

  it('reveals an expanded epic\'s children at depth 1, and a grandchild only when its parent is open too', () => {
    const one = foldRows(tree, new Set(['E-2']));

    expect(keys(one)).toEqual(['E-2', 'S-1', 'S-2', 'E-1', OTHER_KEY]);
    expect(one.map((row) => row.depth)).toEqual([0, 1, 1, 0, 0]);

    const two = foldRows(tree, new Set(['E-2', 'S-1']));

    expect(keys(two)).toEqual(['E-2', 'S-1', 'T-1', 'S-2', 'E-1', OTHER_KEY]);
    expect(two.map((row) => row.depth)).toEqual([0, 1, 2, 1, 0, 0]);
  });

  it('does not reveal a grandchild when only the child is in the set', () => {
    expect(keys(foldRows(tree, new Set(['S-1'])))).toEqual(['E-2', 'E-1', OTHER_KEY]);
  });

  it('reveals the loose roots when other is expanded, and marks the row', () => {
    const rows = foldRows(tree, new Set([OTHER_KEY]));

    expect(keys(rows)).toEqual(['E-2', 'E-1', OTHER_KEY, 'L-1']);
    expect(rows.map((row) => row.isOther)).toEqual([false, false, true, false]);
    expect(rows[3].depth).toBe(1);
  });

  it('is expandable by children present, not by isLeaf', () => {
    const quiet = entry('S-9', [], { isLeaf: false });
    const rows = foldRows(timeline([entry('E-1', [quiet])]), new Set(['E-1', 'S-9']));

    expect(rows[1].expandable).toBe(false);
    expect(rows[1].expanded).toBe(false);
    expect(rows[0].expandable).toBe(true);
    expect(rows[0].expanded).toBe(true);
  });

  it('carries each entry untouched, so a parent keeps only its own segments', () => {
    const own = [segment(1, '2026-10-01T12:00:00Z', '2026-10-02T12:00:00Z')];
    const child = entry('S-1', [], { segments: [segment(2, '2026-10-03T12:00:00Z', null)] });
    const epic = entry('E-1', [child], { segments: own });
    const rows = foldRows(timeline([epic]), new Set(['E-1']));

    expect(rows[0].entry).toBe(epic);
    expect(rows[0].entry.segments).toEqual(own);
    expect(rows[1].entry).toBe(child);
  });

  it('leaves a hidden epic out', () => {
    expect(keys(foldRows(tree, new Set(), new Set(['E-2'])))).toEqual(['E-1', OTHER_KEY]);
  });

  it('leaves a hidden Other out', () => {
    expect(keys(foldRows(tree, new Set(), new Set([OTHER_KEY])))).toEqual(['E-2', 'E-1']);
  });

  it('leaves a hidden epic\'s expanded children out with it', () => {
    const open = new Set(['E-2', 'S-1', OTHER_KEY]);

    expect(keys(foldRows(tree, open, new Set(['E-2'])))).toEqual(['E-1', OTHER_KEY, 'L-1']);
  });

  it('changes nothing for a hidden key that names no top-level entry', () => {
    const open = new Set(['E-2']);

    expect(foldRows(tree, open, new Set(['nope', 'S-2']))).toEqual(foldRows(tree, open));
  });

  it('never touches the answer it folds', () => {
    const before = structuredClone(tree);

    foldRows(tree, new Set(['E-2', OTHER_KEY]), new Set(['E-2', OTHER_KEY]));

    expect(tree).toEqual(before);
  });

  it('hides nothing by default', () => {
    expect(foldRows(tree, new Set(['E-2']))).toEqual(foldRows(tree, new Set(['E-2']), new Set()));
  });
});

describe('toggled', () => {
  it('adds a key that is absent', () => {
    expect([...toggled(new Set(['a']), 'b')].sort()).toEqual(['a', 'b']);
  });

  it('removes a key that is present', () => {
    expect([...toggled(new Set(['a', 'b']), 'a')]).toEqual(['b']);
  });

  it('leaves the input unchanged and returns a new set', () => {
    const before = new Set(['a']);
    const added = toggled(before, 'b');
    const removed = toggled(before, 'a');

    expect([...before]).toEqual(['a']);
    expect(added).not.toBe(before);
    expect(removed).not.toBe(before);
  });
});

describe('segmentTitle', () => {
  it('names a closed segment from and to', () => {
    const closed = segment(1, '2026-10-03T12:00:00Z', '2026-10-09T12:00:00Z');

    expect(segmentTitle('In Progress', closed, LOCALE)).toBe('In Progress, 3 Oct to 9 Oct');
  });

  it('says onward while the segment is open', () => {
    const open = segment(1, '2026-10-03T12:00:00Z', null);

    expect(segmentTitle('In Progress', open, LOCALE)).toBe('In Progress, 3 Oct onward');
  });
});

describe('segmentStyle', () => {
  const statuses = [{ id: 4, name: 'In Progress', color: '#2563eb' }] as Status[];
  const at = (statusId: number) => segment(statusId, '2026-10-03T12:00:00Z', null);

  it("gives a known status's colour and ink", () => {
    const style = segmentStyle(statuses, at(4), false);

    expect(style?.['--status-color']).toBe('#2563eb');
    expect(style?.['--status-ink']).toBeTruthy();
  });

  it('falls back to the default grey for an unknown id', () => {
    expect(segmentStyle(statuses, at(99), false)?.['--status-color']).toBe(DEFAULT_STATUS_COLOR);
  });

  it('is null on Other, whatever the status', () => {
    expect(segmentStyle(statuses, at(4), true)).toBeNull();
  });
});

describe('unresolvedPhrase', () => {
  it('is null at zero', () => {
    expect(unresolvedPhrase(0)).toBeNull();
  });

  it('is singular at one', () => {
    expect(unresolvedPhrase(1)).toBe('1 column change could not be placed, because the column has since been renamed.');
  });

  it('is plural above one', () => {
    expect(unresolvedPhrase(2)).toBe('2 column changes could not be placed, because the column has since been renamed.');
  });
});

/** A window `count` days long ending at `to`. */
const ending = (to: string, count: number) => ({
  from: new Date(Date.parse(to) - count * DAY_MS).toISOString(),
  to,
});

const D = '2026-10-10T00:00:00.000Z';
const before = (count: number, from = D) => new Date(Date.parse(from) - count * DAY_MS).toISOString();

describe('WINDOW_PRESETS', () => {
  it('has the default as its quarter', () => {
    expect(WINDOW_PRESETS.find((preset) => preset.key === '3m')?.days).toBe(DEFAULT_DAYS);
  });

  it('is ticked by day, day, week, week, month', () => {
    expect(WINDOW_PRESETS.map((preset) => tickUnit(days(preset.days)))).toEqual([
      'day',
      'day',
      'week',
      'week',
      'month',
    ]);
  });
});

describe('parsePreset', () => {
  it.each(['2w', '1m', '3m', '6m', '1y'])('reads %s', (key) => {
    expect(parsePreset(key)).toBe(key);
  });

  it.each([['3M'], [''], [null], ['24h']])('reads %j as null', (raw) => {
    expect(parsePreset(raw)).toBeNull();
  });
});

describe('shiftWindow', () => {
  const w = ending(D, 90);

  it('moves half the length earlier', () => {
    const shifted = shiftWindow(w, -1);

    expect(shifted.to).toBe('2026-08-26T00:00:00.000Z');
    expect(Date.parse(shifted.to) - Date.parse(shifted.from)).toBe(90 * DAY_MS);
  });

  it('moves half the length later', () => {
    expect(shiftWindow(w, 1).to).toBe('2026-11-24T00:00:00.000Z');
  });

  it('is undone by the opposite shift', () => {
    expect(shiftWindow(shiftWindow(w, -1), 1)).toEqual(w);
  });

  it('moves a fortnight by a week', () => {
    expect(shiftWindow(ending(D, 14), -1).to).toBe(before(7));
  });
});

describe('resizeWindow', () => {
  const w = ending(D, 90);

  it('widens backwards from a fixed end', () => {
    expect(resizeWindow(w, 183)).toEqual({ from: before(183), to: D });
  });

  it('narrows backwards from a fixed end', () => {
    expect(resizeWindow(w, 14)).toEqual({ from: before(14), to: D });
  });

  it('is a no-op at the current length', () => {
    expect(resizeWindow(w, 90)).toEqual(w);
  });
});

describe('windowEndingToday', () => {
  const old = ending(before(30), 90);

  it('ends at the next midnight and keeps the length at offset 0', () => {
    const moved = windowEndingToday(old, NOW, 0);

    expect(moved.to).toBe(D);
    expect(Date.parse(moved.to) - Date.parse(moved.from)).toBe(90 * DAY_MS);
  });

  it("ends at the reader's midnight at offset 600", () => {
    expect(windowEndingToday(old, NOW, 600).to).toBe('2026-10-09T14:00:00.000Z');
  });

  it('changes nothing for a window already ending there', () => {
    const w = ending(D, 90);

    expect(sameWindow(windowEndingToday(w, NOW, 0), w)).toBe(true);
  });

  it('gives the midnight after when now is exactly a midnight', () => {
    expect(windowEndingToday(old, new Date(D), 0).to).toBe('2026-10-11T00:00:00.000Z');
  });
});

describe('presetOf', () => {
  it.each(WINDOW_PRESETS)('names the $key window', ({ key, days: count }) => {
    expect(presetOf(ending(D, count))).toBe(key);
  });

  it('absorbs an hour lost to DST', () => {
    const w = ending(D, 90);

    expect(presetOf({ from: new Date(Date.parse(w.from) + 3_600_000).toISOString(), to: w.to })).toBe('3m');
  });

  it('is null for a width that is no preset', () => {
    expect(presetOf(ending(D, 45))).toBeNull();
  });
});

describe('sameWindow', () => {
  it('compares both ends', () => {
    expect(sameWindow(ending(D, 90), ending(D, 90))).toBe(true);
    expect(sameWindow(ending(D, 90), ending(D, 30))).toBe(false);
    expect(sameWindow(ending(D, 90), ending(before(1), 90))).toBe(false);
  });
});

describe('withWindow', () => {
  const w = ending(D, 30);

  it('sets both ends, drops range and keeps the rest', () => {
    const next = withWindow(params('range=1y&project=3'), w);

    expect(next.get('from')).toBe(w.from);
    expect(next.get('to')).toBe(w.to);
    expect(next.has('range')).toBe(false);
    expect(next.get('project')).toBe('3');
  });

  it('does not mutate its input', () => {
    const input = params('range=1y&project=3');
    withWindow(input, w);

    expect(input.toString()).toBe('range=1y&project=3');
  });
});

describe('resolveProject', () => {
  const projects = [
    { id: 1, key: 'HA' },
    { id: 2, key: 'AER' },
  ] as Project[];

  it('finds the project by key', () => {
    expect(resolveProject(params('project=AER'), projects)).toBe(projects[1]);
  });

  it('trims the key', () => {
    expect(resolveProject(params('project=%20HA%20'), projects)).toBe(projects[0]);
  });

  it('is null when absent or empty', () => {
    expect(resolveProject(params(''), projects)).toBeNull();
    expect(resolveProject(params('project='), projects)).toBeNull();
    expect(resolveProject(params('project=%20'), projects)).toBeNull();
  });

  it('is null for a key naming no project', () => {
    expect(resolveProject(params('project=ZZ'), projects)).toBeNull();
  });

  it('never reads an id as a key', () => {
    expect(resolveProject(params('project=1'), projects)).toBeNull();
  });
});

describe('resolveCreator', () => {
  it('is empty, meaning anyone, when absent', () => {
    expect(resolveCreator(params(''))).toBe('');
  });

  it('reads a name with a space in it', () => {
    expect(resolveCreator(params('creator=Ada%20Lovelace'))).toBe('Ada Lovelace');
  });

  it('is empty for whitespace alone', () => {
    expect(resolveCreator(params('creator=%20%20'))).toBe('');
  });
});

describe('creatorChoices', () => {
  const creators = ['Zed', 'Ada', 'Mo'];

  it('is unchanged for no selection or one already present', () => {
    expect(creatorChoices(creators, '')).toEqual(creators);
    expect(creatorChoices(creators, 'Ada')).toEqual(creators);
  });

  it('appends an absent name last', () => {
    expect(creatorChoices(creators, 'Grace')).toEqual(['Zed', 'Ada', 'Mo', 'Grace']);
  });

  it('keeps the order given', () => {
    expect(creatorChoices(['b', 'a'], 'c')).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate its input', () => {
    const input = ['Zed', 'Ada'];
    creatorChoices(input, 'Grace');

    expect(input).toEqual(['Zed', 'Ada']);
  });
});

describe('withFilter', () => {
  it('sets a filter', () => {
    expect(withFilter(params(''), PROJECT, 'HA').get('project')).toBe('HA');
  });

  it('replaces a filter', () => {
    expect(withFilter(params('creator=Ada'), CREATOR, 'Mo').getAll('creator')).toEqual(['Mo']);
  });

  it('deletes a filter for an empty value', () => {
    expect(withFilter(params('project=HA'), PROJECT, '').has('project')).toBe(false);
  });

  it('keeps the window and the other filter', () => {
    const next = withFilter(params('from=a&to=b&creator=Ada'), PROJECT, 'HA');

    expect(next.get('from')).toBe('a');
    expect(next.get('to')).toBe('b');
    expect(next.get('creator')).toBe('Ada');
  });

  it('does not mutate its input', () => {
    const input = params('project=HA');
    withFilter(input, PROJECT, '');
    withFilter(input, CREATOR, 'Ada');

    expect(input.toString()).toBe('project=HA');
  });
});

describe('as the page composes it', () => {
  /** What `move` chains: resolve the URL, step, write, and read the written URL back. */
  const roundTrip = (startQuery: string, step: (w: TimelineWindow) => TimelineWindow) => {
    const start = params(startQuery);
    const next = step(resolveWindow(start, NOW, 0));
    const written = withWindow(start, next);

    return { next, written, read: resolveWindow(params(written.toString()), NOW, 0) };
  };

  it.each([
    ['from the default', ''],
    ['from range=1y', 'range=1y'],
  ])('Earlier %s reads back as the window it wrote', (_, query) => {
    const { next, written, read } = roundTrip(query, (w) => shiftWindow(w, -1));

    expect(read).toEqual(next);
    expect(written.has('from') && written.has('to')).toBe(true);
    expect(written.has('range')).toBe(false);
  });

  it.each([
    ['from the default', ''],
    ['from range=1y', 'range=1y'],
  ])('a resize to 6m %s reads back as the window it wrote', (_, query) => {
    const days = WINDOW_PRESETS.find((preset) => preset.key === '6m')!.days;
    const { next, written, read } = roundTrip(query, (w) => resizeWindow(w, days));

    expect(read).toEqual(next);
    expect(presetOf(read)).toBe('6m');
    expect(written.has('range')).toBe(false);
  });

  it('Today on the default window is the window already showing, so nothing is written', () => {
    const shown = resolveWindow(params(''), NOW, 0);

    expect(sameWindow(windowEndingToday(shown, NOW, 0), shown)).toBe(true);
  });

  it('writing the window after the filters keeps both filters', () => {
    const filtered = withFilter(withFilter(params('range=1y'), PROJECT, 'HA'), CREATOR, 'Ada Lovelace');
    const written = withWindow(filtered, ending(D, 30));

    expect(written.get('project')).toBe('HA');
    expect(written.get('creator')).toBe('Ada Lovelace');
    expect(written.has('range')).toBe(false);
  });

  it('reads range=1y alone as the year ending at the next midnight', () => {
    expect(resolveWindow(params('range=1y'), NOW, 0)).toEqual(ending(D, 365));
  });

  it('reads from and to as exactly themselves, over range', () => {
    const w = ending('2026-08-01T00:00:00.000Z', 30);

    expect(resolveWindow(params(`range=1y&from=${w.from}&to=${w.to}`), NOW, 0)).toEqual(w);
  });

  it('reads neither as the default', () => {
    expect(resolveWindow(params(''), NOW, 0)).toEqual(ending(D, DEFAULT_DAYS));
  });
});
