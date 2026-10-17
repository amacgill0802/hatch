/* The timeline's window, its scale, its tick marks and its today marker, apart
   from the page the way lib/leaderboard.ts and lib/spend.ts are apart from
   theirs: this app has no DOM test setup, so what can be wrong lives in a
   function with a test beside it, and the component is left thin enough to
   read. Nothing here touches React or the DOM.

   One decision is the reason the file exists rather than being helpers inside
   the page: **ticks are boundaries in the reader's offset, not the runtime's.**
   A day tick is the reader's midnight, a week tick their Monday, a month tick
   their 1st - found by shifting the instant by the same `offsetMinutes` the
   rest of the app sends the server, reading it with `getUTC*`, and shifting
   back. Labels are formatted from the shifted date with `timeZone: 'UTC'` for
   the same reason; `dayLabel` formats in the runtime's zone and would name the
   wrong day for anyone whose offset is not the machine's.

   It reads `FROM`, `TO` and `presetRange` from lib/leaderboard.ts and copies
   none of them. */

import { FROM, TO, presetRange } from './leaderboard';

/** Ninety days: a quarter, which is wide enough to see a project's shape and
    narrow enough that the week ticks stay readable. */
export const DEFAULT_DAYS = 90;

/** x is percent of the pane, so the scale is resolution-free and the component
    can place a tick with a `left: x%` or a viewBox of this width. */
export const CHART_UNITS = 100;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/**
 * The window, off the URL.
 *
 * **It never refuses.** A `from` and a `to` both present, both parseable and in
 * order are used, each normalised with `toISOString()`. Anything else - one
 * alone, either unparseable, equal, inverted - falls back to the ninety days
 * ending at the next local midnight strictly after `now`, because half a window
 * is not a window and a pasted link with a typo in it should open the page.
 *
 * @param offsetMinutes Minutes east of UTC, as `presetRange` takes it.
 */
export function resolveWindow(
  params: URLSearchParams,
  now: Date,
  offsetMinutes: number,
): { from: string; to: string } {
  const from = params.get(FROM)?.trim();
  const to = params.get(TO)?.trim();

  if (from && to) {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (start < end) return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
  }

  const end = Date.parse(presetRange('today', now, offsetMinutes).to);

  return { from: new Date(end - DEFAULT_DAYS * DAY_MS).toISOString(), to: new Date(end).toISOString() };
}

/** A window as two epoch-millisecond instants. */
export interface Scale {
  from: number;
  to: number;
}

export const makeScale = (from: string, to: string): Scale => ({
  from: Date.parse(from),
  to: Date.parse(to),
});

/** Where an instant sits on the pane, `0..CHART_UNITS`, clamped: a segment that
    began before the window is drawn from its left edge, and one that has not
    ended (a `to` of null) is the caller's `CHART_UNITS`. */
export function xOf(scale: Scale, instant: string | number): number {
  const t = typeof instant === 'number' ? instant : Date.parse(instant);
  const x = ((t - scale.from) / (scale.to - scale.from)) * CHART_UNITS;

  return Math.min(CHART_UNITS, Math.max(0, x));
}

export type TickUnit = 'day' | 'week' | 'month';

/** How coarse the ticks are: a day each up to a month wide, a week each up to
    half a year, a month each beyond. */
export function tickUnit(scale: Scale): TickUnit {
  const days = (scale.to - scale.from) / DAY_MS;

  if (days <= 31) return 'day';
  if (days <= 183) return 'week';

  return 'month';
}

export interface Tick {
  x: number;
  label: string;
  unit: TickUnit;
}

/** The shifted instants of every boundary of `unit` at or after `start`, up to
    and including `end`. All in shifted time, where `getUTC*` is the reader's
    calendar. */
function boundaries(unit: TickUnit, start: number, end: number): number[] {
  const out: number[] = [];

  if (unit === 'month') {
    const first = new Date(start);
    let at = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
    if (at < start) at = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1);

    while (at <= end) {
      out.push(at);
      const next = new Date(at);
      at = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
    }

    return out;
  }

  let at = Math.ceil(start / DAY_MS) * DAY_MS;
  if (unit === 'week') {
    while (new Date(at).getUTCDay() !== 1) at += DAY_MS;
  }

  const step = unit === 'week' ? 7 * DAY_MS : DAY_MS;
  for (; at <= end; at += step) out.push(at);

  return out;
}

/**
 * The tick marks, each at its `x` with its label.
 *
 * Only boundaries inside `[from, to]` are returned, both ends included. Labels:
 *
 * - `day` - the day number, with the short month on the first tick and on every
 *   1st, so the eye always has a month to hang the numbers on;
 * - `week` - `3 Oct`, since a Monday alone is not a date;
 * - `month` - the short month, with the year on every January and on the first
 *   tick.
 *
 * The optional locale exists so the tests can pin one; the page passes none and
 * gets the reader's.
 */
export function ticks(scale: Scale, offsetMinutes: number, locale?: string): Tick[] {
  if (!(scale.to > scale.from)) return [];

  const unit = tickUnit(scale);
  const shift = offsetMinutes * MINUTE_MS;
  const format = (shifted: number, options: Intl.DateTimeFormatOptions) =>
    new Date(shifted).toLocaleDateString(locale, { ...options, timeZone: 'UTC' });

  return boundaries(unit, scale.from + shift, scale.to + shift).map((shifted, i) => {
    const first = i === 0;
    const date = new Date(shifted);
    let label: string;

    if (unit === 'day') {
      label =
        first || date.getUTCDate() === 1
          ? format(shifted, { day: 'numeric', month: 'short' })
          : format(shifted, { day: 'numeric' });
    } else if (unit === 'week') {
      label = format(shifted, { day: 'numeric', month: 'short' });
    } else {
      label =
        first || date.getUTCMonth() === 0
          ? format(shifted, { month: 'short', year: 'numeric' })
          : format(shifted, { month: 'short' });
    }

    return { x: xOf(scale, shifted - shift), label, unit };
  });
}

/** Where now sits, or null when now is outside the window: `from` inclusive and
    `to` exclusive, so a window ending at the next midnight shows the marker
    right up to it and no marker is drawn on the edge of a finished window. */
export function todayX(scale: Scale, now: Date): number | null {
  const t = now.getTime();

  return t >= scale.from && t < scale.to ? xOf(scale, t) : null;
}
