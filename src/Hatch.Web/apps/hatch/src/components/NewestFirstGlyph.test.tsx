import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewestFirstGlyph, NewestFirstTitle } from './NewestFirstGlyph';

describe('NewestFirstGlyph', () => {
  it('is a labelled image whose drawing is hidden from assistive tech', () => {
    const html = renderToStaticMarkup(<NewestFirstGlyph />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="newest first"');
    expect(html).toContain('title="Newest first"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<svg[^>]*focusable="false"/);
  });
});

describe('NewestFirstTitle', () => {
  it('draws the words, then the glyph, inside one row', () => {
    const html = renderToStaticMarkup(<NewestFirstTitle>Comments</NewestFirstTitle>);

    expect(html).toMatch(/^<span class="hatch-section-title-row">Comments<span class="hatch-newest-first"/);
  });
});
