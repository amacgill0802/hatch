/* The pinned board page at phone width: standalone restores the fixed-height
   shell (html, body, #root, .hatch-app) so the unscoped .hatch-board and
   .hatch-column-cards rules clip and scroll as on the desk. Read as text, the
   way boardHeaderCss.test.ts reads App.css - there is no DOM in this runner
   to lay anything out in. */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readCss(file: string): string {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

const appCss = readCss('App.css');
const themeCss = readCss('theme.css');

/** The declarations of `selector` as they read inside `@media (${mediaQuery})`
    blocks of `css` alone, every such block searched and merged, later winning -
    depth-counting braces to find each block's matching close; nothing in these
    files nests an `@media` inside another. */
function declarationsWithin(css: string, mediaQuery: string, selector: string): Record<string, string> {
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
  if (Object.keys(props).length === 0) throw new Error(`no @media (${mediaQuery}) block names ${selector}`);
  return props;
}

describe('the pinned board page at phone width', () => {
  it('gives the app shell a 100dvh height', () => {
    expect(declarationsWithin(appCss, 'max-width: 40rem', '.hatch-app:has(.hatch-board-page--pinned)')['height']).toBe('100dvh');
  });

  it('gives the document chain a 100dvh height', () => {
    for (const root of ['html', 'body', '#root']) {
      expect(declarationsWithin(themeCss, 'max-width: 40rem', `${root}:has(.hatch-board-page--pinned)`)['height']).toBe('100dvh');
    }
  });
});
