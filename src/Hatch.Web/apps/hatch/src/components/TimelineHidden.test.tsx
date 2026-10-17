/* Show restoring one row and Show all clearing the disclosure are pinned by
   toggleHidden, writeHidden and hiddenEntries in lib/timelineHidden.test.ts;
   there is no DOM runner here to press a button, so this reads what is drawn. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OTHER_KEY } from '../lib/timeline';
import { TimelineHidden } from './TimelineHidden';

const render = (entries: { key: string; title: string | null }[]) =>
  renderToStaticMarkup(<TimelineHidden entries={entries} onShow={() => {}} onShowAll={() => {}} />);

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('TimelineHidden', () => {
  it('draws nothing while nothing is hidden', () => {
    expect(render([])).toBe('');
  });

  it('counts the entries and lists each key, with a title when it has one', () => {
    const html = render([
      { key: 'HA-1', title: 'First epic' },
      { key: 'HA-2', title: null },
    ]);

    expect(html).toContain('Hidden (2)');
    expect(html).toContain('HA-1');
    expect(html).toContain('HA-2');
    expect(html).toContain('First epic');
    expect(count(html, 'hatch-timeline-hidden__title')).toBe(1);
  });

  it('draws a Show button for each entry and a Show all', () => {
    const html = render([
      { key: 'HA-1', title: 'First epic' },
      { key: 'HA-2', title: null },
    ]);

    expect(count(html, 'aria-label="Show HA-1"')).toBe(1);
    expect(count(html, 'aria-label="Show HA-2"')).toBe(1);
    expect(html).toContain('>Show all</button>');
  });

  it('draws the Other row by its title, without the sentinel key', () => {
    const html = render([{ key: OTHER_KEY, title: 'Other' }]);

    expect(count(html, '>Other<')).toBe(1);
    expect(html).not.toContain('hatch-timeline-key');
    expect(html).toContain(`aria-label="Show ${OTHER_KEY}"`);
  });

  it('draws the key of a hidden Other the answer no longer holds', () => {
    const html = render([{ key: OTHER_KEY, title: null }]);

    expect(html).toContain(`hatch-timeline-key">${OTHER_KEY}<`);
  });
});
