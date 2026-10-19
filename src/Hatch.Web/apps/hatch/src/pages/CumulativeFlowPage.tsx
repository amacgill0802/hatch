import { useCallback } from 'react';
import { EmptyState, PageHeader } from '@hatch/ui';
import { getCumulativeFlow, getStatuses } from '../api/client';
import { CumulativeFlowChart } from '../components/CumulativeFlowChart';
import { isEmpty } from '../lib/cumulativeFlow';
import { makeScale, unresolvedPhrase } from '../lib/timeline';
import { useLoaded } from '../lib/useLoaded';
import { useReportWindow } from '../lib/useReportWindow';
import { ReportWindowControls } from '../components/ReportWindowControls';
import type { CumulativeFlow, Status } from '../types';

/** The reads this page is made of, arriving together so the chart is never
    drawn with its colours still to come. */
interface CumulativeFlowView {
  answer: CumulativeFlow;
  statuses: Status[];
}

interface BodyProps {
  answer: CumulativeFlow;
  statuses: Status[];
  offsetMinutes: number;
  now: Date;
  locale?: string;
}

/**
 * What the page shows once the answer is in: the chart, or the sentence that
 * says there is nothing to chart, and under either the footnote for column
 * changes the server could not place.
 *
 * Pure of the load and of the URL, so a test can render it from props - there
 * is no DOM runner to drive `useLoaded`.
 */
export function CumulativeFlowBody({ answer, statuses, offsetMinutes, now, locale }: BodyProps) {
  const unresolved = unresolvedPhrase(answer.unresolved);

  return (
    <>
      {isEmpty(answer) ? (
        <EmptyState message="Nothing was on the board in this range." />
      ) : (
        /* Scaled to the answer's own `from` and `to` - the clamps the server
           applied - not the window that was asked for, as `TimelineBody` does. */
        <CumulativeFlowChart
          answer={answer}
          statuses={statuses}
          scale={makeScale(answer.from, answer.to)}
          offsetMinutes={offsetMinutes}
          now={now}
          locale={locale}
        />
      )}

      {unresolved && <p className="text-muted hatch-timeline-footnote">{unresolved}</p>}
    </>
  );
}

/**
 * How much work sat in each column over time, and where it is piling up: one
 * band per board column, stacked bottom-up, drawn along a time axis.
 *
 * The window comes off the URL's `from` and `to`, or a `range` shorthand, and
 * falls back to the last ninety days; the controls write `from` and `to`. The
 * route takes no project or creator filter - a column's count is a fact about
 * the board, not about any one project or creator.
 */
export function CumulativeFlowPage() {
  const { from, to, now, offsetMinutes, move } = useReportWindow();

  const load = useCallback(async (): Promise<CumulativeFlowView> => {
    const [statuses, answer] = await Promise.all([getStatuses(), getCumulativeFlow({ from, to })]);

    return { answer, statuses };
  }, [from, to]);

  const { data, error } = useLoaded<CumulativeFlowView>(load);

  if (error && !data) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div className="hatch-page">
      <PageHeader
        title="Cumulative flow"
        description="How much work sat in each column over time, and where it is piling up."
        className="hatch-timeline-header"
        actions={
          <ReportWindowControls
            defaultPreset="3m"
            window={{ from, to }}
            now={new Date()}
            offsetMinutes={offsetMinutes}
            onMove={move}
          />
        }
      />

      {error && <p className="text-danger">{error}</p>}

      <CumulativeFlowBody answer={data.answer} statuses={data.statuses} offsetMinutes={offsetMinutes} now={now} />
    </div>
  );
}
