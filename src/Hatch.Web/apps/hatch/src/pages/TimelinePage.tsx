import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, PageHeader } from '@hatch/ui';
import { getStatuses, getTimeline } from '../api/client';
import { TimelineChart } from '../components/TimelineChart';
import { makeScale, resolveWindow, toggled, unresolvedPhrase } from '../lib/timeline';
import { useLoaded } from '../lib/useLoaded';
import type { Status, Timeline } from '../types';

/** The two reads this page is made of, arriving together so a chart is never
    drawn with its colours still to come. */
interface TimelineView {
  timeline: Timeline;
  statuses: Status[];
}

interface BodyProps {
  timeline: Timeline;
  statuses: Status[];
  offsetMinutes: number;
  now: Date;
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

/**
 * What the page shows once the answer is in: the chart, or the sentence that
 * says there is nothing to chart, and under either the footnote for column
 * changes the server could not place.
 *
 * Pure of the load and of the URL, so a test can render it from props - there
 * is no DOM runner to drive `useLoaded`.
 */
export function TimelineBody({ timeline, statuses, offsetMinutes, now, expanded, onToggle }: BodyProps) {
  const empty = timeline.epics.length === 0 && timeline.other === null;
  const unresolved = unresolvedPhrase(timeline.unresolved);

  return (
    <>
      {empty ? (
        <EmptyState message="Nothing was active in this range." />
      ) : (
        /* Scaled to the answer's own `from` and `to` - the clamps the server
           applied - not the window that was asked for, so the ticks and the
           bars agree with what was actually read. */
        <TimelineChart
          timeline={timeline}
          statuses={statuses}
          scale={makeScale(timeline.from, timeline.to)}
          offsetMinutes={offsetMinutes}
          now={now}
          expanded={expanded}
          onToggle={onToggle}
        />
      )}

      {unresolved && <p className="text-muted hatch-timeline-footnote">{unresolved}</p>}
    </>
  );
}

/**
 * When the work happened: every epic as a row of coloured stretches, one per
 * column it sat in, with its children a click away.
 *
 * The window comes off the URL's `from` and `to` and falls back to the last
 * ninety days; which rows are open is page state and never the URL, since a
 * pasted link should open the same range and not somebody's half-unfolded view.
 */
export function TimelinePage() {
  const [params] = useSearchParams();

  /* Minutes east of UTC, read once per render rather than held: it is a fact
     about the browser, as on the leaderboard. */
  const offsetMinutes = -new Date().getTimezoneOffset();

  /* Keyed on the URL's own text rather than on `params`, which is a fresh
     object every render - depending on it would resolve a new window each time
     and refetch forever. `now` is read in here too, so it is fixed for as long
     as the window is and the today marker does not drift under a refetch. */
  const search = params.toString();
  const { from, to, now } = useMemo(() => {
    const now = new Date();

    return { ...resolveWindow(new URLSearchParams(search), now, offsetMinutes), now };
  }, [search, offsetMinutes]);

  const load = useCallback(async (): Promise<TimelineView> => {
    const [statuses, timeline] = await Promise.all([getStatuses(), getTimeline({ from, to })]);

    return { timeline, statuses };
  }, [from, to]);

  const { data, error } = useLoaded<TimelineView>(load);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  if (error && !data) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div className="hatch-page">
      <PageHeader
        title="Timeline"
        description="When each epic was in flight, and how long its work sat in each column."
      />

      {error && <p className="text-danger">{error}</p>}

      <TimelineBody
        timeline={data.timeline}
        statuses={data.statuses}
        offsetMinutes={offsetMinutes}
        now={now}
        expanded={expanded}
        onToggle={(key) => setExpanded((open) => toggled(open, key))}
      />
    </div>
  );
}
