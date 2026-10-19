/* The rule that gives each of the eight flow-viz bands its colour. Read as
   text, the way wipCss.test.ts reads App.css - there is no DOM in this
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

describe('the flow-viz bands', () => {
  it.each([
    '.hatch-flow-clear',
    '.hatch-flow-working',
    '.hatch-flow-wip',
    '.hatch-flow-dependency',
    '.hatch-flow-turn',
    '.hatch-flow-family',
    '.hatch-flow-person',
    '.hatch-flow-other',
  ])('%s sets --flow-fill and --flow-ink', (selector) => {
    const rule = declarationsOf(selector);

    expect(rule).toHaveProperty('--flow-fill');
    expect(rule).toHaveProperty('--flow-ink');
  });

  it('gives the four house-accent kinds --on-accent as their ink', () => {
    expect(declarationsOf('.hatch-flow-clear')['--flow-ink']).toBe('var(--on-accent)');
    expect(declarationsOf('.hatch-flow-working')['--flow-ink']).toBe('var(--on-accent)');
    expect(declarationsOf('.hatch-flow-wip')['--flow-ink']).toBe('var(--on-accent)');
    expect(declarationsOf('.hatch-flow-dependency')['--flow-ink']).toBe('var(--on-accent)');
  });

  it('gives the four house-accent kinds the fill they already read as elsewhere', () => {
    expect(declarationsOf('.hatch-flow-clear')['--flow-fill']).toBe('var(--success)');
    expect(declarationsOf('.hatch-flow-working')['--flow-fill']).toBe('var(--primary)');
    expect(declarationsOf('.hatch-flow-wip')['--flow-fill']).toBe('var(--warn)');
    expect(declarationsOf('.hatch-flow-dependency')['--flow-fill']).toBe('var(--danger)');
  });

  it('gives the four HA-967 kinds their own pair, not --on-accent', () => {
    expect(declarationsOf('.hatch-flow-turn')).toEqual({ '--flow-fill': 'var(--flow-turn)', '--flow-ink': 'var(--on-flow-turn)' });
    expect(declarationsOf('.hatch-flow-family')).toEqual({ '--flow-fill': 'var(--flow-family)', '--flow-ink': 'var(--on-flow-family)' });
    expect(declarationsOf('.hatch-flow-person')).toEqual({ '--flow-fill': 'var(--flow-person)', '--flow-ink': 'var(--on-flow-person)' });
    expect(declarationsOf('.hatch-flow-other')).toEqual({ '--flow-fill': 'var(--flow-other)', '--flow-ink': 'var(--on-flow-other)' });
  });

  it('sets .hatch-flow-band over the card\'s lower half, taking its bottom corners', () => {
    const rule = declarationsOf('.hatch-flow-band');

    expect(rule.position).toBe('absolute');
    expect(rule.bottom).toBe('0');
    expect(rule['border-radius']).toBe('0 0 var(--r-ctl) var(--r-ctl)');
  });

  it("hands the band's own fill to the callout hung off it as its edge", () => {
    expect(declarationsOf('.hatch-flow-band')['--callout-edge']).toBe('var(--flow-fill)');
  });
});
