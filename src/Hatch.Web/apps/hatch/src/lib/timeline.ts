/* The timeline's window, its scale, its tick marks and its today marker, and
   the row fold that turns the answer into drawable rows - with a segment's
   title and colour and the unresolved footnote's sentence - apart
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

   The fold is the same idea as `orderPlan` in lib/plan.ts: the component only
   maps over what `foldRows` returns, and which rows are open is a set of issue
   keys the page keeps in state and `toggled` returns a new copy of.

   It reads `FROM`, `TO`, `RANGE`, `presetRange` and `dayLabel` from lib/leaderboard.ts
   and copies none of them. */

import type { Project, Status, Timeline, TimelineEntry, TimelineSegment } from '../types';
import { statusVars } from './color';
import { FROM, RANGE, TO, dayLabel, presetRange } from './leaderboard';

/** Ninety days: a quarter, which is wide enough to see a project's shape and
    narrow enough that the week ticks stay readable. */
export const DEFAULT_DAYS = 90;

/** x is percent of the pane, so the scale is resolution-free and the component
    can place a tick with a `left: x%` or a viewBox of this width. */
export const CHART_UNITS = 100;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** A window as two ISO instants, the shape the URL and the API both take. Not
    `Window`, which is the DOM global. */
export type TimelineWindow = { from: string; to: string };

export type WindowPreset = '2w' | '1m' | '3m' | '6m' | '1y';

/** The `range` shorthand and the control's choices, narrowest first. This is
    not the leaderboard's 24h..30d vocabulary. 183 is not 182 or 184: it sits
    exactly on the week/month edge of `tickUnit`, so `6m` is the widest window
    still ticked by the week. */
export const WINDOW_PRESETS: { key: WindowPreset; label: string; days: number }[] = [
  { key: '2w', label: '2 weeks', days: 14 },
  { key: '1m', label: '1 month', days: 30 },
  { key: '3m', label: '3 months', days: 90 },
  { key: '6m', label: '6 months', days: 183 },
  { key: '1y', label: '1 year', days: 365 },
];

/** The key if `raw` is one of the presets, else null - not a default, so the
    caller falls back to `DEFAULT_DAYS`. */
export function parsePreset(raw: string | null): WindowPreset | null {
  return WINDOW_PRESETS.find((preset) => preset.key === raw)?.key ?? null;
}

/**
 * The window, off the URL.
 *
 * **It never refuses.** A `from` and a `to` both present, both parseable and in
 * order are used, each normalised with `toISOString()`, and beat `range`.
 * Anything else - one alone, either unparseable, equal, inverted - falls back to
 * the window ending at the next local midnight strictly after `now`, because
 * half a window is not a window and a pasted link with a typo in it should open
 * the page. That window is as wide as `range` says when it names a preset and
 * `DEFAULT_DAYS` otherwise; an unrecognised `range` is ignored like any other
 * typo.
 *
 * @param offsetMinutes Minutes east of UTC, as `presetRange` takes it.
 */
export function resolveWindow(
  params: URLSearchParams,
  now: Date,
  offsetMinutes: number,
): TimelineWindow {
  const from = params.get(FROM)?.trim();
  const to = params.get(TO)?.trim();

  if (from && to) {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (start < end) return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
  }

  const end = Date.parse(presetRange('today', now, offsetMinutes).to);
  const days =
    WINDOW_PRESETS.find((preset) => preset.key === parsePreset(params.get(RANGE)))?.days ?? DEFAULT_DAYS;

  return { from: new Date(end - days * DAY_MS).toISOString(), to: new Date(end).toISOString() };
}

/** The window moved half its own length earlier (-1) or later (+1). Both ends
    move by the same rounded amount, so the length is kept. */
export function shiftWindow(w: TimelineWindow, direction: -1 | 1): TimelineWindow {
  const from = Date.parse(w.from);
  const to = Date.parse(w.to);
  const step = direction * Math.round((to - from) / 2);

  return { from: new Date(from + step).toISOString(), to: new Date(to + step).toISOString() };
}

/** The window `days` long, ending where `w` ends. Millisecond arithmetic only,
    so across a DST seam the wall clock differs by an hour and nothing else. */
export function resizeWindow(w: TimelineWindow, days: number): TimelineWindow {
  const to = Date.parse(w.to);

  return { from: new Date(to - days * DAY_MS).toISOString(), to: w.to };
}

/** The window moved to end at the next local midnight after `now` - what
    `resolveWindow` ends at - with its length kept. */
export function windowEndingToday(w: TimelineWindow, now: Date, offsetMinutes: number): TimelineWindow {
  const end = Date.parse(presetRange('today', now, offsetMinutes).to);
  const length = Date.parse(w.to) - Date.parse(w.from);

  return { from: new Date(end - length).toISOString(), to: new Date(end).toISOString() };
}

/** The preset `w` is as wide as, to the nearest whole day (which absorbs an
    hour lost or gained across a DST seam), or null. */
export function presetOf(w: TimelineWindow): WindowPreset | null {
  const days = Math.round((Date.parse(w.to) - Date.parse(w.from)) / DAY_MS);

  return WINDOW_PRESETS.find((preset) => preset.days === days)?.key ?? null;
}

export const sameWindow = (a: TimelineWindow, b: TimelineWindow): boolean =>
  a.from === b.from && a.to === b.to;

/** A copy of `params` with `from` and `to` set to `w` and `range` removed, since
    an explicit pair beats it anyway. Every other param is kept; the input is
    never mutated. */
export function withWindow(params: URLSearchParams, w: TimelineWindow): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(FROM, w.from);
  next.set(TO, w.to);
  next.delete(RANGE);

  return next;
}

/** The URL names the two filters hold, beside `from`, `to` and `range`. */
export const PROJECT = 'project';
export const CREATOR = 'creator';

/** The project whose `key` the URL names, or null when it names none, is empty
    or absent. A key, never an id: the key is what a person types or pastes, and
    a number in its place is a typo like any other. */
export function resolveProject(params: URLSearchParams, projects: Project[]): Project | null {
  const key = params.get(PROJECT)?.trim();

  return (key && projects.find((p) => p.key === key)) || null;
}

/** The creator the URL names, `''` for anyone. A name is free text, so it is
    kept as typed apart from its edges. */
export const resolveCreator = (params: URLSearchParams): string => params.get(CREATOR)?.trim() ?? '';

/** `creators` in the order given, with `selected` appended last when it is
    non-empty and not among them, so a pasted link naming someone the list does
    not hold still shows who it filters to. Never sorts; the input is never
    mutated. */
export function creatorChoices(creators: string[], selected: string): string[] {
  return selected && !creators.includes(selected) ? [...creators, selected] : [...creators];
}

/** A copy of `params` with the filter `name` set to `value`, or removed when
    `value` is `''`. Every other param is kept; the input is never mutated. */
export function withFilter(
  params: URLSearchParams,
  name: typeof PROJECT | typeof CREATOR,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(name, value);
  else next.delete(name);

  return next;
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

/** The `issue.key` of the synthetic entry the server answers for work under no
    epic. A real key is `HA-12`, so it cannot collide. */
export const OTHER_KEY = 'other';

/** One line of the chart: an entry, how deep it sits, and whether it can open. */
export interface TimelineRow {
  entry: TimelineEntry;
  depth: number;
  /** It has children in the answer to open. Not `isLeaf`: a story whose
      children were all inactive has none here and must not show a toggle. */
  expandable: boolean;
  /** Expandable and in the set, so its children follow it. */
  expanded: boolean;
  isOther: boolean;
}

/**
 * The answer as rows, depth first: each epic in the order answered, then Other
 * when there is one, and an entry's children straight after it - at one more
 * depth, recursively - only when its key is in `expanded`. Everything is
 * collapsed when the set is empty. A row carries its entry untouched, so its
 * `segments` are its own and never a merge of its children's.
 */
export function foldRows(timeline: Timeline, expanded: ReadonlySet<string>): TimelineRow[] {
  const rows: TimelineRow[] = [];

  const visit = (entry: TimelineEntry, depth: number) => {
    const key = entry.issue.key;
    const expandable = entry.children.length > 0;
    const open = expandable && expanded.has(key);

    rows.push({ entry, depth, expandable, expanded: open, isOther: key === OTHER_KEY });
    if (open) for (const child of entry.children) visit(child, depth + 1);
  };

  for (const epic of timeline.epics) visit(epic, 0);
  if (timeline.other) visit(timeline.other, 0);

  return rows;
}

/** The set with `key` added if it was absent, removed if it was there. A new
    set; the one passed in is never touched. */
export function toggled(expanded: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(expanded);
  if (!next.delete(key)) next.add(key);

  return next;
}

/** What a segment says on hover: `In Progress, 3 Oct to 9 Oct`, or `In
    Progress, 3 Oct onward` while it has not ended. Days are in the reader's
    own zone, which is right for a title and not for a tick. */
export function segmentTitle(statusName: string, segment: TimelineSegment, locale?: string): string {
  const from = dayLabel(segment.from, locale);
  const end = segment.to === null ? 'onward' : `to ${dayLabel(segment.to, locale)}`;

  return `${statusName}, ${from} ${end}`;
}

/** The custom properties a segment is painted with - its status's colour, or
    the default grey for a column that is not in `statuses` - and null on the
    Other row, which CSS paints neutrally. */
export function segmentStyle(
  statuses: Status[],
  segment: TimelineSegment,
  isOther: boolean,
): Record<string, string> | null {
  if (isOther) return null;

  return statusVars(statuses.find((status) => status.id === segment.statusId)?.color);
}

/** The footnote for stretches the server could not place, or null when there
    are none. */
export function unresolvedPhrase(count: number): string | null {
  if (count <= 0) return null;

  const what = count === 1 ? '1 column change' : `${count} column changes`;

  return `${what} could not be placed, because the column has since been renamed.`;
}
