import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TimelineBody } from './TimelinePage';
import type { IssueCard, Status, Timeline, TimelineEntry } from '../types';

/* No DOM runner, so `useLoaded` is not driven: the body is rendered from props,
   the way TimelineChart.test.tsx does it. */
const NOW = new Date('2026-10-06T00:00:00Z');
const EMPTY = 'Nothing was active in this range.';
const FOOTNOTE = 'hatch-timeline-footnote';

const statuses = [{ id: 1, name: 'To Do', color: '#3366cc' }] as Status[];

const entry = (key: string, type: IssueCard['type'] = 'epic'): TimelineEntry => ({
  issue: { key, type, title: `title ${key}` } as IssueCard,
  createdBy: 'someone',
  isLeaf: true,
  segments: [{ statusId: 1, from: '2026-10-02T00:00:00.000Z', to: '2026-10-04T00:00:00.000Z' }],
  children: [],
});

const answer = (over: Partial<Timeline> = {}): Timeline => ({
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-11T00:00:00.000Z',
  epics: [entry('HA-1')],
  other: null,
  creators: [],
  unresolved: 0,
  ...over,
});

const render = (timeline: Timeline): string =>
  renderToStaticMarkup(
    <MemoryRouter>
      <TimelineBody
        timeline={timeline}
        statuses={statuses}
        offsetMinutes={0}
        now={NOW}
        expanded={new Set()}
        onToggle={() => {}}
      />
    </MemoryRouter>,
  );

describe('TimelineBody', () => {
  it('draws the chart when an epic was active, with no footnote at zero', () => {
    const html = render(answer());

    expect(html).toContain('class="hatch-timeline"');
    expect(html).toContain('HA-1');
    expect(html).not.toContain(EMPTY);
    expect(html).not.toContain(FOOTNOTE);
  });

  it('still draws the chart when only the Other row has work', () => {
    const html = render(answer({ epics: [], other: entry('other') }));

    expect(html).toContain('class="hatch-timeline"');
    expect(html).not.toContain(EMPTY);
  });

  it('scales the chart to the answer, not to the window asked for', () => {
    /* The ruler's ticks come from the scale; a clamped answer in November must
       not be labelled with the October that `NOW` sits in. */
    const clamped = render(answer({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-11T00:00:00.000Z' }));

    expect(clamped).toContain('>Nov 1</span>');
    expect(clamped).not.toContain('>Oct 1</span>');
  });

  it('says there is nothing to show when there are no epics and no Other row', () => {
    const html = render(answer({ epics: [], other: null }));

    expect(html).toContain(EMPTY);
    expect(html).not.toContain('hatch-timeline"');
    expect(html).not.toContain(FOOTNOTE);
  });

  it('footnotes one unplaced column change in the singular', () => {
    const html = render(answer({ unresolved: 1 }));

    expect(html).toContain(FOOTNOTE);
    expect(html).toContain('1 column change could not be placed');
    expect(html).not.toContain('1 column changes');
  });

  it('footnotes several in the plural', () => {
    const html = render(answer({ unresolved: 3 }));

    expect(html).toContain('3 column changes could not be placed');
  });

  it('carries the footnote on the empty state too', () => {
    const html = render(answer({ epics: [], unresolved: 2 }));

    expect(html).toContain(EMPTY);
    expect(html).toContain('2 column changes could not be placed');
  });
});
