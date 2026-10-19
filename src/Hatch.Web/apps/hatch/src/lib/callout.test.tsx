/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Callout } from '@hatch/ui';

const anchor = createRef<HTMLElement>();

const css = readFileSync(
  new URL('../../../../packages/ui/src/components/Callout.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector is exactly `selector`. */
function declarationsOf(selector: string): string {
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((s) => s.trim() === selector)) return body;
  }
  throw new Error(`no rule for ${selector}`);
}

describe('Callout', () => {
  it('draws nothing while closed', () => {
    const html = renderToStaticMarkup(
      <Callout id="c" anchor={anchor} open={false} heading="Heading">
        Body
      </Callout>,
    );

    expect(html).toBe('');
  });

  it('draws the heading and body as a tooltip with its id, and no title', () => {
    const html = renderToStaticMarkup(
      <Callout id="c-1" anchor={anchor} open heading="Heading words">
        Body words
      </Callout>,
    );

    expect(html).toContain('role="tooltip"');
    expect(html).toContain('id="c-1"');
    expect(html).toContain('Heading words');
    expect(html).toContain('Body words');
    expect(html.indexOf('Heading words')).toBeLessThan(html.indexOf('Body words'));
    expect(html).not.toContain(' title=');
  });
});

describe('Callout.css', () => {
  it('writes no colour literal', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgb|hsl)a?\(/);
  });

  it('edges in --callout-edge, falling back to --primary', () => {
    expect(declarationsOf('.hatch-callout')).toMatch(/border:\s*2px solid var\(--callout-edge,\s*var\(--primary\)\)/);
  });

  it('sets the heading and the body at the body type size', () => {
    expect(declarationsOf('.hatch-callout__heading')).toMatch(/font-size:\s*var\(--t-body\)/);
    expect(declarationsOf('.hatch-callout__body')).toMatch(/font-size:\s*var\(--t-body\)/);
  });
});
