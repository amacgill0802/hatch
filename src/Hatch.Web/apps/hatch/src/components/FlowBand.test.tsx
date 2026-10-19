import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowBand } from './FlowBand';
import type { FlowBandKind } from '../lib/queue';

const render = (band: { kind: FlowBandKind; words: string } | null) => renderToStaticMarkup(<FlowBand band={band} />);

describe('FlowBand', () => {
  it('draws nothing with no band', () => {
    expect(render(null)).toBe('');
  });

  it.each<[FlowBandKind, string]>([
    ['clear', 'Clear'],
    ['working', 'Working'],
    ['wip', 'WIP full'],
    ['dependency', 'Dependency'],
    ['turn', 'In line'],
    ['family', 'Family'],
    ['person', 'Needs you'],
    ['other', 'Blocked'],
  ])('draws its own class and words for %s', (kind, words) => {
    const html = render({ kind, words });

    expect(html).toContain(`hatch-flow-band hatch-flow-${kind}`);
    expect(html).toContain(words);
  });
});
