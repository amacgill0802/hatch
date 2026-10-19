/* The paint of the FlowArrows overlay. Read as text, the way
   flowBandCss.test.ts reads App.css - there is no DOM in this runner to lay
   anything out in. */
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

/** Every value of `props` set by any rule with a class starting `prefix`. */
function setBy(prefix: string, props: string[]): string[] {
  const values: string[] = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(',').some((s) => s.trim().split('.').some((t) => t.startsWith(prefix)))) continue;
    for (const statement of body.split(';')) {
      const colon = statement.indexOf(':');
      if (colon === -1) continue;
      if (props.includes(statement.slice(0, colon).trim())) values.push(statement.slice(colon + 1).trim());
    }
  }
  return values;
}

describe('the flow arrows overlay', () => {
  it('is fixed, takes no pointer, and sets no overflow of its own', () => {
    const rule = declarationsOf('.hatch-flow-arrows');

    expect(rule.position).toBe('fixed');
    expect(rule['pointer-events']).toBe('none');
    expect(rule).not.toHaveProperty('overflow');
  });

  it('sits under the callout and Modal', () => {
    const zIndex = Number(declarationsOf('.hatch-flow-arrows')['z-index']);

    expect(Number.isInteger(zIndex)).toBe(true);
    expect(zIndex).toBeLessThan(100);
  });

  it('leaves the stroke unfilled, the head unstroked, and fills each head', () => {
    expect(declarationsOf('.hatch-flow-arrow-stroke').fill).toBe('none');
    expect(declarationsOf('.hatch-flow-arrow-head').stroke).toBe('none');
    expect(declarationsOf('.hatch-flow-arrow-head.hatch-flow-arrow-upstream')).toHaveProperty('fill');
    expect(declarationsOf('.hatch-flow-arrow-head.hatch-flow-arrow-downstream')).toHaveProperty('fill');
  });

  it('colours only with tokens, upstream in --danger', () => {
    const colours = setBy('hatch-flow-arrow', ['fill', 'stroke']);

    for (const value of colours) expect(value === 'none' || value.startsWith('var(--')).toBe(true);
    expect(colours).toContain('var(--danger)');
  });

  it('moves nothing: no transition and no animation', () => {
    expect(setBy('hatch-flow-arrow', ['transition', 'animation'])).toEqual([]);
  });
});
