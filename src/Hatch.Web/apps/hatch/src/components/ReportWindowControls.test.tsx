import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReportWindow, WindowPreset } from '../lib/reportWindow';
import { ReportWindowControls } from './ReportWindowControls';

const TO = '2026-10-18T00:00:00.000Z';
const DAY_MS = 86_400_000;

const windowOf = (days: number): ReportWindow => ({
  from: new Date(Date.parse(TO) - days * DAY_MS).toISOString(),
  to: TO,
});

function render(days: number, defaultPreset: WindowPreset = '3m') {
  return renderToStaticMarkup(
    <ReportWindowControls
      defaultPreset={defaultPreset}
      window={windowOf(days)}
      now={new Date(TO)}
      offsetMinutes={0}
      onMove={() => {}}
    />,
  );
}

const shown = (html: string) =>
  [...html.matchAll(/<span class="hatch-facet__option hatch-facet__option--shown">([^<]*)</g)].map((m) => m[1]);

describe('ReportWindowControls', () => {
  it('is a group named Window', () => {
    expect(render(90)).toContain('role="group" aria-label="Window"');
  });

  it('puts Earlier, Today and Later first, in that order', () => {
    const labels = [...render(90).matchAll(/<button[^>]*>([^<]*)</g)].map((m) => m[1]);

    expect(labels).toEqual(['Earlier', 'Today', 'Later']);
  });

  it('offers the seven presets for a preset length, showing the one it is', () => {
    const html = render(90);

    expect([...html.matchAll(/<option /g)]).toHaveLength(7);
    expect(html).not.toContain('Custom');
    expect(shown(html)).toEqual(['3 months']);
  });

  it('adds a shown Custom option for a length that is no preset', () => {
    const html = render(45);

    expect([...html.matchAll(/<option /g)]).toHaveLength(8);
    expect(shown(html)).toEqual(['Custom']);
  });

  it('offers the seven lengths narrowest first', () => {
    const labels = [...render(90).matchAll(/<option[^>]*>([^<]*)</g)].map((m) => m[1]);

    expect(labels).toEqual(['1 day', '1 week', '2 weeks', '1 month', '3 months', '6 months', '1 year']);
  });

  it('lights the length only when it is not the default', () => {
    expect(render(90)).not.toContain('hatch-facet--lit');
    expect(render(365)).toContain('hatch-facet--lit');
  });

  it('lights the length against the default it is given, not a fixed one', () => {
    expect(render(30, '1m')).not.toContain('hatch-facet--lit');
    expect(render(90, '1m')).toContain('hatch-facet--lit');
  });
});
