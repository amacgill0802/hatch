/* The rules that lay out a section title and its "newest first" glyph. Read as
   text, the way claimCss.test.ts reads App.css - there is no DOM in this
   runner to lay anything out in. */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../App.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of every rule whose selector list names `selector` on its
    own - `.a` but not `.a-b`, and not `.a .b` - merged, later winning. */
function declarationsOf(selector: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').some((s) => s.trim() === selector)) continue;
    for (const statement of body.split(';')) {
      const colon = statement.indexOf(':');
      if (colon === -1) continue;
      props[statement.slice(0, colon).trim()] = statement.slice(colon + 1).trim().replace(/\s+/g, ' ');
    }
  }
  return props;
}

describe('a section title with the newest-first glyph', () => {
  it('lays out title and glyph on the inner span, on the spacing token', () => {
    const row = declarationsOf('.hatch-section-title-row');

    expect(row['display']).toBe('inline-flex');
    expect(row['align-items']).toBe('center');
    expect(row['gap']).toBe('var(--sp-1)');
  });

  it('keeps the shared title class at its native display, so the summary keeps its triangle', () => {
    expect(declarationsOf('.hatch-section-title')).not.toHaveProperty('display');
  });

  it('sizes the glyph in em, and animates nothing', () => {
    const glyph = declarationsOf('.hatch-newest-first-glyph');

    expect(glyph['width']).toBe('1em');
    expect(glyph['height']).toBe('1em');
    expect(glyph).not.toHaveProperty('transition');
    expect(glyph).not.toHaveProperty('animation');
  });
});
