/* The rules HA-546 made: the card head's key line stands alone, large and
   unwrapping, now that the head holds only the project mark and the key.
   Read as text, the way claimCss.test.ts reads App.css - there is no DOM in
   this runner to lay anything out in. */
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

describe('the card head key', () => {
  it('reads large and never wraps', () => {
    expect(declarationsOf('.hatch-card-key')['font-size']).toBe('var(--t-body)');
    expect(declarationsOf('.hatch-card-key')['white-space']).toBe('nowrap');
  });
});
