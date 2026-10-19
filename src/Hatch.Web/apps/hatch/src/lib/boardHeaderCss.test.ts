/* The phone-width board header: New issue sizes to its content, the search
   box grows to fill the row, and Filters/the queue control/the view toggle
   all report the same height. Read as text, the way barCss.test.ts and the
   other lib/*Css.test.ts files read App.css - there is no DOM in this runner
   to lay anything out in. */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../App.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of `selector` as they read inside `@media (${mediaQuery})`
    blocks alone - for a selector a later, same-specificity rule elsewhere in
    the file also names, where a flat declarationsOf merge would silently
    report whichever rule is textually last rather than the one a given block
    actually sets. The file has more than one block with this same query, so
    every one of them is searched and merged, later winning - depth-counting
    braces to find each block's matching close; nothing in this file nests an
    `@media` inside another. */
function declarationsWithin(mediaQuery: string, selector: string): Record<string, string> {
  const props: Record<string, string> = {};
  const needle = `@media (${mediaQuery}) {`;
  for (let start = css.indexOf(needle); start !== -1; start = css.indexOf(needle, start + needle.length)) {
    const openBrace = css.indexOf('{', start);
    let depth = 0;
    let end = openBrace;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const block = css.slice(openBrace + 1, end);

    for (const [, selectors, body] of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(',').some((s) => s.trim() === selector)) continue;
      for (const statement of body.split(';')) {
        const colon = statement.indexOf(':');
        if (colon === -1) continue;
        props[statement.slice(0, colon).trim()] = statement.slice(colon + 1).trim().replace(/\s+/g, ' ');
      }
    }
  }
  if (Object.keys(props).length === 0) throw new Error(`no @media (${mediaQuery}) block in App.css names ${selector}`);
  return props;
}

describe('the board header at phone width', () => {
  it('lets New issue size to its content instead of filling the row', () => {
    expect(declarationsWithin('max-width: 40rem', '.hatch-board-filing')).not.toHaveProperty('width');
  });

  it('grows the search box to fill the row', () => {
    const search = declarationsWithin('max-width: 40rem', '.hatch-board-search');
    expect(search['flex']).toBe('1 1 auto');
    expect(search['min-width']).toBe('0');
  });

  it('sizes Filters, the queue control, flow-viz and the view toggle to the same facet height', () => {
    expect(declarationsWithin('max-width: 40rem', '.hatch-board-filters-more > summary')['height']).toBe('var(--facet-h)');
    expect(declarationsWithin('max-width: 40rem', '.hatch-queue-control')['height']).toBe('var(--facet-h)');
    expect(declarationsWithin('max-width: 40rem', '.hatch-flow-viz-control')['height']).toBe('var(--facet-h)');
    expect(declarationsWithin('max-width: 40rem', '.hatch-board-view-toggle')['height']).toBe('var(--facet-h)');
  });
});
