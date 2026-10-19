import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { useCallout } from '@hatch/ui';
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

  describe('with a callout', () => {
    const band = { kind: 'dependency' as const, words: 'Dependency' };
    const tip = (open: boolean): ReturnType<typeof useCallout> => ({
      id: 'tip-1',
      open,
      anchorRef: createRef<HTMLElement>(),
      describedBy: open ? 'tip-1' : undefined,
      hover: { onPointerEnter: () => {}, onPointerLeave: () => {} },
      focus: { onFocus: () => {}, onBlur: () => {} },
    });
    const withTip = (open: boolean) =>
      renderToStaticMarkup(<FlowBand band={band} sentence="waiting on HA-2" tip={tip(open)} />);

    it('draws the sentence under the band\'s own words as a tooltip while open', () => {
      const html = withTip(true);

      expect(html).toContain('waiting on HA-2');
      expect(html).toContain('role="tooltip"');
      expect(html).toContain('id="tip-1"');
      expect(html).toContain('hatch-callout__heading">Dependency<');
    });

    it('puts no sentence anywhere in the markup while closed', () => {
      expect(withTip(false)).not.toContain('waiting on HA-2');
    });

    it('carries no native title, open or closed', () => {
      expect(withTip(true)).not.toContain(' title=');
      expect(withTip(false)).not.toContain(' title=');
    });

    it('draws no callout without a tip', () => {
      expect(renderToStaticMarkup(<FlowBand band={band} sentence="waiting on HA-2" />)).not.toContain('waiting on HA-2');
    });
  });
});
