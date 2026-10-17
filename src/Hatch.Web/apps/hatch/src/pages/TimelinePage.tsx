import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, PageHeader } from '@hatch/ui';
import { getProjects, getStatuses, getTimeline } from '../api/client';
import { TimelineChart } from '../components/TimelineChart';
import { TimelineControls } from '../components/TimelineControls';
import { TimelineFilters } from '../components/TimelineFilters';
import {
  CREATOR,
  PROJECT,
  makeScale,
  resolveCreator,
  resolveProject,
  resolveWindow,
  sameWindow,
  toggled,
  unresolvedPhrase,
  withFilter,
  withWindow,
  type TimelineWindow,
} from '../lib/timeline';
import { useLoaded } from '../lib/useLoaded';
import type { Project, Status, Timeline } from '../types';

/** The reads this page is made of, arriving together so a chart is never drawn
    with its colours still to come, nor a filter with its choices. */
interface TimelineView {
  timeline: Timeline;
  statuses: Status[];
  projects: Project[];
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
 * The window comes off the URL's `from` and `to`, or a `range` shorthand, and
 * falls back to the last ninety days; the controls write `from` and `to`. The
 * URL also carries `project` (a key) and `creator` (a name), which the filters
 * write and the read is scoped by. Which rows are open is page state and never
 * the URL, since a pasted link should open the same range and not somebody's
 * half-unfolded view.
 */
export function TimelinePage() {
  const [params, setParams] = useSearchParams();

  /* Minutes east of UTC, read once per render rather than held: it is a fact
     about the browser, as on the leaderboard. */
  const offsetMinutes = -new Date().getTimezoneOffset();

  /* Keyed on the URL's own text rather than on `params`, which is a fresh
     object every render - depending on it would resolve a new window each time
     and refetch forever. `now` is read in here too, so it is fixed for as long
     as the window is and the today marker does not drift under a refetch. */
  const search = params.toString();
  const { from, to, now, projectKey, creator } = useMemo(() => {
    const now = new Date();
    const url = new URLSearchParams(search);

    return {
      ...resolveWindow(url, now, offsetMinutes),
      now,
      projectKey: url.get(PROJECT) ?? '',
      creator: resolveCreator(url),
    };
  }, [search, offsetMinutes]);

  const load = useCallback(async (): Promise<TimelineView> => {
    const [statuses, projects] = await Promise.all([getStatuses(), getProjects()]);

    /* The read waits on the project list rather than going out beside it,
       because the URL holds a key - the thing a person would type or paste -
       and the API takes an id. A key naming no project falls back to every
       project, which is what the picker will be showing anyway. */
    const chosen = resolveProject(new URLSearchParams({ [PROJECT]: projectKey }), projects);
    const timeline = await getTimeline({ from, to, projectId: chosen?.id, createdBy: creator || null });

    return { timeline, statuses, projects };
  }, [from, to, projectKey, creator]);

  const { data, error } = useLoaded<TimelineView>(load);

  /* Compares the resolved window, not the URL text, so a press that would land
     where the page already is - Today on the default, with no `from` or `to` in
     the URL at all - writes nothing. Replaces rather than pushes, as the
     leaderboard does: a run of presses is not a run of history entries. */
  function move(next: TimelineWindow) {
    if (sameWindow(next, { from, to })) return;

    setParams(withWindow(params, next), { replace: true });
  }

  /* Replace rather than push, as `move` does: flipping a filter is not a place
     somebody wants Back to walk them through. The window is left as it is. */
  function chooseProject(key: string) {
    setParams(withFilter(params, PROJECT, key), { replace: true });
  }

  function chooseCreator(name: string) {
    setParams(withFilter(params, CREATOR, name), { replace: true });
  }

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  if (error && !data) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  const chosen = resolveProject(params, data.projects);

  return (
    <div className="hatch-page">
      <PageHeader
        title="Timeline"
        description="When each epic was in flight, and how long its work sat in each column."
        className="hatch-timeline-header"
        /* The requested window, not the answer's, so the strip responds while a
           refetch is in flight. `now` is fresh rather than the memoised one so a
           tab left open past midnight moves on the next press of Today. */
        actions={
          <>
            <TimelineControls
              window={{ from, to }}
              now={new Date()}
              offsetMinutes={offsetMinutes}
              onMove={move}
            />
            <TimelineFilters
              projects={data.projects}
              project={chosen?.key ?? ''}
              creators={data.timeline.creators}
              creator={creator}
              onProject={chooseProject}
              onCreator={chooseCreator}
            />
          </>
        }
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
