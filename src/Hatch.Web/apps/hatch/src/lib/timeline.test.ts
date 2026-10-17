import { describe, expect, it } from 'vitest';
import {
  CHART_UNITS,
  DEFAULT_DAYS,
  makeScale,
  resolveWindow,
  tickUnit,
  ticks,
  todayX,
  xOf,
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
