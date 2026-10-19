import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FlowVizControl } from './FlowVizControl';

describe('FlowVizControl', () => {
  it('pins aria-pressed off, unpressed', () => {
    const html = renderToStaticMarkup(<FlowVizControl on={false} onToggle={() => {}} />);

    expect(html).toContain('aria-pressed="false"');
  });

  it('pins aria-pressed on, pressed', () => {
    const html = renderToStaticMarkup(<FlowVizControl on={true} onToggle={() => {}} />);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('hatch-flow-viz-control active');
  });
});
