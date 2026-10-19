/* HA-973's paint for HA-972's Spot: the dim and the four rings. Read as
   text, the way cardCss.test.ts reads App.css - there is no DOM in this
   runner to lay anything out in, and no DOM is needed to check which rule
   wins a tie or what a rule sets. */
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

/** The index of the first rule whose selector list names `selector` on its
    own, the same match `declarationsOf` makes - so "comes after" can be
    checked by comparing two calls' positions in the file. */
function firstIndexOf(selector: string): number {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1];
    if (selectors.split(',').some((s) => s.trim() === selector)) return match.index!;
  }
  return -1;
}

/** The declarations of only the first rule naming `selector` - unlike
    `declarationsOf`, not merged with a later one. The reduced-motion block
    textually follows the resting rule and sets the same property to turn the
    transition off, which this file's own helper's pattern-matching does not
    tell apart from an override at the resting rule's own specificity - so
    the resting rule's own transition is read here, before that override. */
function firstDeclarationsOf(selector: string): Record<string, string> {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectors, body] = match;
    if (!selectors.split(',').some((s) => s.trim() === selector)) continue;
    const props: Record<string, string> = {};
    for (const statement of body.split(';')) {
      const colon = statement.indexOf(':');
      if (colon === -1) continue;
      props[statement.slice(0, colon).trim()] = statement.slice(colon + 1).trim().replace(/\s+/g, ' ');
    }
    return props;
  }
  return {};
}

const rings: Array<[selector: string, style: string, color: string]> = [
  ['.hatch-card.hatch-spot-dependency', 'solid', 'var(--danger)'],
  ['.hatch-card.hatch-spot-turn', 'solid', 'var(--flow-turn)'],
  ['.hatch-card.hatch-spot-ancestor', 'solid', 'var(--flow-family)'],
  ['.hatch-card.hatch-spot-descendant', 'dashed', 'var(--flow-family)'],
];

const reflowProperties = ['display', 'visibility', 'width', 'height', 'margin', 'padding', 'border-width'];

describe('the spotlight dim', () => {
  it('sets opacity and filter, nothing that reflows', () => {
    const rule = declarationsOf('.hatch-card.hatch-spot-dim');

    expect(rule).toHaveProperty('opacity');
    expect(rule).toHaveProperty('filter');
    for (const property of reflowProperties) expect(rule).not.toHaveProperty(property);
  });

  it('transitions opacity, filter and outline-color', () => {
    expect(firstDeclarationsOf('.hatch-card.hatch-spot-dim').transition).toBe(
      'opacity var(--transition), filter var(--transition), outline-color var(--transition)',
    );
  });

  it('comes after .hatch-card.waiting and .hatch-card.paused, so it wins the tie', () => {
    const dim = firstIndexOf('.hatch-card.hatch-spot-dim');

    expect(dim).toBeGreaterThan(firstIndexOf('.hatch-card.waiting'));
    expect(dim).toBeGreaterThan(firstIndexOf('.hatch-card.paused'));
  });
});

describe('the spotlight rings', () => {
  it.each(rings)('%s is a %s outline in %s', (selector, style, color) => {
    const rule = declarationsOf(selector);

    expect(rule.outline).toBe(`2px ${style} ${color}`);
    expect(rule['outline-offset']).toBe('2px');
  });

  it.each(rings)('%s names its colour as a var(), never a literal', (selector) => {
    expect(declarationsOf(selector).outline).toMatch(/var\(--[\w-]+\)$/);
  });

  it.each(rings)('%s comes after .hatch-card.found, so it beats the transparent resting outline', (selector) => {
    expect(firstIndexOf(selector)).toBeGreaterThan(firstIndexOf('.hatch-card.found'));
  });

  it.each(rings)('%s sets nothing that reflows', (selector) => {
    const rule = declarationsOf(selector);
    for (const property of reflowProperties) expect(rule).not.toHaveProperty(property);
  });
});
